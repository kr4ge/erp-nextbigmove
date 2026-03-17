'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { ChevronDown, MessageCircle, X } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { workflowSocket } from '@/lib/socket-client';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Manila';

const formatDateInTimezone = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const parseYmdToLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const toSafeDate = (value: Date | string | null | undefined): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return parseYmdToLocalDate(value);
  }
  return new Date();
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatStatusLabel = (
  status: number | string | null,
  statusName?: string | null,
  isAbandoned?: boolean | null,
) => {
  const normalizedStatus = typeof status === 'string' ? Number(status) : status;
  if (normalizedStatus === 0 && isAbandoned) return 'Abandoned';
  if (statusName && statusName.trim()) {
    return statusName
      .trim()
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  if (normalizedStatus === 0) return 'New';
  if (normalizedStatus === null || normalizedStatus === undefined) return '—';
  return String(normalizedStatus);
};

const toNonNegativeNumber = (value: number | null | undefined): number => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
};

const computeReturnRate = (success: number | null | undefined, fail: number | null | undefined): number | null => {
  const successCount = toNonNegativeNumber(success);
  const failCount = toNonNegativeNumber(fail);
  const total = successCount + failCount;
  if (total <= 0) return null;
  return (failCount / total) * 100;
};

const formatReturnRate = (success: number | null | undefined, fail: number | null | undefined): string => {
  const rate = computeReturnRate(success, fail);
  if (rate === null) return '—';
  return `${rate.toFixed(2)}%`;
};

const getReturnRateColorClass = (success: number | null | undefined, fail: number | null | undefined): string => {
  const successCount = toNonNegativeNumber(success);
  const failCount = toNonNegativeNumber(fail);
  const total = successCount + failCount;
  const rate = computeReturnRate(successCount, failCount);

  if (total <= 0 || rate === null) return 'text-slate-900';

  if (successCount === 0) {
    if (failCount >= 3) return 'text-red-600';
    if (failCount === 2) return 'text-amber-500';
    if (failCount === 1) return 'text-emerald-600';
  }

  if (total >= 3) {
    if (rate <= 69) return 'text-emerald-600';
    if (rate <= 80) return 'text-amber-500';
    return 'text-red-600';
  }

  if (rate <= 69) return 'text-emerald-600';
  if (rate <= 80) return 'text-amber-500';
  return 'text-red-600';
};

type ShopOption = {
  shop_id: string;
  shop_name: string;
};

type ConfirmationOrderRow = {
  id: string;
  shop_id: string;
  shop_name: string;
  pos_order_id: string;
  date_local: string;
  inserted_at: string;
  inserted_at_local?: string;
  status: number | null;
  status_name: string | null;
  is_abandoned?: boolean | null;
  cod: number;
  reports_by_phone_fail: number | null;
  reports_by_phone_success: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  item_data?: unknown;
  order_snapshot?: unknown;
  tags: string[];
};

type ConfirmationResponse = {
  items: ConfirmationOrderRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
  filters: {
    shops: ShopOption[];
  };
  selected: {
    start_date: string;
    end_date: string;
    shop_ids: string[];
    search: string;
  };
};

type ConfirmationResponseItemRaw = ConfirmationOrderRow & {
  isAbandoned?: boolean | null;
  status?: number | string | null;
};

type ParsedSnapshotItem = {
  id: string;
  quantity: number;
  name: string;
  productDisplayId: string;
  displayId: string;
  retailPrice: number;
  imageUrl: string;
};

type ParsedOrderSnapshotCustomer = {
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  succeedOrderCount: number;
  orderCount: number;
};

type ParsedOrderSnapshotShippingAddress = {
  fullName: string;
  phoneNumber: string;
  fullAddress: string;
};

type ParsedOrderSnapshot = {
  note: string;
  items: ParsedSnapshotItem[];
  customer: ParsedOrderSnapshotCustomer;
  shippingAddress: ParsedOrderSnapshotShippingAddress;
  conversationId: string;
};

const CONFIRMATION_STATUS_OPTIONS = [
  { label: 'Restocking', value: 11 },
  { label: 'Cancel', value: 6 },
  { label: 'Confirm', value: 1 },
] as const;

