"use client";

import { detectSpendCurrency, readHeaderLine } from "./meta-upload-currency";

export type PendingMetaUploadStatus = "ready" | "uploading" | "done" | "failed";

export type PendingMetaUpload = {
  id: string;
  file: File;
  /** Spend currency read from the file's own header; null when absent. */
  currency: string | null;
  /** True when the entered conversion rate will be applied to this file. */
  needsMultiplier: boolean;
  status: PendingMetaUploadStatus;
  error?: string;
};

/**
 * Inspects each file's header so the modal can state, per file, whether a
 * conversion will happen. XLSX headers are only readable server-side, so those
 * report an unknown currency and are described once the import runs.
 */
export async function buildPendingUploads(files: File[]): Promise<PendingMetaUpload[]> {
  return Promise.all(files.map(async (file, index) => {
    const id = `${file.name}:${file.size}:${file.lastModified}:${index}`;
    if (!/\.csv$/i.test(file.name)) {
      return { id, file, currency: null, needsMultiplier: false, status: "ready" as const };
    }
    try {
      const header = await readHeaderLine(file);
      const { currency, needsMultiplier } = detectSpendCurrency(header);
      return { id, file, currency, needsMultiplier, status: "ready" as const };
    } catch {
      return { id, file, currency: null, needsMultiplier: false, status: "ready" as const };
    }
  }));
}

/** True when at least one queued CSV will have a conversion rate applied. */
export function queueNeedsMultiplier(pending: PendingMetaUpload[]): boolean {
  return pending.some((item) => item.needsMultiplier);
}

/** Files whose currency could not be read from the header. */
export function unknownCurrencyFiles(pending: PendingMetaUpload[]): PendingMetaUpload[] {
  return pending.filter((item) => item.currency === null && /\.csv$/i.test(item.file.name));
}

/**
 * Queued CSVs whose own header contradicts the selected currency.
 *
 * The import always follows the file, so this surfaces the disagreement rather
 * than letting the modal imply a conversion that will not happen.
 */
export function mismatchedCurrencyFiles(
  pending: PendingMetaUpload[],
  selected: "PHP" | "USD",
): PendingMetaUpload[] {
  return pending.filter((item) => item.currency !== null && item.currency !== selected);
}
