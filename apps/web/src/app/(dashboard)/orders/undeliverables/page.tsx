'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronDown, RefreshCw, Search, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { AnalyticsMultiSelectPicker } from '../../analytics/_components/analytics-multi-select-picker';
import { useWorkflowTenantEvent } from '../../analytics/_hooks/use-workflow-tenant-event';
import {
  formatDateInTimezone,
  normalizeDatepickerValue,
  parseYmdToLocalDate,
} from '../../analytics/_utils/date';
import { UndeliverablesAssignmentsDialog } from '../_components/undeliverables-assignments-dialog';
import { UndeliverablesRemarkOptionsDialog } from '../_components/undeliverables-remark-options-dialog';
import { UndeliverablesTable } from '../_components/undeliverables-table';
import { UndeliverableTrackingPanel } from '../_components/undeliverable-tracking-panel';
import { useOrdersPermissions } from '../_hooks/use-orders-permissions';
import {
  createUndeliverableRemark,
  fetchUndeliverableAssignments,
  fetchUndeliverableRemarkOptions,
  fetchUndeliverables,
  saveUndeliverableAssignments,
  updateUndeliverableRemark,
} from '../_services/undeliverables-api';
import type {
  UndeliverableRemarkOption,
  UndeliverableRow,
  UndeliverablesAssignmentsResponse,
  UndeliverablesResponse,
} from '../_types/undeliverables';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });
const PAGE_SIZE = 20;
type UndeliverablesRemarkView = 'needs_remarks' | 'with_remarks';

