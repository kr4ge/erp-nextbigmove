import sharp = require('sharp');

/**
 * Timestamp labels for contact sheets, drawn without fonts.
 *
 * ffmpeg's drawtext needs libfreetype and an installed font; the production
 * image has no fonts and the local build has no drawtext at all. So the twelve
 * characters a label needs were rendered once into a small bitmap sprite, and
 * a label is composed from it at run time. It looks the same on every machine
 * and can never silently vanish because a font was missing.
 */

const GLYPH_CHARS = '0123456789.s';
const GLYPH_WIDTH = 15;
const GLYPH_HEIGHT = 26;
const SPRITE_BASE64 = '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';

export type LabelTone = 'DARK' | 'ACCENT';

let glyphCache: Promise<Map<string, Buffer>> | null = null;

async function glyphs(): Promise<Map<string, Buffer>> {
  if (!glyphCache) {
    glyphCache = (async () => {
      const sprite = Buffer.from(SPRITE_BASE64, 'base64');
      const map = new Map<string, Buffer>();
      for (let index = 0; index < GLYPH_CHARS.length; index += 1) {
        map.set(
          GLYPH_CHARS[index],
          await sharp(sprite).extract({ left: index * GLYPH_WIDTH, top: 0, width: GLYPH_WIDTH, height: GLYPH_HEIGHT }).png().toBuffer(),
        );
      }
      return map;
    })();
  }
  return glyphCache;
}

/**
 * A label such as "12.5s" on a rounded dark plate, or an amber plate for the
 * first frame of a detected scene. Characters outside the sprite are dropped.
 */
export async function renderStampLabel(text: string, tone: LabelTone = 'DARK'): Promise<{ buffer: Buffer; width: number; height: number }> {
  const map = await glyphs();
  const chars = [...text].filter((char) => map.has(char));
  const padX = 8;
  const padY = 3;
  const width = padX * 2 + Math.max(1, chars.length) * GLYPH_WIDTH;
  const height = GLYPH_HEIGHT + padY * 2;
  const background = tone === 'ACCENT' ? { r: 180, g: 83, b: 9, alpha: 0.92 } : { r: 0, g: 0, b: 0, alpha: 0.72 };
  const buffer = await sharp({ create: { width, height, channels: 4, background } })
    .composite(chars.map((char, index) => ({ input: map.get(char)!, left: padX + index * GLYPH_WIDTH, top: padY })))
    .png()
    .toBuffer();
  return { buffer, width, height };
}
