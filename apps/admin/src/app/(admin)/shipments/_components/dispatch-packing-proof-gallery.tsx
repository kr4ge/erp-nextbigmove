'use client';

import { Camera, Clipboard, ExternalLink, Image as ImageIcon, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { WmsModal } from '../../_components/wms-modal';
import type { WmsDispatchPackingProof } from '../_types/dispatch';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
});

type DispatchPackingProofGalleryProps = {
  orderNumber: string;
  proofs: WmsDispatchPackingProof[];
};

export function DispatchPackingProofGallery({
  orderNumber,
  proofs,
}: DispatchPackingProofGalleryProps) {
  const [selectedProof, setSelectedProof] = useState<WmsDispatchPackingProof | null>(null);

  useEffect(() => {
    setSelectedProof(null);
  }, [orderNumber]);

  if (proofs.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[18px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-4 py-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#edf3f6] text-[#68808f]">
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-primary">No packing proof uploaded</p>
          <p className="mt-1 text-[12px] text-[#68808f]">This order has no STOX packing photo on record.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {proofs.map((proof, index) => {
          const SourceIcon = resolveSourceIcon(proof.source);

          return (
            <button
              key={proof.id}
              type="button"
              onClick={() => setSelectedProof(proof)}
              className="group overflow-hidden rounded-[18px] border border-[#dce4ea] bg-[#fbfcfc] text-left transition hover:border-[#bdccd6] hover:bg-white"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[#eaf0f3]">
                {proof.imageUrl ? (
                  // Signed object-storage URLs are dynamic and cannot be declared in next/image domains.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proof.imageUrl}
                    alt={`Packing proof ${index + 1} for order ${orderNumber}`}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#8093a0]">
                    <ImageIcon className="h-8 w-8" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary">
                    <SourceIcon className="h-3.5 w-3.5 text-[#ff6413]" aria-hidden="true" />
                    {formatSource(proof.source)}
                  </span>
                  <span className="text-[11px] text-[#7b8e9a]">{formatFileSize(proof.byteSize)}</span>
                </div>
                <p className="mt-2 truncate text-[12px] text-[#5d7483]">{proof.uploadedBy.name}</p>
                <p className="mt-1 text-[11px] text-[#8798a3]">{formatDateTime(proof.createdAt)}</p>
              </div>
            </button>
          );
        })}
      </div>

      <WmsModal
        open={Boolean(selectedProof)}
        title={`Packing proof · Order #${orderNumber}`}
        description={selectedProof ? `${formatSource(selectedProof.source)} · ${formatDateTime(selectedProof.createdAt)}` : undefined}
        onClose={() => setSelectedProof(null)}
        panelClassName="max-w-4xl"
        bodyClassName="space-y-4"
        footer={selectedProof?.imageUrl ? (
          <div className="flex justify-end">
            <a
              href={selectedProof.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-md btn-outline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open original
            </a>
          </div>
        ) : undefined}
      >
        {selectedProof ? (
          <>
            <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-[18px] bg-[#0f2633] sm:min-h-[420px]">
              {selectedProof.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedProof.imageUrl}
                  alt={`Packing proof for order ${orderNumber}`}
                  className="max-h-[68dvh] w-full object-contain"
                />
              ) : (
                <div className="px-6 py-12 text-center text-white/70">
                  <ImageIcon className="mx-auto h-9 w-9" aria-hidden="true" />
                  <p className="mt-3 text-sm">The proof image is temporarily unavailable.</p>
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ProofMeta label="Uploaded by" value={selectedProof.uploadedBy.name} />
              <ProofMeta label="Source" value={formatSource(selectedProof.source)} />
              <ProofMeta label="File" value={selectedProof.originalFileName ?? formatFileSize(selectedProof.byteSize)} />
            </div>
          </>
        ) : null}
      </WmsModal>
    </>
  );
}

function ProofMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#e2e9ee] bg-[#fbfcfc] px-4 py-3">
      <p className="card-label">{label}</p>
      <p className="mt-2 truncate text-[13px] font-semibold text-primary" title={value}>{value}</p>
    </div>
  );
}

function resolveSourceIcon(source: WmsDispatchPackingProof['source']) {
  if (source === 'CAMERA') {
    return Camera;
  }
  if (source === 'CLIPBOARD') {
    return Clipboard;
  }
  return Upload;
}

function formatSource(source: WmsDispatchPackingProof['source']) {
  if (source === 'CAMERA') {
    return 'Camera';
  }
  if (source === 'CLIPBOARD') {
    return 'Pasted image';
  }
  return 'Uploaded file';
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME_FORMATTER.format(date);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return 'Unknown size';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(bytes / 1024, 0.1).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