export default function UndeliverablesPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const {
    isLoading: permissionsLoading,
    canViewOrdersSummary,
    canViewOrderConfirmation,
    canViewUndeliverables,
    canViewAllUndeliverables,
    canAssignUndeliverables,
    canWriteUndeliverableRemarks,
  } = useOrdersPermissions();

  const today = useMemo(() => formatDateInTimezone(new Date()), []);
  const [dateRange, setDateRange] = useState(() => ({
    startDate: parseYmdToLocalDate(today),
    endDate: parseYmdToLocalDate(today),
  }));
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [remarkView, setRemarkView] = useState<UndeliverablesRemarkView>('needs_remarks');
  const [failedAtOrder, setFailedAtOrder] = useState<'asc' | 'desc'>('asc');
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UndeliverablesResponse | null>(null);
  const [remarkOptions, setRemarkOptions] = useState<UndeliverableRemarkOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [remarkOptionsOpen, setRemarkOptionsOpen] = useState(false);
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [assignmentsData, setAssignmentsData] = useState<UndeliverablesAssignmentsResponse | null>(null);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [trackingRow, setTrackingRow] = useState<UndeliverableRow | null>(null);
  const storePickerRef = useRef<HTMLDivElement | null>(null);
  const loadUndeliverablesRef = useRef<null | (() => Promise<void>)>(null);
  const loadAssignmentsRef = useRef<null | (() => Promise<void>)>(null);
  const loadRemarkOptionsRef = useRef<null | (() => Promise<void>)>(null);

  const startDate = useMemo(
    () => normalizeDatepickerValue(dateRange.startDate, today),
    [dateRange.startDate, today],
  );
  const endDate = useMemo(
    () => normalizeDatepickerValue(dateRange.endDate ?? dateRange.startDate, today),
    [dateRange.endDate, dateRange.startDate, today],
  );

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, selectedStoreIds, selectedStatuses, searchTerm, remarkView, failedAtOrder]);

  useEffect(() => {
    if (!showStorePicker) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!storePickerRef.current?.contains(target)) {
        setShowStorePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStorePicker]);

  useEffect(() => {
    if (permissionsLoading || canViewUndeliverables) {
      return;
    }

    if (canViewOrdersSummary) {
      router.replace('/orders/summary');
      return;
    }

    if (canViewOrderConfirmation) {
      router.replace('/orders/confirmation');
      return;
    }

    router.replace('/dashboard');
  }, [
    canViewOrderConfirmation,
    canViewOrdersSummary,
    canViewUndeliverables,
    permissionsLoading,
    router,
  ]);

  const loadUndeliverables = useCallback(async () => {
    if (!canViewUndeliverables) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchUndeliverables({
        startDate,
        endDate,
        view: remarkView,
        failedAtOrder,
        storeIds: selectedStoreIds,
        statuses: selectedStatuses,
        search: searchTerm,
        page,
        limit: PAGE_SIZE,
      });
      setData(response);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load undeliverables.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [canViewUndeliverables, endDate, failedAtOrder, page, remarkView, searchTerm, selectedStatuses, selectedStoreIds, startDate]);

  useEffect(() => {
    void loadUndeliverables();
  }, [loadUndeliverables]);

  useEffect(() => {
    loadUndeliverablesRef.current = loadUndeliverables;
  }, [loadUndeliverables]);

  const loadRemarkOptions = useCallback(async () => {
    if (!canWriteUndeliverableRemarks) {
      setRemarkOptions([]);
      return;
    }

    try {
      const response = await fetchUndeliverableRemarkOptions();
      setRemarkOptions(response.items);
    } catch (loadError) {
      addToast('error', loadError instanceof Error ? loadError.message : 'Failed to load SA remarks.');
    }
  }, [addToast, canWriteUndeliverableRemarks]);

  useEffect(() => {
    void loadRemarkOptions();
  }, [loadRemarkOptions]);

  useEffect(() => {
    loadRemarkOptionsRef.current = loadRemarkOptions;
  }, [loadRemarkOptions]);

  const loadAssignments = useCallback(async () => {
    if (!canAssignUndeliverables && !canViewAllUndeliverables) {
      return;
    }

    setIsAssignmentsLoading(true);
    try {
      const response = await fetchUndeliverableAssignments();
      setAssignmentsData(response);
    } catch (loadError) {
      addToast('error', loadError instanceof Error ? loadError.message : 'Failed to load store assignments.');
    } finally {
      setIsAssignmentsLoading(false);
    }
  }, [addToast, canAssignUndeliverables, canViewAllUndeliverables]);

  useEffect(() => {
    loadAssignmentsRef.current = loadAssignments;
  }, [loadAssignments]);

  useWorkflowTenantEvent('orders:undeliverables:updated', () => {
    void loadUndeliverablesRef.current?.();
    if (assignmentsOpen) {
      void loadAssignmentsRef.current?.();
    }
    if (remarkOptionsOpen) {
      void loadRemarkOptionsRef.current?.();
    }
  });

  const handleOpenAssignments = async () => {
    setAssignmentsOpen(true);
    if (!assignmentsData) {
      await loadAssignments();
    }
  };

  const handleSaveAssignments = async (userId: string, storeIds: string[]) => {
    await saveUndeliverableAssignments(userId, storeIds);
    addToast('success', 'Undeliverables assignments updated.');
    await Promise.all([loadAssignments(), loadUndeliverables()]);
  };

  const handleSaveRemark = async (row: UndeliverableRow, remarkOptionId: string) => {
    if (row.latest_remark?.id) {
      await updateUndeliverableRemark(row.latest_remark.id, remarkOptionId);
      addToast('success', 'SA remark updated.');
    } else {
      await createUndeliverableRemark(row.id, remarkOptionId);
      addToast('success', 'SA remark added.');
    }

    await loadUndeliverables();
  };

  const storeOptions = useMemo(
    () => (data?.filters.stores.map((store) => ({
      value: store.store_id,
      label: store.store_name,
    })) ?? []),
    [data?.filters.stores],
  );

  const statusOptions = useMemo(
    () => (data?.filters.statuses.map((status) => ({
      value: status.value,
      label: status.label,
    })) ?? []),
    [data?.filters.statuses],
  );
  const filteredStoreOptions = useMemo(() => {
    const keyword = storeSearch.trim().toLowerCase();
    if (!keyword) return storeOptions;
    return storeOptions.filter((store) => store.label.toLowerCase().includes(keyword));
  }, [storeOptions, storeSearch]);

  const isAllStoresMode = selectedStoreIds.length === 0;
  const isAllStatusesMode = selectedStatuses.length === 0;

  const selectedStoreLabel = useMemo(() => {
    if (storeOptions.length === 0) {
      return 'No stores';
    }
    if (isAllStoresMode) {
      return 'All stores';
    }
    if (selectedStoreIds.length === 1) {
      return storeOptions.find((option) => option.value === selectedStoreIds[0])?.label ?? '1 store';
    }
    return `${selectedStoreIds.length} stores`;
  }, [isAllStoresMode, selectedStoreIds, storeOptions]);

  const selectedStatusLabel = useMemo(() => {
    if (statusOptions.length === 0) {
      return 'No statuses';
    }
    if (isAllStatusesMode) {
      return 'All statuses';
    }
    if (selectedStatuses.length === 1) {
      return statusOptions.find((option) => option.value === selectedStatuses[0])?.label ?? '1 status';
    }
    return `${selectedStatuses.length} statuses`;
  }, [isAllStatusesMode, selectedStatuses, statusOptions]);

  const undeliverablesDateRangeIsToday = startDate === today && endDate === today;
  const undeliverablesDateRangeButtonLabel = useMemo(() => {
    const formatYmdForButton = (value: string) => {
      const parsed = parseYmdToLocalDate(value);
      if (!parsed) return value;
      return parsed.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      });
    };

    const startLabel = formatYmdForButton(startDate);
    const endLabel = formatYmdForButton(endDate);

    if (startLabel === endLabel) return startLabel;
    return `${startLabel} – ${endLabel}`;
  }, [endDate, startDate]);

  if (permissionsLoading || !canViewUndeliverables) {
    return <LoadingCard label="Loading undeliverables..." />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-border md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs-tight font-semibold uppercase tracking-[0.2em] text-primary">
            Orders
          </p>
          <div className="space-y-0.5">
            <h1 className="text-xl-loose font-semibold tracking-tight text-foreground">Undeliverables</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Track each failed delivery attempt by assigned store owner.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {(canAssignUndeliverables || canViewAllUndeliverables) ? (
            <Button
              type="button"
              variant="outline"
              iconLeft={<Settings2 className="h-4 w-4" />}
              onClick={() => {
                void handleOpenAssignments();
              }}
            >
              Manage assignment
            </Button>
          ) : null}
          {canWriteUndeliverableRemarks ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemarkOptionsOpen(true)}
            >
              Manage remarks
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            iconLeft={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={() => {
              void loadUndeliverables();
            }}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </header>

      <div className="space-y-3">
        <div className="flex items-center gap-6 border-b border-slate-200 dark:border-border">
          {[
            { value: 'needs_remarks' as const, label: 'Needs remarks' },
            { value: 'with_remarks' as const, label: 'With remarks' },
          ].map((tab) => {
            const active = remarkView === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setRemarkView(tab.value)}
                className={`border-b-2 px-0 pb-2 text-sm font-semibold transition ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-border dark:bg-surface">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    setSearchTerm(searchInput.trim());
                  }
                }}
                placeholder="Search order ID, waybill, customer, or phone"
                className="h-7 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm(searchInput.trim())}
              >
                Search
              </Button>
            </div>

            <AnalyticsMultiSelectPicker
              selectedLabel={selectedStatusLabel}
              selectTitle="Select statuses"
              options={statusOptions}
              allChecked={isAllStatusesMode}
              isChecked={(value) => selectedStatuses.includes(value)}
              onToggleAll={() => setSelectedStatuses([])}
              onToggle={(value) =>
                setSelectedStatuses((current) =>
                  current.includes(value)
                    ? current.filter((entry) => entry !== value)
                    : [...current, value],
                )
              }
              onOnly={(value) => setSelectedStatuses([value])}
              onClear={() => setSelectedStatuses([])}
              className="relative"
              buttonClassName="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm hover:border-slate-300 focus:outline-none dark:border-border dark:bg-surface dark:text-foreground dark:hover:border-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative order-1" ref={storePickerRef}>
              <button
                type="button"
                onClick={() => setShowStorePicker((prev) => !prev)}
                className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm hover:border-slate-300 focus:outline-none dark:border-border dark:bg-surface dark:text-foreground dark:hover:border-slate-500"
              >
                <span className="text-slate-900 dark:text-foreground">{selectedStoreLabel}</span>
                <span className="text-xs text-slate-400 dark:text-slate-300">(click to choose)</span>
                <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-300" />
              </button>

              {showStorePicker ? (
                <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-border dark:bg-surface">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-border">
                    <span className="text-sm text-slate-700 dark:text-foreground">Select stores</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-orange-300 dark:hover:text-orange-200"
                      onClick={() => setSelectedStoreIds([])}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="border-b border-slate-100 px-3 py-2 dark:border-border">
                    <input
                      type="text"
                      value={storeSearch}
                      onChange={(event) => setStoreSearch(event.target.value)}
                      placeholder="Search store"
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-border dark:bg-background dark:text-foreground dark:placeholder:text-slate-400"
                    />
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <div className="flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-background-secondary">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isAllStoresMode}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedStoreIds([]);
                            }
                          }}
                          className="rounded border-slate-300 dark:border-border"
                        />
                        <span>All</span>
                      </label>
                    </div>
                    {filteredStoreOptions.map((store) => {
                      const checked = selectedStoreIds.includes(store.value);
                      return (
                        <div
                          key={store.value}
                          className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-background-secondary"
                        >
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedStoreIds((current) =>
                                  current.includes(store.value)
                                    ? current.filter((entry) => entry !== store.value)
                                    : [...current, store.value],
                                )
                              }
                              className="rounded border-slate-300 dark:border-border"
                            />
                            <span>{store.label}</span>
                          </label>
                          <button
                            type="button"
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-orange-300 dark:hover:text-orange-200"
                            onClick={() => setSelectedStoreIds([store.value])}
                          >
                            ONLY
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative order-2">
              <Datepicker
                value={dateRange}
                onChange={(value) => {
                  const nextStart = normalizeDatepickerValue(value?.startDate, today);
                  const nextEnd = normalizeDatepickerValue(value?.endDate ?? value?.startDate, nextStart);
                  setDateRange({
                    startDate: parseYmdToLocalDate(nextStart),
                    endDate: parseYmdToLocalDate(nextEnd),
                  });
                }}
                useRange
                asSingle={false}
                showShortcuts={false}
                showFooter={false}
                primaryColor="orange"
                readOnly
                inputClassName={`h-10 cursor-pointer rounded-xl border border-slate-200 bg-white p-0 text-transparent caret-transparent placeholder:text-transparent shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 transition-[width] duration-300 ease-out dark:!border-border dark:!bg-transparent dark:!text-transparent ${
                  undeliverablesDateRangeIsToday ? 'w-10' : 'w-[200px] sm:w-[236px]'
                }`}
                containerClassName=""
                popupClassName={(defaultClass: string) => `${defaultClass} z-50 kpi-datepicker-light`}
                displayFormat="MM/DD/YYYY"
                separator=" – "
                toggleIcon={() => (
                  <span className="flex w-full items-center gap-2 overflow-hidden">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span
                      className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out dark:text-foreground ${
                        undeliverablesDateRangeIsToday
                          ? 'max-w-0 -translate-x-1 opacity-0'
                          : 'max-w-[148px] translate-x-0 opacity-100 sm:max-w-[184px]'
                      }`}
                    >
                      {undeliverablesDateRangeButtonLabel}
                    </span>
                  </span>
                )}
                toggleClassName="absolute inset-0 flex cursor-pointer items-center justify-start px-3 text-slate-600 hover:text-orange-700 dark:text-foreground"
                placeholder=" "
              />
            </div>
          </div>
        </div>
      </div>

      {error ? <AlertBanner tone="error" message={error} /> : null}

      <UndeliverablesTable
        rows={data?.items ?? []}
        page={data?.pagination.page ?? page}
        totalPages={data?.pagination.pageCount ?? 0}
        total={data?.pagination.total ?? 0}
        limit={data?.pagination.limit ?? PAGE_SIZE}
        isLoading={isLoading}
        canViewAll={canViewAllUndeliverables}
        canWriteRemarks={canWriteUndeliverableRemarks}
        failedAtOrder={failedAtOrder}
        remarkOptions={remarkOptions}
        onSaveRemark={handleSaveRemark}
        onOpenTracking={setTrackingRow}
        onToggleFailedAtOrder={() => setFailedAtOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
        onPrevious={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => {
          const totalPages = data?.pagination.pageCount ?? 0;
          setPage((current) => (totalPages > 0 ? Math.min(totalPages, current + 1) : current + 1));
        }}
      />

      <UndeliverableTrackingPanel
        row={trackingRow}
        onClose={() => setTrackingRow(null)}
      />

      <UndeliverablesAssignmentsDialog
        open={assignmentsOpen}
        onClose={() => setAssignmentsOpen(false)}
        data={assignmentsData}
        isLoading={isAssignmentsLoading}
        onSave={handleSaveAssignments}
      />

      <UndeliverablesRemarkOptionsDialog
        open={remarkOptionsOpen}
        onClose={() => setRemarkOptionsOpen(false)}
        onChanged={async () => {
          await loadRemarkOptions();
          await loadUndeliverables();
        }}
        onError={(message) => addToast('error', message)}
        onSuccess={(message) => addToast('success', message)}
      />
    </div>
  );
}