const getConfirmationStatusOptionLabel = (value: number | null): string | null => {
  if (typeof value !== 'number') return null;
  const found = CONFIRMATION_STATUS_OPTIONS.find((item) => item.value === value);
  return found?.label || null;
};

const normalizeLineBreaks = (value: string) => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const toCount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const toAmount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const parseSnapshotItems = (value: unknown): ParsedSnapshotItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const item = toRecord(entry);
      if (!item) return null;
      const variation = toRecord(item.variation_info || item.variationInfo);
      const images = Array.isArray(variation?.images) ? variation.images : [];
      const firstImage = images.find((img) => typeof img === 'string' && img.trim().length > 0);

      return {
        id: toText(item.id),
        quantity: toCount(item.quantity),
        name: toText(variation?.name || item.note_product || item.variation_name),
        productDisplayId: toText(variation?.product_display_id || item.product_display_id),
        displayId: toText(variation?.display_id || item.display_id),
        retailPrice: toAmount(variation?.retail_price || item.retail_price),
        imageUrl: typeof firstImage === 'string' ? firstImage : '',
      };
    })
    .filter((entry): entry is ParsedSnapshotItem => !!entry);
};

const parseOrderSnapshot = (value: unknown): ParsedOrderSnapshot => {
  const snapshot = toRecord(value);
  const customerRaw = toRecord(snapshot?.customer);
  const shippingRaw = toRecord(snapshot?.shipping_address || snapshot?.shippingAddress);

  const phoneFromList = Array.isArray(customerRaw?.phone_numbers)
    ? toText(customerRaw?.phone_numbers[0])
    : '';

  return {
    note: normalizeLineBreaks(toText(snapshot?.note)),
    items: parseSnapshotItems(snapshot?.items),
    customer: {
      name: toText(customerRaw?.name),
      phone: toText(customerRaw?.phone_number) || phoneFromList,
      email: Array.isArray(customerRaw?.emails) ? toText(customerRaw?.emails[0]) : '',
      dateOfBirth: toText(customerRaw?.date_of_birth),
      gender: toText(customerRaw?.gender),
      succeedOrderCount: toCount(customerRaw?.succeed_order_count),
      orderCount: toCount(customerRaw?.order_count),
    },
    shippingAddress: {
      fullName: toText(shippingRaw?.full_name),
      phoneNumber: toText(shippingRaw?.phone_number),
      fullAddress: toText(shippingRaw?.full_address),
    },
    conversationId: toText(snapshot?.conversation_id || snapshot?.conversationId),
  };
};

type TenantSocketPayload = {
  tenantId?: string;
  teamId?: string | null;
};

