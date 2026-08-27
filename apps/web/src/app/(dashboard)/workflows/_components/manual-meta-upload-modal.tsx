'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type {
  WorkflowManualMetaUploadJobStatus,
  WorkflowMetaIntegrationOption,
} from '../_types/manual-meta-upload';
import {
  mismatchedCurrencyFiles,
  unknownCurrencyFiles,
  type PendingMetaUpload,
} from '../_utils/meta-upload-queue';
import { MetaUploadDropzone } from './meta-upload-dropzone';

interface ManualMetaUploadModalProps {
  isOpen: boolean;
  integrations: WorkflowMetaIntegrationOption[];
  selectedIntegrationId: string;
  currency: 'PHP' | 'USD';
  currencyMultiplier: string;
  pendingUploads: PendingMetaUpload[];
  isUploading: boolean;
  uploadJob: WorkflowManualMetaUploadJobStatus | null;
  uploadError: string | null;
  onClose: () => void;
  onIntegrationChange: (value: string) => void;
  onCurrencyChange: (value: 'PHP' | 'USD') => void;
  onCurrencyMultiplierChange: (value: string) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onSubmit: () => void;
}

export function ManualMetaUploadModal({
  isOpen,
  integrations,
  selectedIntegrationId,
  currency,
  currencyMultiplier,
  pendingUploads,
  isUploading,
  uploadJob,
  uploadError,
  onClose,
  onIntegrationChange,
  onCurrencyChange,
  onCurrencyMultiplierChange,
  onAddFiles,
  onRemoveFile,
  onSubmit,
}: ManualMetaUploadModalProps) {
  const unknownCurrency = unknownCurrencyFiles(pendingUploads);
  const mismatched = mismatchedCurrencyFiles(pendingUploads, currency);
  const progress = uploadJob?.progress ?? null;
  const percent = progress?.percent ?? null;
  const progressBarWidth = percent == null ? '35%' : `${Math.max(0, Math.min(100, percent))}%`;

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="flex max-h-[90vh] w-11/12 max-w-xl flex-col overflow-hidden rounded-2xl border-slate-200 p-0"
        closeButtonClassName="!right-2 !top-5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 opacity-100 shadow-sm hover:border-orange-200 hover:text-orange-600 focus:ring-orange-200 data-[state=open]:bg-white [&>svg]:h-5 [&>svg]:w-5"
      >
        <DialogHeader className="shrink-0 border-b border-slate-200 px-3 py-5">
          <DialogTitle>Upload Meta Ads</DialogTitle>
          <DialogDescription>
            Import raw Meta CSV or XLSX rows, populate <code>meta_ad_insights</code>, then run marketing and sales reconciliation.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <label className="form-label">Meta integration</label>
            <select
              value={selectedIntegrationId}
              onChange={(event) => onIntegrationChange(event.target.value)}
              disabled={isUploading}
              className="input w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No integration (manual CSV upload)</option>
              {integrations.map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.name}
                </option>
              ))}
            </select>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-300">
              Optional. Select an integration to use its account mapping, or leave this empty for a standalone manual CSV upload.
            </p>
          </div>

          {!selectedIntegrationId && (
            <div className="space-y-2">
              <span className="form-label">Spend currency</span>
              <div className="flex gap-2">
                {(['PHP', 'USD'] as const).map((option) => {
                  const active = currency === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={isUploading}
                      onClick={() => onCurrencyChange(option)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                        active
                          ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                          : 'border-border bg-surface text-muted hover:border-primary/40'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {currency === 'USD' ? (
                <div className="space-y-1.5 pt-1">
                  <label className="form-label" htmlFor="manual-meta-currency-multiplier">
                    Conversion rate to PHP
                  </label>
                  <input
                    id="manual-meta-currency-multiplier"
                    type="number"
                    min="0"
                    step="0.0001"
                    inputMode="decimal"
                    value={currencyMultiplier}
                    onChange={(event) => onCurrencyMultiplierChange(event.target.value)}
                    disabled={isUploading}
                    className="input w-full"
                  />
                </div>
              ) : null}

              <p className="text-xs leading-5 text-muted">
                {currency === 'PHP'
                  ? 'Spend is imported as-is, with no conversion.'
                  : 'Spend is multiplied by this rate to store it in PHP.'}
              </p>
            </div>
          )}

          {mismatched.length > 0 && (
            <div className="rounded-xl border border-destructive/40 bg-destructive-soft/50 px-3 py-2.5">
              <p className="text-xs font-semibold text-destructive">
                {mismatched.length} file(s) do not match {currency}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                The spend column in {mismatched.map((item) => item.file.name).join(', ')} reports{' '}
                {mismatched.map((item) => item.currency).filter(Boolean).join(', ') || 'another currency'}.
                The import always follows the file, so these will ignore the option above.
              </p>
            </div>
          )}

          {unknownCurrency.length > 0 && currency === 'USD' && (
            <div className="rounded-xl border border-warning/40 bg-warning-soft px-3 py-2.5">
              <p className="text-xs font-semibold text-warning">
                {unknownCurrency.length} file(s) do not state a currency
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                These import as PHP with no conversion, because the spend column has no currency in
                its header. Re-export with a header such as “Amount spent (USD)” to convert them.
              </p>
            </div>
          )}

          <MetaUploadDropzone
            pending={pendingUploads}
            disabled={isUploading}
            onAdd={onAddFiles}
            onRemove={onRemoveFile}
          />

          {(isUploading || uploadJob || uploadError) && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  Status: <span className="font-semibold text-slate-900">{progress?.stage || 'QUEUED'}</span>
                </span>
                {percent != null ? <span>{percent}%</span> : <span>Processing...</span>}
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full bg-indigo-600 ${percent == null ? 'animate-pulse' : ''}`}
                  style={{ width: progressBarWidth }}
                />
              </div>

              <p className="text-xs text-slate-600">
                {progress?.message || (isUploading ? 'Uploading file and preparing import...' : 'Waiting to start')}
              </p>

              {progress && (
                <p className="text-xs text-slate-600">
                  Processed rows: {progress.processedRows.toLocaleString()}
                  {progress.totalRows != null ? ` / ${progress.totalRows.toLocaleString()}` : ''}
                  {' | '}
                  Insights upserted: {progress.insightsUpserted.toLocaleString()}
                </p>
              )}

              {uploadError && (
                <p className="text-xs font-medium text-red-600">{uploadError}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-200 px-6 py-4 sm:justify-between sm:space-x-0">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            loading={isUploading}
            disabled={isUploading || pendingUploads.length === 0}
          >
            {pendingUploads.length > 1 ? `Import ${pendingUploads.length} files` : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
