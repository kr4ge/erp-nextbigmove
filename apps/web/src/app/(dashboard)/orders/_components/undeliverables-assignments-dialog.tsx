'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, Store, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UndeliverablesAssignmentsResponse } from '../_types/undeliverables';

type UndeliverablesAssignmentsDialogProps = {
  open: boolean;
  onClose: () => void;
  data: UndeliverablesAssignmentsResponse | null;
  isLoading?: boolean;
  onSave: (userId: string, storeIds: string[]) => Promise<void>;
};

export function UndeliverablesAssignmentsDialog({
  open,
  onClose,
  data,
  isLoading = false,
  onSave,
}: UndeliverablesAssignmentsDialogProps) {
  const STORES_PER_PAGE = 8;
  const [isMounted, setIsMounted] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [storePage, setStorePage] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (!open || !data || data.users.length === 0) {
      return;
    }

    setSelectedUserId((current) => {
      if (current && data.users.some((user) => user.user_id === current)) {
        return current;
      }
      return data.users[0].user_id;
    });
  }, [data, open]);

  useEffect(() => {
    if (!data || !selectedUserId) {
      setSelectedStoreIds([]);
      return;
    }

    const assignedStoreIds = data.assignments
      .filter((assignment) => assignment.userId === selectedUserId)
      .map((assignment) => assignment.storeId);

    setSelectedStoreIds(assignedStoreIds);
  }, [data, selectedUserId]);

  const storesByUser = useMemo(() => {
    if (!data) {
      return new Map<string, string[]>();
    }

    return data.assignments.reduce((map, assignment) => {
      const bucket = map.get(assignment.userId) ?? [];
      bucket.push(assignment.storeId);
      map.set(assignment.userId, bucket);
      return map;
    }, new Map<string, string[]>());
  }, [data]);

  const filteredUsers = useMemo(() => {
    if (!data) {
      return [];
    }

    const keyword = userSearch.trim().toLowerCase();
    if (!keyword) {
      return data.users;
    }

    return data.users.filter((user) =>
      `${user.full_name} ${user.email}`.toLowerCase().includes(keyword),
    );
  }, [data, userSearch]);

  const filteredStores = useMemo(() => {
    if (!data) {
      return [];
    }

    const keyword = storeSearch.trim().toLowerCase();
    if (!keyword) {
      return data.stores;
    }

    return data.stores.filter((store) =>
      `${store.store_name} ${store.shop_id}`.toLowerCase().includes(keyword),
    );
  }, [data, storeSearch]);

  const selectedUser = useMemo(
    () => data?.users.find((user) => user.user_id === selectedUserId) ?? null,
    [data, selectedUserId],
  );

  const totalStorePages = Math.max(1, Math.ceil(filteredStores.length / STORES_PER_PAGE));
  const pagedStores = useMemo(() => {
    const safePage = Math.min(storePage, totalStorePages);
    const start = (safePage - 1) * STORES_PER_PAGE;
    return filteredStores.slice(start, start + STORES_PER_PAGE);
  }, [filteredStores, storePage, totalStorePages]);
  const visibleStoreIds = pagedStores.map((store) => store.store_id);
  const areAllVisibleStoresSelected =
    visibleStoreIds.length > 0 && visibleStoreIds.every((storeId) => selectedStoreIds.includes(storeId));

  useEffect(() => {
    setStorePage(1);
  }, [selectedUserId, storeSearch]);

  useEffect(() => {
    if (storePage > totalStorePages) {
      setStorePage(totalStorePages);
    }
  }, [storePage, totalStorePages]);

  const handleToggleStore = (storeId: string) => {
    setSelectedStoreIds((current) =>
      current.includes(storeId)
        ? current.filter((value) => value !== storeId)
        : [...current, storeId],
    );
  };

  const handleSelectVisibleStores = () => {
    setSelectedStoreIds((current) => Array.from(new Set([...current, ...visibleStoreIds])));
  };

  const handleClearVisibleStores = () => {
    setSelectedStoreIds((current) => current.filter((storeId) => !visibleStoreIds.includes(storeId)));
  };

  const handleSave = async () => {
    if (!selectedUserId) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(selectedUserId, selectedStoreIds);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!open || !isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-slate-900/40 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative mx-auto my-2 flex h-[calc(100vh-1.5rem)] w-[min(94vw,1180px)] max-h-[calc(100vh-1.5rem)] max-w-none flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:my-4 sm:h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-3rem)] dark:border-border dark:bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 pb-5 pt-6 dark:border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                <Users className="h-4 w-4" />
                Undeliverables
              </div>
              <h3 className="mt-2 text-[1.55rem] font-semibold tracking-tight text-foreground">
                Manage store assignment
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-300">
                Assign one or more stores to ERP users who will work the shipped, delivered, returning, and returned order queue.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-border dark:hover:bg-background-secondary"
              aria-label="Close assignment modal"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-stretch">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/80 dark:border-border dark:bg-background-secondary lg:w-[18rem] lg:flex-none">
            <div className="border-b border-slate-200 px-4 py-4 dark:border-border">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Users</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    {data?.users.length ?? 0} available
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 dark:border-border dark:bg-surface">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search user"
                  className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="max-h-[28rem] space-y-2 overflow-y-auto p-3">
              {filteredUsers.map((user) => {
                const assignedCount = storesByUser.get(user.user_id)?.length ?? 0;
                const active = user.user_id === selectedUserId;
                return (
                  <button
                    key={user.user_id}
                    type="button"
                    onClick={() => setSelectedUserId(user.user_id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? 'border-orange-300 bg-white shadow-sm ring-1 ring-orange-100 dark:border-orange-400 dark:bg-surface dark:ring-orange-500/20'
                        : 'border-transparent bg-white/80 hover:border-slate-200 hover:bg-white dark:bg-surface/70 dark:hover:border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{user.full_name}</p>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-300">{user.email}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-background dark:text-slate-300">
                        {assignedCount}
                      </span>
                    </div>
                  </button>
                );
              })}

              {filteredUsers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-border dark:bg-surface dark:text-slate-300">
                  No matching users.
                </div>
              ) : null}
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-border dark:bg-surface lg:flex-1">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-border">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Assigned Stores</p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">
                    {selectedUser ? selectedUser.full_name : 'Select a user'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    {selectedUser
                      ? `${selectedStoreIds.length} store${selectedStoreIds.length === 1 ? '' : 's'} selected`
                      : 'Choose a user from the left panel first.'}
                  </p>
                </div>

                {selectedUserId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearVisibleStores}
                      disabled={selectedStoreIds.length === 0}
                    >
                      Clear visible
                    </Button>
                    <Button
                      type="button"
                      variant={areAllVisibleStoresSelected ? 'outline' : 'primary'}
                      size="sm"
                      onClick={areAllVisibleStoresSelected ? handleClearVisibleStores : handleSelectVisibleStores}
                      disabled={visibleStoreIds.length === 0}
                    >
                      {areAllVisibleStoresSelected ? 'Unselect visible' : 'Select visible'}
                    </Button>
                  </div>
                ) : null}
              </div>

              {selectedUserId ? (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 dark:border-border dark:bg-background-secondary">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={storeSearch}
                    onChange={(event) => setStoreSearch(event.target.value)}
                    placeholder="Search store or shop ID"
                    className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
                  />
                </div>
              ) : null}
            </div>

            {!selectedUserId ? (
              <div className="flex min-h-[22rem] items-center justify-center px-6 py-10">
                <div className="max-w-sm text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-background-secondary dark:text-slate-300">
                    <Store className="h-6 w-6" />
                  </div>
                  <p className="text-base font-semibold text-foreground">Select a user first</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
                    After selecting a user, choose which stores should appear in that user’s undeliverables queue.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="space-y-3">
                {pagedStores.map((store) => {
                  const checked = selectedStoreIds.includes(store.store_id);
                  return (
                    <label
                      key={store.store_id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                        checked
                          ? 'border-orange-300 bg-orange-50/80 shadow-sm dark:border-orange-400 dark:bg-orange-500/10'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-border dark:hover:border-slate-500 dark:hover:bg-background-secondary'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleStore(store.store_id)}
                        className="sr-only"
                      />
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                          checked
                            ? 'border-orange-500 bg-orange-500 text-white'
                            : 'border-slate-300 bg-white text-transparent dark:border-slate-500 dark:bg-background'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{store.store_name}</span>
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-300">{store.shop_id}</span>
                      </span>
                    </label>
                  );
                })}
                </div>

                {filteredStores.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-border dark:bg-background-secondary dark:text-slate-300">
                    No matching stores.
                  </div>
                ) : (
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-border dark:text-slate-300">
                    <span>
                      Showing {filteredStores.length === 0 ? 0 : ((storePage - 1) * STORES_PER_PAGE) + 1}
                      {' '}-{' '}
                      {Math.min(storePage * STORES_PER_PAGE, filteredStores.length)} of {filteredStores.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setStorePage((current) => Math.max(1, current - 1))}
                        disabled={storePage === 1}
                      >
                        Previous
                      </Button>
                      <span className="min-w-[72px] text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {storePage} / {totalStorePages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setStorePage((current) => Math.min(totalStorePages, current + 1))}
                        disabled={storePage === totalStorePages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 dark:border-border">
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="mr-auto hidden text-sm text-slate-500 dark:text-slate-300 sm:block">
            {selectedUser ? (
              <span>
                Assigning <span className="font-semibold text-foreground">{selectedStoreIds.length}</span> store{selectedStoreIds.length === 1 ? '' : 's'} to{' '}
                <span className="font-semibold text-foreground">{selectedUser.full_name}</span>
              </span>
            ) : (
              <span>Select a user to start assigning stores.</span>
            )}
            </div>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} loading={isSaving || isLoading} disabled={!selectedUserId}>
              Save assignment
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