export default function OrdersConfirmationPage() {
  const today = formatDateInTimezone(new Date());
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [range, setRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: parseYmdToLocalDate(today),
    endDate: parseYmdToLocalDate(today),
  });

  const [rows, setRows] = useState<ConfirmationOrderRow[]>([]);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<ConfirmationOrderRow | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [draftStatus, setDraftStatus] = useState<number | null>(null);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [statusSaveError, setStatusSaveError] = useState<string | null>(null);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([]);
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([]);
  const [isAllShopsMode, setIsAllShopsMode] = useState(true);
  const [shopSearch, setShopSearch] = useState('');
  const [showShopPicker, setShowShopPicker] = useState(false);
  const shopPickerRef = useRef<HTMLDivElement | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [pagination, setPagination] = useState({
    page: 1,
    limit: pageSize,
    total: 0,
    pageCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchDataRef = useRef<(options?: { silent?: boolean }) => Promise<void>>();
  const selectedShopIdsKey = useMemo(() => selectedShopIds.join('|'), [selectedShopIds]);

  const filteredShopOptions = useMemo(() => {
    const term = shopSearch.trim().toLowerCase();
    if (!term) return shopOptions;
    return shopOptions.filter((shop) => {
      const id = shop.shop_id.toLowerCase();
      const name = shop.shop_name.toLowerCase();
      return id.includes(term) || name.includes(term);
    });
  }, [shopOptions, shopSearch]);

  const resolvedSelectedShopIds = useMemo(() => {
    if (isAllShopsMode) return shopOptions.map((shop) => shop.shop_id);
    return selectedShopIds;
  }, [isAllShopsMode, selectedShopIds, shopOptions]);

  const selectedShopLabel = isAllShopsMode
    ? 'All shops'
    : selectedShopIds.length === 0
      ? 'No shops selected'
      : `${selectedShopIds.length} selected`;

  const fetchData = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      if (!isAllShopsMode && selectedShopIds.length > 0) {
        selectedShopIds.forEach((shopId) => params.append('shop_id', shopId));
      }

      const response = await apiClient.get<ConfirmationResponse>(
        `/orders/confirmation?${params.toString()}`,
      );
      const data = response.data;

      const normalizedItems = ((data.items || []) as ConfirmationResponseItemRaw[]).map((item) => ({
        ...item,
        status: typeof item.status === 'string' ? Number(item.status) : item.status,
        is_abandoned: item.is_abandoned ?? item.isAbandoned ?? false,
      })) as ConfirmationOrderRow[];

      setRows(normalizedItems);
      setPagination(data.pagination || { page: 1, limit: pageSize, total: 0, pageCount: 0 });

      const nextShopOptions = data.filters?.shops || [];
      setShopOptions(nextShopOptions);

      if (!isAllShopsMode) {
        const validShopIds = new Set(nextShopOptions.map((shop) => shop.shop_id));
        setSelectedShopIds((prev) => prev.filter((shopId) => validShopIds.has(shopId)));
      }
    } catch (err: unknown) {
      const message =
        (typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === 'string' &&
          (err as { response?: { data?: { message?: string } } }).response?.data?.message) ||
        (err instanceof Error ? err.message : null) ||
        'Failed to load confirmation orders';
      setError(message);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  fetchDataRef.current = fetchData;

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, page, selectedShopIdsKey, isAllShopsMode]);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, selectedShopIdsKey, isAllShopsMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (showShopPicker && shopPickerRef.current && target && !shopPickerRef.current.contains(target)) {
        setShowShopPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShopPicker]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tenantId = localStorage.getItem('current_tenant_id');
    if (!tenantId) return;

    let teamId: string | null = null;
    const teamIdsRaw = localStorage.getItem('current_team_ids');
    const singleTeam = localStorage.getItem('current_team_id');
    if (teamIdsRaw) {
      try {
        const parsed = JSON.parse(teamIdsRaw);
        if (Array.isArray(parsed) && parsed.length === 1) {
          teamId = parsed[0];
        }
      } catch {
        // ignore
      }
    } else if (singleTeam && singleTeam !== 'ALL_TEAMS') {
      teamId = singleTeam;
    }

    const socket = workflowSocket.connect();
    socket.emit('subscribe:tenant', { tenantId, teamId });

    const handler = (payload: TenantSocketPayload) => {
      if (!payload || payload.tenantId !== tenantId) return;
      if (teamId && payload.teamId && payload.teamId !== teamId) return;
      fetchDataRef.current?.({ silent: true });
    };

    socket.on('orders:confirmation:updated', handler);
    socket.on('marketing:updated', handler);

    return () => {
      socket.off('orders:confirmation:updated', handler);
      socket.off('marketing:updated', handler);
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchDataRef.current?.({ silent: true });
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedOrderForModal) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedOrderForModal(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedOrderForModal]);

  useEffect(() => {
    if (!selectedOrderForModal) {
      setDraftStatus(null);
      setStatusSaveError(null);
      setIsSavingStatus(false);
      setIsStatusMenuOpen(false);
      setShowTagPicker(false);
      return;
    }
    setDraftStatus(null);
    setStatusSaveError(null);
    setIsSavingStatus(false);
    setIsStatusMenuOpen(false);
    setShowTagPicker(false);
  }, [selectedOrderForModal]);

  const handleDateRangeChange = (val: { startDate: Date | string | null; endDate: Date | string | null } | null) => {
    const nextStart = toSafeDate(val?.startDate);
    const nextEnd = toSafeDate(val?.endDate);
    setRange({ startDate: nextStart, endDate: nextEnd });
    setStartDate(formatDateInTimezone(nextStart));
    setEndDate(formatDateInTimezone(nextEnd));
  };

  const toggleShop = (shopId: string) => {
    setIsAllShopsMode(false);
    setSelectedShopIds((prev) =>
      prev.includes(shopId) ? prev.filter((value) => value !== shopId) : [...prev, shopId],
    );
  };

  const startRow = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endRow = Math.min(pagination.page * pagination.limit, pagination.total);
  const canPrev = pagination.page > 1;
  const canNext = pagination.page < Math.max(1, pagination.pageCount);

  const modalSnapshot = useMemo(
    () => parseOrderSnapshot(selectedOrderForModal?.order_snapshot),
    [selectedOrderForModal?.order_snapshot],
  );
  const modalItems = modalSnapshot.items;
  const modalStatusLabel = selectedOrderForModal
    ? formatStatusLabel(
        selectedOrderForModal.status,
        selectedOrderForModal.status_name,
        selectedOrderForModal.is_abandoned,
      )
    : '—';
  const draftStatusLabel = getConfirmationStatusOptionLabel(draftStatus);
  const statusDisplayLabel = draftStatusLabel || modalStatusLabel;
  const hasStatusDraftChanges = draftStatus !== null;

  const handleSaveStatus = async () => {
    if (!selectedOrderForModal || draftStatus === null || isSavingStatus) return;
    setIsSavingStatus(true);
    setStatusSaveError(null);
    try {
      await apiClient.patch(`/orders/confirmation/${selectedOrderForModal.id}/status`, {
        status: draftStatus,
      });
      setSelectedOrderForModal(null);
      fetchDataRef.current?.({ silent: true });
    } catch (err: unknown) {
      const message =
        (typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === 'string' &&
          (err as { response?: { data?: { message?: string } } }).response?.data?.message) ||
        (err instanceof Error ? err.message : null) ||
        'Failed to update order status';
      setStatusSaveError(message);
    } finally {
      setIsSavingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Confirmation of Order"
        description="Queue of new POS orders (status 0). Rows auto-refresh when webhook reconciliation updates your tenant."
      />

      <Card className="border-slate-200 shadow-sm bg-white">
        <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
          <div className="relative order-1" ref={shopPickerRef}>
            <button
              type="button"
              onClick={() => setShowShopPicker((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white hover:border-slate-300 focus:outline-none"
            >
              <span className="text-slate-900">{selectedShopLabel}</span>
              <span className="text-slate-400 text-xs">(click to choose)</span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>

            {showShopPicker && (
              <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-700">Select shops</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    onClick={() => {
                      setIsAllShopsMode(true);
                      setSelectedShopIds([]);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="px-3 py-2 border-b border-slate-100">
                  <input
                    type="text"
                    value={shopSearch}
                    onChange={(event) => setShopSearch(event.target.value)}
                    placeholder="Search store"
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="max-h-64 overflow-auto">
                  <div className="flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAllShopsMode}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setIsAllShopsMode(checked);
                          if (checked) {
                            setSelectedShopIds([]);
                          }
                        }}
                        className="rounded border-slate-300"
                      />
                      <span>All</span>
                    </label>
                  </div>
                  {filteredShopOptions.map((shop) => {
                    const checked = resolvedSelectedShopIds.includes(shop.shop_id);
                    return (
                      <div
                        key={shop.shop_id}
                        className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleShop(shop.shop_id)}
                            className="rounded border-slate-300"
                          />
                          <span>{shop.shop_name}</span>
                        </label>
                        <button
                          type="button"
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                          onClick={() => {
                            setIsAllShopsMode(false);
                            setSelectedShopIds([shop.shop_id]);
                          }}
                        >
                          ONLY
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative order-2">
            <Datepicker
              value={range}
              onChange={handleDateRangeChange}
              inputClassName="w-[240px] rounded-lg border border-slate-200 pl-3 pr-10 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-slate-300"
              popupClassName={(defaultClass: string) => `${defaultClass} z-50`}
              displayFormat="MM/DD/YYYY"
              separator=" - "
              toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              placeholder=""
            />
          </div>
        </div>

        {error ? (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Shop</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">COD</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Tags</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Return Rate</th>
                  <th className="w-[200px] min-w-[200px] px-2 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap sticky right-0 z-20 bg-slate-50 border-l border-slate-200">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-400" colSpan={9}>
                      Loading...
                    </td>
                  </tr>
                ) : rows.length > 0 ? (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="bg-white cursor-pointer hover:bg-slate-50/80 transition-colors"
                      onClick={() => setSelectedOrderForModal(row)}
                    >
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.date_local}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.shop_name}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap">{row.pos_order_id}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.customer_name || '—'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.customer_phone || '—'}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(row.cod || 0)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                        {row.tags?.length ? row.tags.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold whitespace-nowrap">
                        <span className="relative inline-flex cursor-help group">
                          <span className={getReturnRateColorClass(row.reports_by_phone_success, row.reports_by_phone_fail)}>
                            {formatReturnRate(row.reports_by_phone_success, row.reports_by_phone_fail)}
                          </span>
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-[60] mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-md group-hover:block">
                            Success: {toNonNegativeNumber(row.reports_by_phone_success)} | Fail:{' '}
                            {toNonNegativeNumber(row.reports_by_phone_fail)}
                          </span>
                        </span>
                      </td>
                      <td className="w-[200px] min-w-[200px] px-2 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap sticky right-0 z-10 bg-white border-l border-slate-100">
                        <div className="inline-flex w-full items-center justify-between gap-3 rounded-xl bg-slate-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                          <span className="truncate">
                            {formatStatusLabel(row.status, row.status_name, row.is_abandoned)}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-white/90" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-400" colSpan={9}>
                      No new orders for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Showing {startRow}-{endRow} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={!canPrev || isLoading}
              >
                Previous
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!canNext || isLoading}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </Card>

      {isMounted && selectedOrderForModal
        ? createPortal(
        <div
          className="fixed inset-0 z-[120] overflow-y-auto bg-slate-900/40 p-3 sm:p-6"
          onClick={() => setSelectedOrderForModal(null)}
        >
          <div
            className="mx-auto my-2 flex w-[min(96vw,1480px)] max-w-none flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl sm:my-4 md:max-h-[calc(100vh-3rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order Detail</p>
                <h3 className="text-xl font-semibold text-slate-900">
                  {selectedOrderForModal.shop_id} - {selectedOrderForModal.pos_order_id}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {modalSnapshot.conversationId ? (
                  <span
                    className="inline-flex rounded-xl border-2 border-blue-400 p-2 text-blue-500"
                    title={`Conversation ID: ${modalSnapshot.conversationId}`}
                    aria-label="Conversation available"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedOrderForModal(null)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Close order modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-8">
                <h4 className="mb-3 text-base font-semibold text-slate-900">Product Information</h4>
                {modalItems.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-3">
                    <div className="mb-3 flex flex-wrap items-center gap-5 text-sm font-semibold text-slate-700">
                      <p>Number of variation: {modalItems.length}</p>
                      <p>Total quantity: {modalItems.reduce((total, item) => total + item.quantity, 0)}</p>
                    </div>
                    <div className="space-y-2">
                      {modalItems.map((item, index) => (
                        <div
                          key={`${item.id || item.productDisplayId || item.displayId || item.name}-${index}`}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800"
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name || 'Product image'}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>

                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {item.productDisplayId ? (
                                      <span className="inline-flex rounded-lg border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                                        {item.productDisplayId}
                                      </span>
                                    ) : null}
                                    {item.displayId ? (
                                      <span className="inline-flex rounded-lg border border-pink-300 bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-700">
                                        {item.displayId}
                                      </span>
                                    ) : null}
                                    <p className="truncate text-sm font-semibold text-slate-900">{item.name || '—'}</p>
                                  </div>
                                </div>

                                <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
                                  <div className="flex items-center gap-2 text-sm text-slate-800">
                                    <span className="inline-flex min-w-[86px] justify-end rounded-lg bg-slate-100 px-3 py-1.5 font-semibold">
                                      {Math.round(item.retailPrice)}
                                    </span>
                                    <span className="text-xl leading-none">x</span>
                                    <span className="inline-flex min-w-[56px] justify-end rounded-lg bg-slate-100 px-3 py-1.5 font-semibold">
                                      {item.quantity}
                                    </span>
                                  </div>
                                  <p className="text-lg font-semibold text-blue-700">
                                    {formatCurrency(item.retailPrice * item.quantity)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No orderSnapshot.items data available.</p>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-4">
                <h4 className="mb-3 text-base font-semibold text-slate-900">Order Information</h4>
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-base font-medium text-slate-900">Created At</p>
                    <p className="inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-900">
                      {selectedOrderForModal.date_local}
                    </p>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-base font-medium text-slate-900">Status</p>
                    <div
                      className="relative"
                      onMouseEnter={() => setIsStatusMenuOpen(true)}
                      onMouseLeave={() => setIsStatusMenuOpen(false)}
                    >
                      <button
                        type="button"
                        onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                        className="inline-flex min-w-[160px] max-w-full items-center justify-between gap-3 rounded-xl bg-slate-500 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                      >
                        <span className="truncate">{statusDisplayLabel}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-white/90" />
                      </button>
                      {isStatusMenuOpen ? (
                        <div className="absolute right-0 top-full z-30 mt-0 min-w-[180px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                          {CONFIRMATION_STATUS_OPTIONS.map((item) => {
                            const active = draftStatus === item.value;
                            return (
                              <button
                                key={item.value}
                                type="button"
                                onClick={() => {
                                  setDraftStatus(item.value);
                                  setIsStatusMenuOpen(false);
                                }}
                                className={`block w-full px-3 py-2 text-left text-sm ${
                                  active ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {selectedOrderForModal.tags?.length ? (
                          selectedOrderForModal.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">No tags</span>
                        )}
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowTagPicker((prev) => !prev)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Add Tags
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        {showTagPicker ? (
                          <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                            <p className="text-xs text-slate-500">Tag list will be connected here.</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-6">
                <h4 className="mb-3 text-base font-semibold text-slate-900">Note</h4>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="whitespace-pre-wrap break-words text-sm leading-8 text-slate-700">
                    {modalSnapshot.note || '—'}
                  </p>
                </div>
              </section>

              <div className="space-y-4 lg:col-span-6">
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-base font-semibold text-slate-900">Customer</h4>
                    <div className="inline-flex items-center gap-2">
                      <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700">
                        {modalSnapshot.customer.gender || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-900">
                      {modalSnapshot.customer.name || '—'}
                    </div>
                    <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-900">
                      {modalSnapshot.customer.phone || '—'}
                    </div>
                    <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-500">
                      {modalSnapshot.customer.email || 'Email'}
                    </div>
                    <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-500">
                      {modalSnapshot.customer.dateOfBirth || 'Date of birth'}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                    <p className="text-base font-semibold text-slate-900">{modalSnapshot.customer.name || '—'}</p>
                    <p className="text-sm text-blue-700">{modalSnapshot.customer.phone || '—'}</p>
                    <div className="mt-2 border-t border-sky-200 pt-2 text-sm text-slate-700">
                      <p>
                        Success:{' '}
                        <span className="font-semibold text-slate-900">
                          {modalSnapshot.customer.succeedOrderCount}/{modalSnapshot.customer.orderCount}
                        </span>{' '}
                        order(s)
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="mb-3 text-base font-semibold text-slate-900">Delivery</h4>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-900">
                        {modalSnapshot.shippingAddress.fullName || '—'}
                      </div>
                      <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-900">
                        {modalSnapshot.shippingAddress.phoneNumber || '—'}
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-900">
                      {modalSnapshot.shippingAddress.fullAddress || '—'}
                    </div>
                  </div>
                </section>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
                  Status: {statusDisplayLabel}
                </span>
                {statusSaveError ? (
                  <span className="text-sm text-rose-600">{statusSaveError}</span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={!hasStatusDraftChanges || isSavingStatus}
                className="inline-flex min-w-[140px] items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSavingStatus ? 'Saving...' : 'Save'}
              </button>
            </div>
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}
    </div>
  );
}
