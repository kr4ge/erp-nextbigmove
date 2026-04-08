const EAN13_LEFT_ODD_PATTERNS: Record<string, string> = {
  "0": "0001101",
  "1": "0011001",
  "2": "0010011",
  "3": "0111101",
  "4": "0100011",
  "5": "0110001",
  "6": "0101111",
  "7": "0111011",
  "8": "0110111",
  "9": "0001011",
};

const EAN13_LEFT_EVEN_PATTERNS: Record<string, string> = {
  "0": "0100111",
  "1": "0110011",
  "2": "0011011",
  "3": "0100001",
  "4": "0011101",
  "5": "0111001",
  "6": "0000101",
  "7": "0010001",
  "8": "0001001",
  "9": "0010111",
};

const EAN13_RIGHT_PATTERNS: Record<string, string> = {
  "0": "1110010",
  "1": "1100110",
  "2": "1101100",
  "3": "1000010",
  "4": "1011100",
  "5": "1001110",
  "6": "1010000",
  "7": "1000100",
  "8": "1001000",
  "9": "1110100",
};

const EAN13_PARITY_PATTERNS: Record<string, string> = {
  "0": "LLLLLL",
  "1": "LLGLGG",
  "2": "LLGGLG",
  "3": "LLGGGL",
  "4": "LGLLGG",
  "5": "LGGLLG",
  "6": "LGGGLL",
  "7": "LGLGLG",
  "8": "LGLGGL",
  "9": "LGGLGL",
};
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213",
  "122312", "132212", "221213", "221312", "231212", "112232", "122132",
  "122231", "113222", "123122", "123221", "223211", "221132", "221231",
  "213212", "223112", "312131", "311222", "321122", "321221", "312212",
  "322112", "322211", "212123", "212321", "232121", "111323", "131123",
  "131321", "112313", "132113", "132311", "211313", "231113", "231311",
  "112133", "112331", "132131", "113123", "113321", "133121", "313121",
  "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111",
  "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114",
  "413111", "241112", "134111", "111242", "121142", "121241", "114212",
  "124112", "124211", "411212", "421112", "421211", "212141", "214121",
  "412121", "111143", "111341", "131141", "114113", "114311", "411113",
  "411311", "113141", "114131", "311141", "411131", "211412", "211214",
  "211232", "2331112",
] as const;

export function isEan13Barcode(value?: string | null) {
  return /^\d{13}$/.test(value || "");
}

export function getEan13BitPattern(value?: string | null) {
  if (!isEan13Barcode(value)) {
    return null;
  }

  const digits = value!.split("");
  const parity = EAN13_PARITY_PATTERNS[digits[0]];
  if (!parity) {
    return null;
  }

  let bits = "101";

  for (let index = 1; index <= 6; index += 1) {
    const digit = digits[index];
    bits += parity[index - 1] === "L"
      ? EAN13_LEFT_ODD_PATTERNS[digit]
      : EAN13_LEFT_EVEN_PATTERNS[digit];
  }

  bits += "01010";

  for (let index = 7; index <= 12; index += 1) {
    bits += EAN13_RIGHT_PATTERNS[digits[index]];
  }

  return bits + "101";
}

export function isCode128BValue(value?: string | null) {
  return /^[\x20-\x7E]+$/.test(value || "");
}

export function getCode128BCodewords(value?: string | null) {
  if (!value || !isCode128BValue(value)) {
    return null;
  }

  const startB = 104;
  const data = value.split("").map((character) => character.charCodeAt(0) - 32);
  const checksum =
    (startB + data.reduce((sum, code, index) => sum + code * (index + 1), 0)) %
    103;

  return [startB, ...data, checksum, 106];
}

export function getCode128BPattern(value?: string | null) {
  const codewords = getCode128BCodewords(value);
  if (!codewords) {
    return null;
  }

  return codewords
    .map((codeword) => CODE128_PATTERNS[codeword])
    .filter(Boolean);
}
