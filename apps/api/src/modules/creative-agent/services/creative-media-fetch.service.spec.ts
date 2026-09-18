import { describe, expect, it } from '@jest/globals';
import {
  extractGoogleDriveFileId,
  findFacebookImageUrl,
  findFacebookVideoUrls,
  isFacebookUrl,
  isGoogleDriveUrl,
  resolveExtension,
  sniffMedia,
} from './creative-media-fetch.service';

/**
 * The engine's parsers are pure, so they are tested without the network. The
 * shapes below are copied from real responses observed while building this.
 */
describe('link recognition', () => {
  it('accepts the Facebook hosts the registry already validates', () => {
    expect(isFacebookUrl('https://www.facebook.com/page/videos/123/')).toBe(true);
    expect(isFacebookUrl('https://fb.watch/abc/')).toBe(true);
    expect(isFacebookUrl('https://drive.google.com/file/d/x/view')).toBe(false);
    expect(isFacebookUrl(null)).toBe(false);
  });

  it('accepts Drive share links on either Google host', () => {
    expect(isGoogleDriveUrl('https://drive.google.com/file/d/1abc/view')).toBe(true);
    expect(isGoogleDriveUrl('https://docs.google.com/uc?id=1abc')).toBe(true);
    expect(isGoogleDriveUrl('https://www.facebook.com/x')).toBe(false);
  });
});

describe('extractGoogleDriveFileId', () => {
  it('reads every share-link shape Drive hands out', () => {
    expect(extractGoogleDriveFileId('https://drive.google.com/file/d/1l_5RK28JRL19wpT22B-DY9We3TVXnnQQ/view?usp=sharing')).toBe('1l_5RK28JRL19wpT22B-DY9We3TVXnnQQ');
    expect(extractGoogleDriveFileId('https://drive.google.com/open?id=1l_5RK28JRL19wpT22B-DY9We3TVXnnQQ')).toBe('1l_5RK28JRL19wpT22B-DY9We3TVXnnQQ');
    expect(extractGoogleDriveFileId('https://drive.google.com/uc?export=download&id=1l_5RK28JRL19wpT22B-DY9We3TVXnnQQ')).toBe('1l_5RK28JRL19wpT22B-DY9We3TVXnnQQ');
  });

  it('returns null for a folder or an unrelated link', () => {
    expect(extractGoogleDriveFileId('https://drive.google.com/drive/folders/abc')).toBeNull();
    expect(extractGoogleDriveFileId('https://example.com')).toBeNull();
  });
});

describe('findFacebookVideoUrls', () => {
  const html = `... "browser_native_sd_url":"https:\\/\\/video.fmnl25-8.fna.fbcdn.net\\/o1\\/v\\/sd.mp4?x=1&y=2" ...
    "browser_native_hd_url":"https:\\/\\/video.fmnl25-8.fna.fbcdn.net\\/o1\\/v\\/hd.mp4?x=1" ...
    "browser_native_hd_url":"https:\\/\\/video.fmnl25-8.fna.fbcdn.net\\/o1\\/v\\/hd.mp4?x=1" ...`;

  it('returns HD before SD, JSON-unescaped and de-duplicated', () => {
    // The page escapes slashes inside JSON strings; the download must use the
    // real URL, and the best quality should be tried first.
    expect(findFacebookVideoUrls(html)).toEqual([
      'https://video.fmnl25-8.fna.fbcdn.net/o1/v/hd.mp4?x=1',
      'https://video.fmnl25-8.fna.fbcdn.net/o1/v/sd.mp4?x=1&y=2',
    ]);
  });

  it('ignores the crawler-only proxy links, which serve HTML instead of video', () => {
    // Requested as a crawler, the page lists lookaside.fbsbx.com proxies. From
    // every address tested they answer with an HTML page, so treating them as
    // downloads would only produce a confusing "not a video file" failure.
    const proxied = '"browser_native_hd_url":"https:\\/\\/lookaside.fbsbx.com\\/lookaside\\/crawler\\/media\\/?media_id=1"';
    expect(findFacebookVideoUrls(proxied)).toEqual([]);
  });

  it('finds nothing on a page with no player data', () => {
    expect(findFacebookVideoUrls('<html><body>login</body></html>')).toEqual([]);
  });
});

describe('findFacebookImageUrl', () => {
  it('reads og:image in either attribute order and decodes entities', () => {
    expect(findFacebookImageUrl('<meta property="og:image" content="https://scontent.x/a.jpg?a=1&amp;b=2" />')).toBe('https://scontent.x/a.jpg?a=1&b=2');
    expect(findFacebookImageUrl("<meta content='https://scontent.x/b.jpg' property='og:image'>")).toBe('https://scontent.x/b.jpg');
  });

  it('falls back to the inline full-size image', () => {
    expect(findFacebookImageUrl('{"image":{"uri":"https:\\/\\/scontent.x\\/full.jpg","width":1080}}')).toBe('https://scontent.x/full.jpg');
  });

  it('returns null when there is no image at all', () => {
    expect(findFacebookImageUrl('<html></html>')).toBeNull();
  });
});

describe('sniffMedia and resolveExtension', () => {
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(8)]);
  const mov = Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from('ftypqt  '), Buffer.alloc(8)]);
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]);

  it('identifies files by their first bytes', () => {
    expect(sniffMedia(mp4)).toBe('mp4');
    expect(sniffMedia(mov)).toBe('mov');
    expect(sniffMedia(webm)).toBe('webm');
    expect(sniffMedia(jpg)).toBe('jpg');
    expect(sniffMedia(png)).toBe('png');
    expect(sniffMedia(webp)).toBe('webp');
    expect(sniffMedia(Buffer.from('<!DOCTYPE html>'))).toBeNull();
  });

  it('trusts the bytes over a vague declared type', () => {
    // Drive answers application/octet-stream; the bytes still say mp4.
    expect(resolveExtension('application/octet-stream', mp4, 'VIDEO')).toBe('mp4');
  });

  it('accepts a declared type when the bytes are not recognisable', () => {
    expect(resolveExtension('video/webm', Buffer.alloc(16), 'VIDEO')).toBe('webm');
  });

  it('refuses a file of the wrong kind for the creative', () => {
    // A video creative must never be analysed from a poster image, and vice
    // versa: the pipeline would produce a confident review of the wrong thing.
    expect(resolveExtension('image/jpeg', jpg, 'VIDEO')).toBeNull();
    expect(resolveExtension('video/mp4', mp4, 'STATIC')).toBeNull();
  });

  it('refuses HTML that came back instead of a file', () => {
    expect(resolveExtension('text/html; charset=utf-8', Buffer.from('<!DOCTYPE html>'), 'VIDEO')).toBeNull();
  });
});
