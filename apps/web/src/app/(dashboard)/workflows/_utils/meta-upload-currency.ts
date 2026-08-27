"use client";

export const DEFAULT_CURRENCY_MULTIPLIER = "62";

export type DetectedCurrency = {
  /** Three-letter code from the spend header, or null when absent. */
  currency: string | null;
  /** True when a conversion rate will actually be applied to this file. */
  needsMultiplier: boolean;
};

/**
 * Mirrors the server's detection in `resolveManualUploadMultiplier`: the spend
 * currency comes from the `Amount spent (USD)` header suffix, NOT from user
 * input. Kept identical on purpose — if the UI guessed differently it would
 * report a conversion the import does not perform, and spend feeds every CPP,
 * ROAS and break-even figure downstream.
 */
export function detectSpendCurrency(headerLine: string): DetectedCurrency {
  const headers = splitCsvLine(headerLine);
  const spendHeader = headers.find((header) =>
    /amount\s*spent/i.test(header)) ?? "";
  const match = spendHeader.match(/\(([A-Z]{3})\)\s*$/i);
  const currency = match?.[1]?.toUpperCase() ?? null;
  return { currency, needsMultiplier: Boolean(currency) && currency !== "PHP" };
}

/**
 * Minimal CSV header splitter: handles quoted fields containing commas, which
 * Meta exports produce for campaign names.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out.map((value) => value.replace(/^"|"$/g, "").trim());
}

/** Reads just the first line so a large export is not pulled into memory. */
export async function readHeaderLine(file: File): Promise<string> {
  const slice = file.slice(0, 64 * 1024);
  const text = await slice.text();
  return text.split(/\r?\n/, 1)[0] ?? "";
}
