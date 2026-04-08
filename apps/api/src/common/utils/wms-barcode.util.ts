import { createHash } from "crypto";

function buildNumericSeed(source: string, length: number) {
  let digits = "";
  let round = 0;

  while (digits.length < length) {
    const digest = createHash("sha256")
      .update(`${source}:${round}`)
      .digest();

    for (const byte of digest) {
      digits += `${byte % 10}`;
      if (digits.length >= length) {
        break;
      }
    }

    round += 1;
  }

  return digits.slice(0, length);
}

export function computeEan13CheckDigit(base12: string) {
  if (!/^\d{12}$/.test(base12)) {
    throw new Error("EAN-13 base must be 12 digits");
  }

  const total = base12
    .split("")
    .map((digit) => Number(digit))
    .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3), 0);

  return `${(10 - (total % 10)) % 10}`;
}

function buildEan13(prefixDigit: string, seedSource: string) {
  const base12 = `${prefixDigit}${buildNumericSeed(seedSource, 11)}`;
  return `${base12}${computeEan13CheckDigit(base12)}`;
}

export function generateWmsSkuProfileBarcode(seedSource: string) {
  return buildEan13("1", `SKU:${seedSource}`);
}

export function generateWmsLocationBarcode(seedSource: string) {
  return buildEan13("2", `LOC:${seedSource}`);
}

export function generateWmsInventoryUnitBarcodeFromSerial(
  serialNo: bigint | number | string,
) {
  const normalized = `${serialNo}`.replace(/\D/g, "");
  if (!normalized) {
    throw new Error("Unit serial number is required to build barcode");
  }

  if (normalized.length > 9) {
    throw new Error("Unit serial number exceeds warehouse unit barcode capacity");
  }

  return `WCU${normalized.padStart(9, "0")}`;
}

export function isEan13Barcode(value?: string | null) {
  return /^\d{13}$/.test(value || "");
}
