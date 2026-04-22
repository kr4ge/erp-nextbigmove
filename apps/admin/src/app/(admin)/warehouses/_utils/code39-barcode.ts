const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnn',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};

type RenderCode39SvgOptions = {
  height?: number;
  narrowWidth?: number;
  wideWidth?: number;
  quietZone?: number;
  textSize?: number;
  barColor?: string;
  backgroundColor?: string;
  showText?: boolean;
};

function escapeXml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function normalizeCode39Value(value: string) {
  return value.trim().toUpperCase();
}

export function renderCode39SvgMarkup(value: string, options: RenderCode39SvgOptions = {}) {
  const normalizedValue = normalizeCode39Value(value);
  if (!normalizedValue) {
    throw new Error('Barcode value is required');
  }

  const encodedValue = `*${normalizedValue}*`;

  const height = options.height ?? 88;
  const narrowWidth = options.narrowWidth ?? 2;
  const wideWidth = options.wideWidth ?? 5;
  const quietZone = options.quietZone ?? 14;
  const textSize = options.textSize ?? 13;
  const barColor = options.barColor ?? '#0f3040';
  const backgroundColor = options.backgroundColor ?? '#ffffff';
  const showText = options.showText ?? true;

  let cursorX = 0;
  const bars: Array<{ x: number; width: number }> = [];

  for (let charIndex = 0; charIndex < encodedValue.length; charIndex += 1) {
    const symbol = encodedValue[charIndex];
    const pattern = CODE39_PATTERNS[symbol];

    if (!pattern) {
      throw new Error(`Unsupported Code39 character: ${symbol}`);
    }

    for (let patternIndex = 0; patternIndex < pattern.length; patternIndex += 1) {
      const token = pattern[patternIndex];
      const segmentWidth = token === 'w' ? wideWidth : narrowWidth;
      const isBar = patternIndex % 2 === 0;

      if (isBar) {
        bars.push({ x: cursorX, width: segmentWidth });
      }

      cursorX += segmentWidth;
    }

    if (charIndex < encodedValue.length - 1) {
      cursorX += narrowWidth;
    }
  }

  const totalWidth = cursorX + (quietZone * 2);
  const textSpace = showText ? textSize + 12 : 0;
  const totalHeight = height + textSpace;

  const barRects = bars
    .map(
      (bar) =>
        `<rect x="${bar.x + quietZone}" y="0" width="${bar.width}" height="${height}" fill="${barColor}" />`,
    )
    .join('');

  const escapedText = escapeXml(normalizedValue);
  const textMarkup = showText
    ? `<text x="${totalWidth / 2}" y="${height + textSize + 2}" text-anchor="middle" font-size="${textSize}" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial" fill="${barColor}" letter-spacing="0.06em">${escapedText}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" role="img" aria-label="Code39 ${escapedText}"><rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${backgroundColor}" />${barRects}${textMarkup}</svg>`;
}

