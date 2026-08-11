'use client';

import { Camera, CameraOff, Check, ClipboardPaste, ImagePlus, RefreshCcw, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WmsModal } from '../../_components/wms-modal';
import type { WmsPackingProofSource } from '../_types/fulfillment';

const MAX_PROOF_BYTES = 30 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type PackingProofDialogProps = {
  open: boolean;
  orderLabel: string;
  tracking: string | null;
  isUploading: boolean;
  requestError: string | null;
  onClose: () => void;
  onSave: (file: File, source: WmsPackingProofSource) => Promise<boolean>;
};

export function PackingProofDialog({
  open,
  orderLabel,
  tracking,
  isUploading,
  requestError,
  onClose,
  onSave,
}: PackingProofDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [source, setSource] = useState<WmsPackingProofSource>('FILE');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'live' | 'captured'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setLocalError(null);
    setCameraState('idle');
    stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!open) {
      clearSelection();
      return;
    }

    return () => stopCamera();
  }, [clearSelection, open, stopCamera]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const acceptFile = useCallback((file: File, nextSource: WmsPackingProofSource) => {
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      setLocalError('Use a PNG, JPEG, or WebP image.');
      return false;
    }
    if (file.size > MAX_PROOF_BYTES) {
      setLocalError('Packing proof must be 30MB or smaller.');
      return false;
    }

    setSelectedFile(file);
    setSource(nextSource);
    setLocalError(null);
    return true;
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePaste = (event: ClipboardEvent) => {
      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith('image/'));
      const image = imageItem?.getAsFile();
      if (!image) {
        return;
      }

      event.preventDefault();
      stopCamera();
      setCameraState('idle');
      acceptFile(new File([image], image.name || 'packing-proof.png', { type: image.type }), 'CLIPBOARD');
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [acceptFile, open, stopCamera]);

  const startCamera = async () => {
    setLocalError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setLocalError('Camera access requires HTTPS or localhost and a supported browser.');
      return;
    }

    stopCamera();
    setSelectedFile(null);
    setCameraState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('live');
    } catch {
      stopCamera();
      setCameraState('idle');
      setLocalError('Camera permission was denied or the camera is unavailable.');
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setLocalError('The camera is not ready yet.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setLocalError('The camera image could not be captured.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      setLocalError('The camera image could not be saved.');
      return;
    }

    const file = new File([blob], `packing-${orderLabel.replace(/[^a-zA-Z0-9_-]/g, '')}.jpg`, {
      type: 'image/jpeg',
    });
    if (acceptFile(file, 'CAMERA')) {
      stopCamera();
      setCameraState('captured');
    }
  };

  const saveProof = async () => {
    if (!selectedFile || isUploading) {
      return;
    }

    const saved = await onSave(selectedFile, source);
    if (saved) {
      clearSelection();
      onClose();
    }
  };

  return (
    <WmsModal
      open={open}
      title="Packing proof"
      description={`${orderLabel}${tracking ? ` · ${tracking}` : ''}`}
      onClose={() => {
        if (!isUploading) {
          clearSelection();
          onClose();
        }
      }}
      panelClassName="!w-[min(96vw,980px)]"
      bodyClassName="!p-5"
      footer={(
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => {
              clearSelection();
              onClose();
            }}
            className="rounded-xl border border-[#ccd8df] bg-white px-4 py-2.5 text-sm font-semibold text-[#294858] transition hover:bg-[#f7fafb] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedFile || isUploading}
            onClick={() => void saveProof()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#12384b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0d2c3b] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isUploading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isUploading ? 'Uploading proof' : 'Save proof'}
          </button>
        </div>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#dce6ec] bg-[#fbfcfd] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff1e8] text-[#f15a24]">
              <ImagePlus className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-[#12384b]">Upload or paste</h3>
              <p className="mt-1 text-sm leading-5 text-[#657987]">Choose an image, drag it here, or paste a screenshot.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (file) {
                stopCamera();
                setCameraState('idle');
                acceptFile(file, 'FILE');
              }
            }}
            className="mt-4 flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#bfcdd6] bg-white px-6 py-8 text-center transition hover:border-[#f15a24] hover:bg-[#fffaf7]"
          >
            <Upload className="h-7 w-7 text-[#f15a24]" />
            <span className="mt-3 text-sm font-semibold text-[#12384b]">Select packing photo</span>
            <span className="mt-1 text-xs text-[#7a8d99]">PNG, JPEG, or WebP · up to 30MB</span>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#edf3f6] px-3 py-1.5 text-xs font-semibold text-[#496574]">
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste works anywhere in this window
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                stopCamera();
                setCameraState('idle');
                acceptFile(file, 'FILE');
              }
              event.currentTarget.value = '';
            }}
          />
        </section>

        <section className="rounded-2xl border border-[#dce6ec] bg-[#f5f8fa] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f4f7] text-[#12384b]">
              <Camera className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-[#12384b]">Use camera</h3>
              <p className="mt-1 text-sm leading-5 text-[#657987]">Photograph the verified items before bubble wrap.</p>
            </div>
          </div>

          <div className="relative mt-4 flex min-h-52 items-center justify-center overflow-hidden rounded-2xl bg-[#102c3b]">
            {cameraState === 'live' || cameraState === 'starting' ? (
              <video ref={videoRef} muted playsInline className="h-full min-h-52 w-full object-cover" />
            ) : previewUrl ? (
              <img src={previewUrl} alt="Packing proof preview" className="h-full min-h-52 w-full object-contain" />
            ) : (
              <div className="px-6 text-center text-white/75">
                <CameraOff className="mx-auto h-8 w-8" />
                <p className="mt-3 text-sm font-semibold">Camera is off</p>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {cameraState === 'idle' ? (
              <button type="button" onClick={() => void startCamera()} className="inline-flex items-center gap-2 rounded-xl border border-[#bfcdd6] bg-white px-4 py-2 text-sm font-semibold text-[#12384b]">
                <Camera className="h-4 w-4" /> Open camera
              </button>
            ) : null}
            {cameraState === 'starting' ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#526b79]">
                <RefreshCcw className="h-4 w-4 animate-spin" /> Starting camera
              </span>
            ) : null}
            {cameraState === 'captured' && source === 'CAMERA' ? (
              <button type="button" onClick={() => void startCamera()} className="inline-flex items-center gap-2 rounded-xl border border-[#bfcdd6] bg-white px-4 py-2 text-sm font-semibold text-[#12384b]">
                <RefreshCcw className="h-4 w-4" /> Retake
              </button>
            ) : null}
            {cameraState === 'live' ? (
              <div className="flex w-full flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => void capturePhoto()}
                  className="group flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-[3px] border-[#12384b] bg-white p-1.5 shadow-[0_8px_20px_rgba(18,56,75,0.2)] transition active:scale-95"
                  aria-label="Take packing photo"
                >
                  <span className="h-full w-full rounded-full bg-[#f15a24] transition group-hover:bg-[#d94a18]" />
                </button>
                <span className="text-xs font-semibold text-[#657987]">Take photo</span>
                <button type="button" onClick={clearSelection} className="text-xs font-semibold text-[#496574] underline underline-offset-4">
                  Cancel camera
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {selectedFile ? (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-emerald-900">{selectedFile.name}</p>
            <p className="mt-0.5 text-xs text-emerald-700">{(selectedFile.size / 1024 / 1024).toFixed(2)}MB · {source.toLowerCase()}</p>
          </div>
          <button type="button" onClick={clearSelection} className="shrink-0 text-xs font-semibold text-emerald-800 underline underline-offset-2">
            Remove
          </button>
        </div>
      ) : null}

      {localError || requestError ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {localError ?? requestError}
        </p>
      ) : null}
    </WmsModal>
  );
}
