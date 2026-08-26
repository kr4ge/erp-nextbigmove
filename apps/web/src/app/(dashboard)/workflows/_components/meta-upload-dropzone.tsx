"use client";

import { useRef, type ClipboardEvent, type DragEvent } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import type { PendingMetaUpload } from "../_utils/meta-upload-queue";

const ACCEPTED = ".csv,.xlsx,.xls";

function isSpreadsheet(file: File): boolean {
  return /\.(csv|xlsx|xls)$/i.test(file.name);
}

/**
 * Multi-file picker for Meta exports: click, drag-and-drop, or paste.
 *
 * Mirrors the proof-upload dropzone in orders so the two behave the same, with
 * the difference that this one accumulates a queue rather than holding a single
 * file — a month of Meta data usually arrives as one export per account.
 */
export function MetaUploadDropzone({ pending, disabled, onAdd, onRemove }: {
  pending: PendingMetaUpload[];
  disabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (files: FileList | File[] | null) => {
    if (disabled || !files) return;
    const spreadsheets = Array.from(files).filter(isSpreadsheet);
    if (spreadsheets.length) onAdd(spreadsheets);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files).filter(isSpreadsheet);
    if (!files.length) return;
    event.preventDefault();
    accept(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    accept(event.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="form-label">Upload files</label>
        {pending.length > 0 ? (
          <span className="text-xs text-muted">{pending.length} file{pending.length === 1 ? '' : 's'} queued</span>
        ) : null}
      </div>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => { if (!disabled) inputRef.current?.click(); }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onPaste={handlePaste}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className={`rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center outline-none transition ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/15"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            accept(event.target.files);
            // Allow re-picking the same file after removing it from the queue.
            event.target.value = "";
          }}
        />
        <Upload className="mx-auto h-6 w-6 text-muted" />
        <p className="mt-2 text-sm font-medium text-foreground">
          Drop files here, paste, or click to browse
        </p>
        <p className="mt-1 text-xs text-muted">
          CSV, XLSX or XLS. Add one export per Meta account — they upload one after another.
        </p>
      </div>

      {pending.length > 0 ? (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
          {pending.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background-secondary px-3 py-2"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{item.file.name}</p>
                <p className="text-xs text-muted">{describe(item)}</p>
              </div>
              {!disabled ? (
                <button
                  type="button"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => onRemove(item.id)}
                  className="shrink-0 rounded-lg p-1 text-muted transition hover:bg-secondary/40 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** One line per file describing what the import will actually do with it. */
function describe(item: PendingMetaUpload): string {
  const size = `${(item.file.size / 1024).toFixed(0)} KB`;
  if (item.status === "done") return `${size} · imported`;
  if (item.status === "failed") return `${size} · ${item.error ?? "failed"}`;
  if (item.status === "uploading") return `${size} · importing…`;
  if (item.currency === null) return `${size} · currency missing from the spend column`;
  return item.needsMultiplier
    ? `${size} · ${item.currency} — conversion rate applies`
    : `${size} · ${item.currency} — no conversion`;
}
