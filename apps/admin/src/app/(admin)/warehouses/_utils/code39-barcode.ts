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

const CODE128_PATTERNS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
] as const;

const CODE128_START_B = 104;
const CODE128_STOP = 106;

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

type RenderCode128SvgOptions = {
  height?: number;
  moduleWidth?: number;
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

export function normalizeBarcodeValue(value: string) {
  const withoutControlCharacters = Array.from(value.normalize('NFKC'))
    .filter((symbol) => {
      const code = symbol.charCodeAt(0);

      return code > 31 && code !== 127 && !/[\u200B-\u200D\uFEFF]/u.test(symbol);
    })
    .join('');

  return withoutControlCharacters
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeCode39Value(value: string) {
  return normalizeBarcodeValue(value);
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

export function renderCode128SvgMarkup(value: string, options: RenderCode128SvgOptions = {}) {
  const normalizedValue = normalizeBarcodeValue(value);
  if (!normalizedValue) {
    throw new Error('Barcode value is required');
  }

  const dataCodes = Array.from(normalizedValue).map((symbol) => {
    const charCode = symbol.charCodeAt(0);

    if (charCode < 32 || charCode > 127) {
      throw new Error(`Unsupported Code128 character: ${symbol}`);
    }

    return charCode - 32;
  });

  const checksum =
    (CODE128_START_B + dataCodes.reduce((total, code, index) => total + code * (index + 1), 0)) % 103;
  const encodedCodes = [CODE128_START_B, ...dataCodes, checksum, CODE128_STOP];

  const height = options.height ?? 96;
  const moduleWidth = options.moduleWidth ?? 2;
  const quietZone = options.quietZone ?? Math.max(20, moduleWidth * 10);
  const textSize = options.textSize ?? 14;
  const barColor = options.barColor ?? '#0f3040';
  const backgroundColor = options.backgroundColor ?? '#ffffff';
  const showText = options.showText ?? true;

  let cursorX = 0;
  const bars: Array<{ x: number; width: number }> = [];

  encodedCodes.forEach((code) => {
    const pattern = CODE128_PATTERNS[code];

    if (!pattern) {
      throw new Error(`Unsupported Code128 code: ${code}`);
    }

    Array.from(pattern).forEach((widthToken, patternIndex) => {
      const segmentWidth = Number(widthToken) * moduleWidth;
      const isBar = patternIndex % 2 === 0;

      if (isBar) {
        bars.push({ x: cursorX, width: segmentWidth });
      }

      cursorX += segmentWidth;
    });
  });

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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" role="img" aria-label="Code128 ${escapedText}" shape-rendering="crispEdges"><rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${backgroundColor}" />${barRects}${textMarkup}</svg>`;
}
