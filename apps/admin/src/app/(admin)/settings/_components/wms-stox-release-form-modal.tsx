'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { WmsFormField } from '../../_components/wms-form-field';
import { WmsModal } from '../../_components/wms-modal';
import type { CreateWmsStoxReleaseInput } from '../_types/settings';

type WmsStoxReleaseFormModalProps = {
  open: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: CreateWmsStoxReleaseInput) => Promise<void>;
};

type FormState = {
  sourceMode: 'url' | 'file';
  version: string;
  buildNumber: string;
  releaseNotes: string;
  isActive: boolean;
  sourceUrl: string;
  file: File | null;
};

const EMPTY_FORM: FormState = {
  sourceMode: 'url',
  version: '',
  buildNumber: '',
  releaseNotes: '',
  isActive: true,
  sourceUrl: '',
  file: null,
};

export function WmsStoxReleaseFormModal({
  open,
  isSubmitting,
  error,
  onClose,
  onCreate,
}: WmsStoxReleaseFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(EMPTY_FORM);
    setLocalError(null);
  }, [open]);

  const setField = (key: keyof Omit<FormState, 'file' | 'isActive' | 'sourceMode'>, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setSourceMode = (sourceMode: FormState['sourceMode']) => {
    setForm((current) => ({
      ...current,
      sourceMode,
    }));
    setLocalError(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({
      ...current,
      file: event.target.files?.[0] ?? null,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const version = form.version.trim();
    const buildNumber = Number(form.buildNumber);
    const sourceUrl = form.sourceUrl.trim();

    if (!version) {
      setLocalError('Version is required.');
      return;
    }

    if (form.sourceMode === 'url') {
      try {
        const parsedUrl = new URL(sourceUrl);
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
          setLocalError('APK URL must use HTTPS or HTTP.');
          return;
        }
      } catch {
        setLocalError('Enter a valid direct APK download URL.');
        return;
      }
    }

    if (form.sourceMode === 'file' && !form.file) {
      setLocalError('Select the STOX Android APK before uploading.');
      return;
    }

    if (!Number.isInteger(buildNumber) || buildNumber <= 0) {
      setLocalError('Build number must be a positive whole number.');
      return;
    }

    setLocalError(null);
    await onCreate({
      version,
      buildNumber,
      releaseNotes: form.releaseNotes.trim() || null,
      isActive: form.isActive,
      sourceUrl: form.sourceMode === 'url' ? sourceUrl : null,
      file: form.sourceMode === 'file' ? form.file : null,
    });
  };

  const hasSource = form.sourceMode === 'url'
    ? Boolean(form.sourceUrl.trim())
    : Boolean(form.file);

  return (
    <WmsModal
      open={open}
      title="Publish STOX Android release"
      onClose={onClose}
      panelClassName="max-w-[760px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-[12px] border border-[#d7e0e7] bg-white px-4 text-[13px] font-semibold text-primary transition hover:bg-[#f8fafb]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="wms-stox-release-form"
            disabled={isSubmitting || !hasSource}
            className="inline-flex h-10 items-center rounded-[12px] bg-primary px-4 text-[13px] font-semibold text-white transition hover:bg-[#0f3040] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? form.sourceMode === 'url' ? 'Importing...' : 'Uploading...'
              : form.sourceMode === 'url' ? 'Import release' : 'Upload release'}
          </button>
        </div>
      }
    >
      <form id="wms-stox-release-form" onSubmit={handleSubmit} className="space-y-4">
        {error || localError ? (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
            {error || localError}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 grid gap-2 rounded-[16px] border border-[#dce4ea] bg-[#fbfcfc] p-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSourceMode('url')}
              className={`rounded-[12px] px-3 py-2.5 text-left text-[13px] font-semibold transition ${
                form.sourceMode === 'url'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-primary hover:bg-white'
              }`}
            >
              Import from URL
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('file')}
              className={`rounded-[12px] px-3 py-2.5 text-left text-[13px] font-semibold transition ${
                form.sourceMode === 'file'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-primary hover:bg-white'
              }`}
            >
              Upload APK file
            </button>
          </div>

          <WmsFormField label="Version">
            <input
              required
              value={form.version}
              onChange={(event) => setField('version', event.target.value)}
              className="input"
              placeholder="1.0.0"
            />
          </WmsFormField>

          <WmsFormField label="Build number">
            <input
              required
              inputMode="numeric"
              value={form.buildNumber}
              onChange={(event) => setField('buildNumber', event.target.value)}
              className="input"
              placeholder="1"
            />
          </WmsFormField>

          <div className="sm:col-span-2">
            <WmsFormField label="Release notes">
              <textarea
                value={form.releaseNotes}
                onChange={(event) => setField('releaseNotes', event.target.value)}
                className="input min-h-[110px]"
                placeholder="What changed in this STOX build."
              />
            </WmsFormField>
          </div>

          <div className="sm:col-span-2">
            {form.sourceMode === 'url' ? (
              <WmsFormField label="Direct APK URL">
                <div className="space-y-2">
                  <input
                    required
                    value={form.sourceUrl}
                    onChange={(event) => setField('sourceUrl', event.target.value)}
                    className="input"
                    placeholder="https://example.com/stox-release.apk"
                  />
                  <p className="text-xs text-[#637786]">
                    Paste the direct APK download link. Do not use an HTML build details page.
                  </p>
                </div>
              </WmsFormField>
            ) : (
              <WmsFormField label="Android APK">
                <div className="space-y-2">
                  <input
                    required
                    type="file"
                    accept=".apk,application/vnd.android.package-archive,application/octet-stream"
                    onChange={handleFileChange}
                    className="block w-full rounded-[14px] border border-[#dce4ea] bg-white px-3 py-2.5 text-sm text-primary file:mr-3 file:rounded-[10px] file:border-0 file:bg-[#eff5f8] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary"
                  />
                  {form.file ? (
                    <p className="text-xs text-[#637786]">
                      {form.file.name} • {Intl.NumberFormat('en-US').format(form.file.size)} bytes
                    </p>
                  ) : null}
                </div>
              </WmsFormField>
            )}
          </div>

          <label className="sm:col-span-2 flex items-center gap-3 rounded-[14px] border border-[#dce4ea] bg-[#fbfcfc] px-3 py-3 text-sm text-primary">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            <span>
              Set this release as the active WMS download after upload.
            </span>
          </label>
        </div>
      </form>
    </WmsModal>
  );
}
