'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  createUndeliverableRemark,
  deleteUndeliverableRemark,
  fetchUndeliverableRemarkOptions,
  fetchUndeliverableRemarks,
  updateUndeliverableRemark,
} from '../_services/undeliverables-api';
import type {
  UndeliverableRemarkItem,
  UndeliverableRemarkOption,
  UndeliverableRow,
  UndeliverableRemarksResponse,
} from '../_types/undeliverables';

type UndeliverablesRemarksDialogProps = {
  open: boolean;
  row: UndeliverableRow | null;
  canWrite: boolean;
  remarkOptionsVersion: number;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onOpenManageOptions: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export function UndeliverablesRemarksDialog({
  open,
  row,
  canWrite,
  remarkOptionsVersion,
  onClose,
  onChanged,
  onOpenManageOptions,
  onError,
  onSuccess,
}: UndeliverablesRemarksDialogProps) {
  const [data, setData] = useState<UndeliverableRemarksResponse | null>(null);
  const [remarkOptions, setRemarkOptions] = useState<UndeliverableRemarkOption[]>([]);
  const [draftRemarkOptionId, setDraftRemarkOptionId] = useState('');
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [editingRemarkOptionId, setEditingRemarkOptionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadDialogData = useCallback(async () => {
    if (!row) {
      return;
    }

    const [remarksResponse, optionsResponse] = await Promise.all([
      fetchUndeliverableRemarks(row.id),
      fetchUndeliverableRemarkOptions(),
    ]);

    setData(remarksResponse);
    setRemarkOptions(optionsResponse.items);
  }, [row]);

  useEffect(() => {
    if (!open || !row) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setEditingRemarkId(null);
    setEditingRemarkOptionId('');
    setDraftRemarkOptionId('');

    loadDialogData()
      .catch((error) => {
        if (!cancelled) {
          onError(error instanceof Error ? error.message : 'Failed to load remarks.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadDialogData, onError, open, remarkOptionsVersion, row]);

  const refresh = async () => {
    await loadDialogData();
    await onChanged();
  };

  const remarkOptionIdByText = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of remarkOptions) {
      map.set(option.remark, option.id);
    }
    return map;
  }, [remarkOptions]);

  const handleCreate = async () => {
    if (!row || !draftRemarkOptionId) {
      return;
    }

    setIsSaving(true);
    try {
      await createUndeliverableRemark(row.id, draftRemarkOptionId);
      setDraftRemarkOptionId('');
      await refresh();
      onSuccess('Undeliverables remark added.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to add remark.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (remark: UndeliverableRemarkItem) => {
    if (!editingRemarkOptionId) {
      return;
    }

    setIsSaving(true);
    try {
      await updateUndeliverableRemark(remark.id, editingRemarkOptionId);
      setEditingRemarkId(null);
      setEditingRemarkOptionId('');
      await refresh();
      onSuccess('Undeliverables remark updated.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update remark.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (remark: UndeliverableRemarkItem) => {
    setIsSaving(true);
    try {
      await deleteUndeliverableRemark(remark.id);
      await refresh();
      onSuccess('Undeliverables remark deleted.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to delete remark.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <DialogTitle>{row ? `Undeliverables Remarks · #${row.pos_order_id}` : 'Undeliverables Remarks'}</DialogTitle>
              <DialogDescription>
                Internal ERP-only remarks for shipped, delivered, returning, and returned orders.
              </DialogDescription>
            </div>
            {canWrite ? (
              <Button type="button" variant="outline" size="sm" onClick={onOpenManageOptions}>
                Manage remarks
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-border dark:bg-background-secondary dark:text-slate-300">
          <span className="font-medium text-foreground">{row?.store_name || '-'}</span>
          <span className="mx-2 text-slate-300">•</span>
          <span>{row?.tracking || 'No waybill yet'}</span>
          <span className="mx-2 text-slate-300">•</span>
          <span>{row?.status_name || '-'}</span>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-border dark:bg-surface dark:text-slate-300">
              Loading remarks...
            </div>
          ) : null}

          {!isLoading && data?.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-border dark:bg-surface dark:text-slate-300">
              No remarks yet for this order.
            </div>
          ) : null}

          {!isLoading && data?.items.map((remark) => {
            const editing = editingRemarkId === remark.id;
            return (
              <div key={remark.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-surface">
                {editing ? (
                  <select
                    value={editingRemarkOptionId}
                    onChange={(event) => setEditingRemarkOptionId(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 dark:border-border dark:bg-background-secondary dark:text-foreground"
                  >
                    <option value="">Select SA remark</option>
                    {remarkOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.remark}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-700 dark:text-slate-200">{remark.remark}</p>
                )}

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-500 dark:text-slate-300">
                    <span>{remark.created_by_name}</span>
                    <span className="mx-2 text-slate-300">•</span>
                    <span>{new Date(remark.updated_at).toLocaleString()}</span>
                  </div>

                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      {editing ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingRemarkId(null);
                              setEditingRemarkOptionId('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            loading={isSaving}
                            onClick={() => handleUpdate(remark)}
                          >
                            Save
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingRemarkId(remark.id);
                              setEditingRemarkOptionId(remarkOptionIdByText.get(remark.remark) ?? '');
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            loading={isSaving}
                            onClick={() => handleDelete(remark)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {canWrite ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-surface">
            <p className="mb-3 text-sm font-medium text-foreground">Add remark</p>
            {remarkOptions.length > 0 ? (
              <select
                value={draftRemarkOptionId}
                onChange={(event) => setDraftRemarkOptionId(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 dark:border-border dark:bg-background-secondary dark:text-foreground"
              >
                <option value="">Select SA remark</option>
                {remarkOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.remark}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-border dark:bg-background-secondary dark:text-slate-300">
                No selectable remarks yet. Create one first in Manage remarks.
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                loading={isSaving}
                disabled={!draftRemarkOptionId}
                onClick={handleCreate}
              >
                Save remark
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
