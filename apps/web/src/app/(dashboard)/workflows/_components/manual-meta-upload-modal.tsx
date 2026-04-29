'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type {
  WorkflowManualMetaUploadJobStatus,
  WorkflowMetaIntegrationOption,
} from '../_types/manual-meta-upload';

interface ManualMetaUploadModalProps {
  isOpen: boolean;
  integrations: WorkflowMetaIntegrationOption[];
  selectedIntegrationId: string;
  selectedFile: File | null;
  isUploading: boolean;
  uploadJob: WorkflowManualMetaUploadJobStatus | null;
  uploadError: string | null;
  onClose: () => void;
  onIntegrationChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
}

export function ManualMetaUploadModal({
  isOpen,
  integrations,
  selectedIntegrationId,
  selectedFile,
  isUploading,
  uploadJob,
  uploadError,
  onClose,
  onIntegrationChange,
  onFileChange,
  onSubmit,
}: ManualMetaUploadModalProps) {
  const progress = uploadJob?.progress ?? null;
  const percent = progress?.percent ?? null;
  const progressBarWidth = percent == null ? '35%' : `${Math.max(0, Math.min(100, percent))}%`;

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="max-w-xl rounded-2xl border-slate-200 p-0"
        closeButtonClassName="!right-2 !top-5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 opacity-100 shadow-sm hover:border-orange-200 hover:text-orange-600 focus:ring-orange-200 data-[state=open]:bg-white [&>svg]:h-5 [&>svg]:w-5"
      >
        <DialogHeader className="border-b border-slate-200 px-3 py-5">
          <DialogTitle>Upload Meta Ads</DialogTitle>
          <DialogDescription>
            Import raw Meta CSV or XLSX rows, populate <code>meta_ad_insights</code>, then run marketing and sales reconciliation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <label className="form-label">Meta integration</label>
            <select
              value={selectedIntegrationId}
              onChange={(event) => onIntegrationChange(event.target.value)}
              disabled={isUploading}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No integration (auto-match by Account ID)</option>
              {integrations.map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.name}
                </option>
              ))}
            </select>
            <p className="text-xs leading-5 text-slate-500">
              Choose a Meta integration to restrict the upload to its ad accounts, or leave it on no integration to auto-match rows tenant-wide by <code>Account ID</code>.
            </p>
          </div>

          <div className="space-y-2">
            <label className="form-label">Upload file</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={isUploading}
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
            />
            <p className="text-xs leading-5 text-slate-500">
              Supported formats: CSV, XLSX, XLS. The file can include multiple Meta account IDs. If an integration is selected, all rows must belong to that integration.
            </p>
            {selectedFile && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Selected file: <span className="font-medium text-slate-900">{selectedFile.name}</span>
              </div>
            )}
          </div>

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

        <DialogFooter className="border-t border-slate-200 px-6 py-4 sm:justify-between sm:space-x-0">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            loading={isUploading}
            disabled={isUploading || !selectedFile}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
