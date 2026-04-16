'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { WorkflowMetaIntegrationOption } from '../_types/manual-meta-upload';

interface ManualMetaUploadModalProps {
  isOpen: boolean;
  integrations: WorkflowMetaIntegrationOption[];
  selectedIntegrationId: string;
  selectedFile: File | null;
  isUploading: boolean;
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
  onClose,
  onIntegrationChange,
  onFileChange,
  onSubmit,
}: ManualMetaUploadModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xl rounded-2xl p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>Upload Meta Ads</DialogTitle>
          <DialogDescription>
            Import raw Meta CSV or XLSX rows, populate <code>meta_ad_insights</code>, then run marketing and sales reconciliation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-900">Meta integration</label>
            <select
              value={selectedIntegrationId}
              onChange={(event) => onIntegrationChange(event.target.value)}
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
            <label className="text-sm font-semibold text-slate-900">Upload file</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
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
