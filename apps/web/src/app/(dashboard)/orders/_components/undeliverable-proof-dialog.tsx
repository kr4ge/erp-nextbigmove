'use client';

import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import Image from 'next/image';
import { Clipboard, Image as ImageIcon, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UndeliverableRow } from '../_types/undeliverables';

const MAX_PROOF_BYTES = 30 * 1024 * 1024;
const ACCEPTED_PROOF_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type UndeliverableProofDialogProps = {
  open: boolean;
  row: UndeliverableRow | null;
  remark: string;
  onClose: () => void;
  onSubmit: (file: File) => Promise<void>;
};

export function UndeliverableProofDialog({
  open,
  row,
  remark,
  onClose,
  onSubmit,
}: UndeliverableProofDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setError(null);
      setIsSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [file]);

  const selectFile = (nextFile: File | null) => {
    if (!nextFile) return;
    if (!ACCEPTED_PROOF_TYPES.has(nextFile.type)) {
      setError('Upload a PNG, JPEG, or WebP image.');
      return;
    }
    if (nextFile.size > MAX_PROOF_BYTES) {
      setError('Proof image must be 30 MB or smaller.');
      return;
    }
    setFile(nextFile);
    setError(null);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const pastedFile = Array.from(event.clipboardData.files).find((item) =>
      item.type.startsWith('image/'));
    if (!pastedFile) {
      setError('The clipboard does not contain an image.');
      return;
    }
    event.preventDefault();
    selectFile(pastedFile);
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Add a proof image before saving the remark.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(file);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save the remark and proof.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !isSaving && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Attach proof for SA remark</DialogTitle>
          <DialogDescription>
            Order #{row?.pos_order_id ?? '-'} · {row?.store_name ?? '-'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-background-secondary px-4 py-3">
            <p className="text-xs font-semibold uppercase text-muted">Selected remark</p>
            <p className="mt-1 text-sm font-medium text-foreground">{remark}</p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onPaste={handlePaste}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              selectFile(event.dataTransfer.files[0] ?? null);
            }}
            className="rounded-xl border border-dashed border-border bg-surface p-4 outline-none transition hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            />

            {previewUrl ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl border border-border bg-background-secondary">
                  <Image
                    src={previewUrl}
                    alt="SA remark proof preview"
                    width={960}
                    height={720}
                    unoptimized
                    className="max-h-80 w-full object-contain"
                  />
                  <button
                    type="button"
                    aria-label="Remove selected proof"
                    className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-foreground shadow-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      setFile(null);
                      if (inputRef.current) inputRef.current.value = '';
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <ImageIcon className="h-4 w-4" />
                  <span className="min-w-0 truncate">{file?.name}</span>
                  <span className="ml-auto shrink-0">
                    {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : null}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex min-h-44 flex-col items-center justify-center text-center">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <UploadCloud className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-foreground">Upload or drop proof here</p>
                <p className="mt-1 text-xs text-muted">PNG, JPEG, or WebP · maximum 30 MB</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
                  <Clipboard className="h-3.5 w-3.5" />
                  Click this area and paste a screenshot with Ctrl/Cmd + V
                </p>
              </div>
            )}
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={isSaving} disabled={!file} onClick={handleSubmit}>
            Save remark and proof
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
