'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  createUndeliverableRemarkOption,
  deleteUndeliverableRemarkOption,
  fetchUndeliverableRemarkOptions,
  updateUndeliverableRemarkOption,
} from '../_services/undeliverables-api';
import type { UndeliverableRemarkOption } from '../_types/undeliverables';

type UndeliverablesRemarkOptionsDialogProps = {
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export function UndeliverablesRemarkOptionsDialog({
  open,
  onClose,
  onChanged,
  onError,
  onSuccess,
}: UndeliverablesRemarkOptionsDialogProps) {
  const [items, setItems] = useState<UndeliverableRemarkOption[]>([]);
  const [draftRemark, setDraftRemark] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRemark, setEditingRemark] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchUndeliverableRemarkOptions()
      .then((response) => {
        if (!cancelled) {
          setItems(response.items);
        }
      })
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
  }, [onError, open]);

  const refresh = async () => {
    const response = await fetchUndeliverableRemarkOptions();
    setItems(response.items);
    await onChanged();
  };

  const handleCreate = async () => {
    if (!draftRemark.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await createUndeliverableRemarkOption(draftRemark.trim());
      setDraftRemark('');
      await refresh();
      onSuccess('SA remark added.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to create remark.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (item: UndeliverableRemarkOption) => {
    if (!editingRemark.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await updateUndeliverableRemarkOption(item.id, editingRemark.trim());
      setEditingId(null);
      setEditingRemark('');
      await refresh();
      onSuccess('SA remark updated.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update remark.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: UndeliverableRemarkOption) => {
    setIsSaving(true);
    try {
      await deleteUndeliverableRemarkOption(item.id);
      if (editingId === item.id) {
        setEditingId(null);
        setEditingRemark('');
      }
      await refresh();
      onSuccess('SA remark deleted.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to delete remark.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-3xl rounded-[28px] border-slate-200 p-0 shadow-2xl dark:border-border">
        <DialogHeader className="border-b border-slate-200 px-6 pb-5 pt-6 dark:border-border">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            <MessageSquare className="h-4 w-4" />
            Undeliverables
          </div>
          <DialogTitle className="mb-0 text-[1.55rem] font-semibold tracking-tight">
            Manage SA remarks
          </DialogTitle>
          <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-300">
            Create the selectable remark options used by ERP users when tagging undeliverable orders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-border dark:bg-background-secondary">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  New remark
                </label>
                <input
                  type="text"
                  value={draftRemark}
                  onChange={(event) => setDraftRemark(event.target.value)}
                  placeholder="Enter SA remark"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-sm text-foreground outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100 dark:border-border dark:bg-surface"
                />
              </div>
              <Button
                type="button"
                iconLeft={<Plus className="h-4 w-4" />}
                loading={isSaving}
                disabled={!draftRemark.trim()}
                onClick={handleCreate}
              >
                Add remark
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-border dark:bg-surface dark:text-slate-300">
                Loading remarks...
              </div>
            ) : null}

            {!isLoading && items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-border dark:bg-surface dark:text-slate-300">
                No SA remarks yet.
              </div>
            ) : null}

            {!isLoading && items.map((item) => {
              const editing = editingId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-surface"
                >
                  {editing ? (
                    <input
                      type="text"
                      value={editingRemark}
                      onChange={(event) => setEditingRemark(event.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-sm text-foreground outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100 dark:border-border dark:bg-background-secondary"
                    />
                  ) : (
                    <p className="text-sm font-medium text-foreground">{item.remark}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      Updated {new Date(item.updated_at).toLocaleString()}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {editing ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingId(null);
                              setEditingRemark('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            loading={isSaving}
                            disabled={!editingRemark.trim()}
                            onClick={() => handleUpdate(item)}
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
                            iconLeft={<Pencil className="h-4 w-4" />}
                            onClick={() => {
                              setEditingId(item.id);
                              setEditingRemark(item.remark);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            iconLeft={<Trash2 className="h-4 w-4" />}
                            loading={isSaving}
                            onClick={() => handleDelete(item)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 px-6 py-4 dark:border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
