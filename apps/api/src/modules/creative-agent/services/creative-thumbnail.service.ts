import { Injectable, Logger } from '@nestjs/common';
import { MediaAssetKind } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MediaAssetsService } from '../../../common/services/media-assets.service';

/**
 * Resolves a Facebook post link into a cached cover image.
 *
 * Facebook exposes no public thumbnail endpoint the way Google Drive does, and
 * the Graph API requires a token. What IS public is the post page's Open Graph
 * metadata: requesting it with a crawler user-agent returns an `og:image`
 * pointing at the post's cover frame — for photo posts, videos, and reels
 * alike (a video post's og:image is the frame Facebook shows before playback).
 *
 * That CDN URL carries an `oe=` expiry roughly four days out, so the bytes are
 * copied into object storage once and served from there. Storing the URL
 * instead would leave every registry tile broken within the week.
 *
 * This is a scrape, not a supported API: it can break if Meta changes their
 * markup, and it only works for public posts. Every failure path degrades to
 * "no thumbnail" so a creative can always still be saved.
 */
@Injectable()
export class CreativeThumbnailService {
  private readonly logger = new Logger(CreativeThumbnailService.name);
  private readonly fetchTimeoutMs = 10_000;
  private readonly maxImageBytes = 8 * 1024 * 1024;
  /** Facebook serves OG metadata to recognised crawlers. */
  private readonly crawlerUserAgent = 'facebookexternalhit/1.1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaAssets: MediaAssetsService,
  ) {}

  /**
   * Best-effort refresh of a creative's cached thumbnail. Never throws: a
   * failed capture leaves the creative untouched and the UI falls back to its
   * placeholder tile.
   */
  async captureForCreative(creativeId: string, tenantId: string, postUrl: string | null | undefined): Promise<void> {
    if (!postUrl || !this.isFacebookPostUrl(postUrl)) return;
    try {
      const meta = await this.fetchOpenGraph(postUrl);
      if (!meta?.imageUrl) return;

      const image = await this.downloadImage(meta.imageUrl);
      if (!image) return;

      const asset = await this.mediaAssets.uploadCreativeThumbnailImage(
        {
          buffer: image.buffer,
          mimetype: image.contentType,
          size: image.buffer.byteLength,
          originalname: 'facebook-post-cover',
        },
        tenantId,
      );

      const previous = await this.prisma.creative.findFirst({
        where: { id: creativeId, tenantId },
        select: { thumbnailAssetId: true },
      });

      await this.prisma.creative.updateMany({
        where: { id: creativeId, tenantId },
        data: {
          thumbnailAssetId: asset.assetId,
          thumbnailSourceUrl: postUrl,
          thumbnailCapturedAt: new Date(),
          thumbnailIsVideo: meta.isVideo,
        },
      });

      // Drop the superseded asset so replacing a post link does not leak objects.
      if (previous?.thumbnailAssetId && previous.thumbnailAssetId !== asset.assetId) {
        await this.mediaAssets
          .deleteUnattachedImageAsset(previous.thumbnailAssetId, tenantId, MediaAssetKind.CREATIVE_THUMBNAIL_IMAGE)
          .catch(() => undefined);
      }
    } catch (error) {
      this.logger.warn(
        `Thumbnail capture failed for creative ${creativeId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Clears a cached thumbnail when the post link is removed. */
  async clearForCreative(creativeId: string, tenantId: string): Promise<void> {
    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId },
      select: { thumbnailAssetId: true },
    });
    if (!creative?.thumbnailAssetId) return;
    await this.prisma.creative.updateMany({
      where: { id: creativeId, tenantId },
      data: { thumbnailAssetId: null, thumbnailSourceUrl: null, thumbnailCapturedAt: null, thumbnailIsVideo: false },
    });
    await this.mediaAssets
      .deleteUnattachedImageAsset(creative.thumbnailAssetId, tenantId, MediaAssetKind.CREATIVE_THUMBNAIL_IMAGE)
      .catch(() => undefined);
  }

  isFacebookPostUrl(value: string): boolean {
    try {
      const url = new URL(value.trim());
      if (url.protocol !== 'https:') return false;
      return /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/i.test(url.hostname);
    } catch {
      return false;
    }
  }

  /** Reads og:image and og:type from the public post page. */
  private async fetchOpenGraph(postUrl: string): Promise<{ imageUrl: string; isVideo: boolean } | null> {
    const response = await this.fetchWithTimeout(postUrl, {
      headers: { 'user-agent': this.crawlerUserAgent, accept: 'text/html' },
    });
    if (!response?.ok) return null;
    const html = await response.text();

    const imageUrl = this.readOgTag(html, 'og:image');
    if (!imageUrl) return null;
    const ogType = this.readOgTag(html, 'og:type') ?? '';
    return { imageUrl, isVideo: ogType.toLowerCase().startsWith('video') };
  }

  private readOgTag(html: string, property: string): string | null {
    const pattern = new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i',
    );
    const match = pattern.exec(html) ?? new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      'i',
    ).exec(html);
    if (!match?.[1]) return null;
    return this.decodeHtmlEntities(match[1]);
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&#x2F;/gi, '/')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  private async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const response = await this.fetchWithTimeout(imageUrl, {
      headers: { 'user-agent': this.crawlerUserAgent },
    });
    if (!response?.ok) return null;

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!contentType.startsWith('image/')) return null;

    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > this.maxImageBytes) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > this.maxImageBytes) return null;
    return { buffer, contentType };
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
