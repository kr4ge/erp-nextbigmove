import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createWriteStream } from 'fs';
import { mkdir, rename, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';

/**
 * The link engine: turns a registered Facebook post link or Google Drive link
 * into a local file the analysis pipeline can use, exactly as if the file had
 * been uploaded.
 *
 * Order of preference is the advertiser's: the Facebook post first, because it
 * is the creative as it actually ran; then the Drive link, the source file;
 * then, only when neither exists, an upload.
 *
 * How each source is read, and why:
 *
 *  - Facebook video. The public post page carries the player's own CDN links
 *    in inline JSON (browser_native_hd_url and friends), which download
 *    directly. Which identity gets that page depends on where the request
 *    comes from, and this was measured rather than assumed: from the
 *    production server Facebook refuses browser identities with HTTP 400 but
 *    answers a plain client identity with the full page; from a residential
 *    address the browser identity works. Crawler identities get the page too,
 *    but with proxy links that serve HTML, never video. So the plain identity
 *    is tried first, the browser identity second, and proxy links are ignored.
 *  - Facebook image. The page's og:image is the full picture, the same tag the
 *    thumbnail capture already relies on.
 *  - Google Drive. A file shared as "anyone with the link" downloads from the
 *    uc endpoint; large files first answer with a virus-scan page whose form
 *    carries the confirmation the second request needs.
 *
 * Every download is streamed to disk under a byte cap, then identified by its
 * content type and its first bytes. A file that turns out not to be the kind
 * the creative is registered as is refused rather than analysed.
 */

export type LinkSourceType = 'FACEBOOK_POST' | 'GOOGLE_DRIVE';

export type FetchedMedia = {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
  sourceType: LinkSourceType;
  sourceUrl: string;
};

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
/** A plain client identity: the one Facebook answers from datacenter addresses. */
const PLAIN_UA = 'curl/8.5.0';
/** Facebook's crawler-only media proxy. It serves HTML, so it is never a download candidate. */
const PROXY_HOST = /^https:\/\/lookaside\.fbsbx\.com\//i;

const FACEBOOK_HOST = /^https:\/\/(?:[a-z0-9-]+\.)?(?:facebook\.com|fb\.com|fb\.watch)\//i;
const DRIVE_HOST = /^https:\/\/(?:drive|docs)\.google\.com\//i;

export function isFacebookUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && FACEBOOK_HOST.test(value.trim());
}

export function isGoogleDriveUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && DRIVE_HOST.test(value.trim());
}

/** The file id from any of the share-link shapes Drive hands out. */
export function extractGoogleDriveFileId(url: string): string | null {
  const trimmed = url.trim();
  const patterns = [
    /\/file\/d\/([A-Za-z0-9_-]{10,})/,
    /[?&]id=([A-Za-z0-9_-]{10,})/,
    /\/uc\?(?:.*&)?id=([A-Za-z0-9_-]{10,})/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Direct video URLs from a Facebook post page, best quality first. The page
 * escapes slashes inside JSON strings, so each value is JSON-decoded.
 */
export function findFacebookVideoUrls(html: string): string[] {
  const keys = ['browser_native_hd_url', 'browser_native_sd_url', 'playable_url_quality_hd', 'playable_url'];
  const found: string[] = [];
  for (const key of keys) {
    const pattern = new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)+)"`, 'g');
    for (const match of html.matchAll(pattern)) {
      let url: string;
      try {
        url = JSON.parse(`"${match[1]}"`);
      } catch {
        continue;
      }
      if (/^https:\/\//i.test(url) && !PROXY_HOST.test(url) && !found.includes(url)) found.push(url);
    }
  }
  return found;
}

/** The post's image: og:image in either attribute order, entities decoded. */
export function findFacebookImageUrl(html: string): string | null {
  const first =
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(html);
  if (first?.[1]) return decodeEntities(first[1]);
  // Photo pages sometimes carry the full-size picture only in inline JSON.
  const inline = /"image":\{"uri":"((?:[^"\\]|\\.)+)"/.exec(html);
  if (inline?.[1]) {
    try {
      return JSON.parse(`"${inline[1]}"`);
    } catch {
      return null;
    }
  }
  return null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** What the first bytes say the file is. Trusted over the declared type. */
export function sniffMedia(head: Buffer): 'mp4' | 'mov' | 'webm' | 'jpg' | 'png' | 'webp' | null {
  if (head.length >= 12 && head.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = head.subarray(8, 12).toString('latin1');
    return brand.startsWith('qt') ? 'mov' : 'mp4';
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'webm';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg';
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (head.length >= 12 && head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * The extension to store the file under, or null when the bytes are not a
 * file the registered kind can accept. The declared content type is a hint;
 * Drive in particular answers with application/octet-stream.
 */
export function resolveExtension(contentType: string | null, head: Buffer, kind: 'VIDEO' | 'STATIC'): string | null {
  const sniffed = sniffMedia(head);
  const declared = (contentType ?? '').split(';')[0].trim().toLowerCase();
  const fromDeclared =
    declared === 'video/mp4' ? 'mp4'
      : declared === 'video/quicktime' ? 'mov'
        : declared === 'video/webm' ? 'webm'
          : declared === 'image/jpeg' ? 'jpg'
            : declared === 'image/png' ? 'png'
              : declared === 'image/webp' ? 'webp'
                : null;
  const ext = sniffed ?? fromDeclared;
  if (!ext) return null;
  const isVideo = ext === 'mp4' || ext === 'mov' || ext === 'webm';
  if (kind === 'VIDEO' && !isVideo) return null;
  if (kind === 'STATIC' && isVideo) return null;
  return ext;
}

@Injectable()
export class CreativeMediaFetchService {
  private readonly logger = new Logger(CreativeMediaFetchService.name);
  private readonly pageTimeoutMs = 30_000;
  private readonly downloadTimeoutMs = positiveInt(process.env.CREATIVE_AI_LINK_FETCH_TIMEOUT_MS, 600_000);
  private readonly maxVideoBytes = positiveInt(process.env.CREATIVE_AI_MAX_VIDEO_MB, 250) * 1024 * 1024;
  private readonly maxImageBytes = positiveInt(process.env.CREATIVE_AI_MAX_IMAGE_MB, 30) * 1024 * 1024;

  /**
   * Resolve a creative's registered links into a local file, Facebook first,
   * then Drive. Throws a message naming what was tried when neither works, so
   * the person knows whether to fix a link or upload instead.
   */
  async resolveForAnalysis(input: {
    kind: 'VIDEO' | 'STATIC';
    mediaUrl: string | null;
    driveUrl: string | null;
  }): Promise<FetchedMedia> {
    const attempts: string[] = [];

    if (isFacebookUrl(input.mediaUrl)) {
      try {
        return await this.fetchFacebook(input.mediaUrl, input.kind);
      } catch (error) {
        attempts.push(`Facebook post: ${message(error)}`);
        this.logger.warn(`Facebook fetch failed for ${input.mediaUrl}: ${message(error)}`);
      }
    }
    if (isGoogleDriveUrl(input.driveUrl)) {
      try {
        return await this.fetchGoogleDrive(input.driveUrl, input.kind);
      } catch (error) {
        attempts.push(`Google Drive: ${message(error)}`);
        this.logger.warn(`Drive fetch failed for ${input.driveUrl}: ${message(error)}`);
      }
    }

    if (attempts.length === 0) {
      throw new BadRequestException(
        'This creative has no Facebook post link or Google Drive link registered. Add one, or upload the file.',
      );
    }
    throw new BadRequestException(`Could not fetch the creative from its links. ${attempts.join(' ')} You can upload the file instead.`);
  }

  async fetchFacebook(postUrl: string, kind: 'VIDEO' | 'STATIC'): Promise<FetchedMedia> {
    if (kind === 'STATIC') {
      // The crawler identity is what the thumbnail capture uses and it reliably
      // returns the Open Graph tags; fall back to the browser view if needed.
      const crawler = await this.fetchPage(postUrl, CRAWLER_UA);
      let imageUrl = 'html' in crawler ? findFacebookImageUrl(crawler.html) : null;
      let failure = 'failure' in crawler ? crawler.failure : null;
      if (!imageUrl) {
        const browser = await this.fetchPage(postUrl, BROWSER_UA);
        imageUrl = 'html' in browser ? findFacebookImageUrl(browser.html) : null;
        failure = failure ?? ('failure' in browser ? browser.failure : null);
      }
      if (!imageUrl) throw new Error(failure ?? 'the post did not expose an image (is it public?)');
      return this.download(imageUrl, {
        kind,
        maxBytes: this.maxImageBytes,
        sourceType: 'FACEBOOK_POST',
        sourceUrl: postUrl,
        headers: { 'user-agent': BROWSER_UA, referer: 'https://www.facebook.com/' },
        nameHint: 'facebook-post',
      });
    }

    // Identities in the order that works from a server first, then from a
    // desk. The first page that yields real CDN links is used.
    const failures: string[] = [];
    for (const pageIdentity of [PLAIN_UA, BROWSER_UA]) {
      const page = await this.fetchPage(postUrl, pageIdentity);
      if ('failure' in page) {
        failures.push(page.failure);
        continue;
      }
      if (/id="login_form"|\/login\/\?next=/.test(page.html.slice(0, 20_000))) {
        failures.push('Facebook asks for a login to view this post, so it is not public');
        continue;
      }
      const candidates = findFacebookVideoUrls(page.html);
      if (candidates.length === 0) {
        failures.push('the page did not expose a video file (is it public, and a video post?)');
        continue;
      }
      let lastError: unknown = null;
      for (const url of candidates) {
        for (const downloadIdentity of [...new Set([pageIdentity, BROWSER_UA])]) {
          try {
            return await this.download(url, {
              kind,
              maxBytes: this.maxVideoBytes,
              sourceType: 'FACEBOOK_POST',
              sourceUrl: postUrl,
              headers: { 'user-agent': downloadIdentity, referer: 'https://www.facebook.com/' },
              nameHint: 'facebook-post',
            });
          } catch (error) {
            lastError = error;
          }
        }
      }
      failures.push(`every video link on the post failed (${message(lastError)})`);
    }
    throw new Error([...new Set(failures)].join('; '));
  }

  async fetchGoogleDrive(driveUrl: string, kind: 'VIDEO' | 'STATIC'): Promise<FetchedMedia> {
    const fileId = extractGoogleDriveFileId(driveUrl);
    if (!fileId) throw new Error('the link does not contain a Drive file id');
    const maxBytes = kind === 'VIDEO' ? this.maxVideoBytes : this.maxImageBytes;
    const headers = { 'user-agent': BROWSER_UA };

    const first = await this.fetchWithTimeout(`https://drive.google.com/uc?export=download&id=${fileId}`, { headers }, this.pageTimeoutMs);
    if (!first) throw new Error('Drive did not respond');
    const contentType = (first.headers.get('content-type') ?? '').toLowerCase();

    if (!contentType.includes('text/html')) {
      return this.consume(first, { kind, maxBytes, sourceType: 'GOOGLE_DRIVE', sourceUrl: driveUrl, nameHint: `drive-${fileId}` });
    }

    const page = await first.text();
    if (/accounts\.google\.com|ServiceLogin|\/signin\//i.test(first.url) || /accounts\.google\.com\/(?:v3\/)?signin/i.test(page)) {
      throw new Error('the file is not shared as "anyone with the link"');
    }
    if (/quota exceeded|too many users have viewed or downloaded/i.test(page)) {
      throw new Error('Drive is rate-limiting downloads of this file right now');
    }
    const uuid = /name="uuid"\s+value="([^"]+)"/.exec(page)?.[1];
    const confirm = /name="confirm"\s+value="([^"]+)"/.exec(page)?.[1] ?? 't';
    const action = /<form[^>]+action="([^"]+)"/.exec(page)?.[1] ?? 'https://drive.usercontent.google.com/download';
    if (!uuid && !/download/i.test(action)) throw new Error('Drive returned a page instead of the file');

    const second = new URL(action.startsWith('http') ? action : `https://drive.usercontent.google.com${action}`);
    second.searchParams.set('id', fileId);
    second.searchParams.set('export', 'download');
    second.searchParams.set('confirm', confirm);
    if (uuid) second.searchParams.set('uuid', uuid);

    return this.download(second.toString(), { kind, maxBytes, sourceType: 'GOOGLE_DRIVE', sourceUrl: driveUrl, headers, nameHint: `drive-${fileId}` });
  }

  /**
   * Load a page and say precisely why when it cannot be loaded. "Could not be
   * loaded" hides the one fact that decides the fix: a 4xx from Facebook means
   * the server's address is being refused, a timeout means the network, a
   * redirect to /login means the post is not public.
   */
  private async fetchPage(url: string, userAgent: string): Promise<{ html: string } | { failure: string }> {
    const attempt = await this.fetchDetailed(
      url,
      { headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9' } },
      this.pageTimeoutMs,
    );
    if ('error' in attempt) return { failure: attempt.error };
    const response = attempt.response;
    if (/\/login\/?\?|\/checkpoint\//i.test(response.url)) return { failure: `Facebook redirected to ${new URL(response.url).pathname}, so the post is not public` };
    if (!response.ok) return { failure: `Facebook answered HTTP ${response.status} for the post page (final URL ${new URL(response.url).host})` };
    return { html: await response.text() };
  }

  private async download(
    url: string,
    options: { kind: 'VIDEO' | 'STATIC'; maxBytes: number; sourceType: LinkSourceType; sourceUrl: string; headers: Record<string, string>; nameHint: string },
  ): Promise<FetchedMedia> {
    const response = await this.fetchWithTimeout(url, { headers: options.headers }, this.downloadTimeoutMs);
    if (!response) throw new Error('the download did not respond in time');
    return this.consume(response, options);
  }

  /** Stream a response to disk under the byte cap, then identify what arrived. */
  private async consume(
    response: Response,
    options: { kind: 'VIDEO' | 'STATIC'; maxBytes: number; sourceType: LinkSourceType; sourceUrl: string; nameHint: string },
  ): Promise<FetchedMedia> {
    if (!response.ok || !response.body) throw new Error(`the file request returned HTTP ${response.status}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > options.maxBytes) throw new Error(`the file is ${Math.round(declared / 1048576)} MB, over the ${Math.round(options.maxBytes / 1048576)} MB limit`);

    const directory = this.tmpDir();
    await mkdir(directory, { recursive: true });
    const partial = join(directory, `link-${randomUUID()}.part`);

    let size = 0;
    let head = Buffer.alloc(0);
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16);
        if (size > options.maxBytes) {
          callback(new Error(`the file exceeded the ${Math.round(options.maxBytes / 1048576)} MB limit`));
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(Readable.fromWeb(response.body as unknown as import('stream/web').ReadableStream), counter, createWriteStream(partial));
    } catch (error) {
      await unlink(partial).catch(() => undefined);
      throw error;
    }

    const extension = resolveExtension(response.headers.get('content-type'), head, options.kind);
    if (!extension || size === 0) {
      await unlink(partial).catch(() => undefined);
      throw new Error(
        options.kind === 'VIDEO'
          ? 'what came back is not a video file'
          : 'what came back is not an image file',
      );
    }

    const finalPath = partial.replace(/\.part$/, `.${extension}`);
    await rename(partial, finalPath);
    const disposition = response.headers.get('content-disposition') ?? '';
    const named = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] ?? /filename="([^"]+)"/i.exec(disposition)?.[1];
    const originalname = named ? decodeURIComponent(named) : `${options.nameHint}.${extension}`;

    this.logger.log(`Fetched ${options.sourceType} media (${Math.round(size / 1024)} KB, .${extension}) for analysis`);
    return { path: finalPath, originalname, mimetype: MIME_BY_EXT[extension], size, sourceType: options.sourceType, sourceUrl: options.sourceUrl };
  }

  private tmpDir() {
    return resolve(process.env.CREATIVE_AI_UPLOAD_TMP_DIR || join(process.cwd(), 'tmp', 'creative-ai-uploads'));
  }

  private async fetchDetailed(url: string, init: RequestInit, timeoutMs: number): Promise<{ response: Response } | { error: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return { response: await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' }) };
    } catch (error) {
      const text = message(error);
      const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
      const detail = cause?.code ?? cause?.message ?? '';
      if (controller.signal.aborted) return { error: `the request timed out after ${Math.round(timeoutMs / 1000)} s` };
      return { error: `network error: ${detail || text}` };
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
    } catch (error) {
      this.logger.debug(`fetch failed for ${url}: ${message(error)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
