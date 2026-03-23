'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { ChevronDown, Link2, MessageCircle, PencilLine, PhoneCall, Wifi, X } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { workflowSocket } from '@/lib/socket-client';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

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

type OrderStatusMeta = {
  label: string;
  color: string;
};

const ORDER_STATUS_LABELS: Record<number, OrderStatusMeta> = {
  0: { label: 'New', color: '#64748B' },
  1: { label: 'Confirmed', color: '#003EB3' },
  2: { label: 'Shipped', color: '#FA8C16' },
  3: { label: 'Delivered', color: '#52C41A' },
  4: { label: 'Returning', color: '#E0695C' },
  5: { label: 'Returned', color: '#A8071A' },
  6: { label: 'Canceled', color: '#F5222D' },
  7: { label: 'Deleted recently', color: '#434343' },
  8: { label: 'Packaging', color: '#722ED1' },
  9: { label: 'Waiting for pick up', color: '#EB2F96' },
  11: { label: 'Restocking', color: '#AD8B00' },
  12: { label: 'Wait for printing', color: '#13C2C2' },
  13: { label: 'Printed', color: '#08979C' },
  15: { label: 'Partial return', color: '#531DAB' },
  16: { label: 'Collected money', color: '#237804' },
  17: { label: 'Waiting for confirmation', color: '#1677FF' },
  20: { label: 'Purchased', color: '#389E0D' },
};

const FALLBACK_STATUS_META: OrderStatusMeta = {
  label: '—',
  color: '#64748B',
};

const getStatusMeta = (
  status: number | string | null,
  isAbandoned?: boolean | null,
): OrderStatusMeta => {
  const normalizedStatus = typeof status === 'string' ? Number(status) : status;

  if (normalizedStatus === 0 && isAbandoned) {
    return { label: 'Abandoned', color: ORDER_STATUS_LABELS[0].color };
  }

  if (typeof normalizedStatus === 'number' && Number.isFinite(normalizedStatus)) {
    return ORDER_STATUS_LABELS[normalizedStatus] || { label: String(normalizedStatus), color: FALLBACK_STATUS_META.color };
  }

  if (normalizedStatus === null || normalizedStatus === undefined) return FALLBACK_STATUS_META;
  return { label: String(normalizedStatus), color: FALLBACK_STATUS_META.color };
};

const formatStatusLabel = (
  status: number | string | null,
  _statusName?: string | null,
  isAbandoned?: boolean | null,
) => {
  return getStatusMeta(status, isAbandoned).label;
};

const getHistoryStatusBadgeColor = (
  status: number | string | null,
  isAbandoned?: boolean | null,
): string => {
  return getStatusMeta(status, isAbandoned).color;
};

const StatusBadge = ({
  status,
  statusName,
  isAbandoned,
  className,
  showChevron = true,
}: {
  status: number | string | null;
  statusName?: string | null;
  isAbandoned?: boolean | null;
  className?: string;
  showChevron?: boolean;
}) => {
  const statusLabel = formatStatusLabel(status, statusName, isAbandoned);
  const statusColor = getHistoryStatusBadgeColor(status, isAbandoned);

  return (
    <div
      className={`inline-flex items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm ${
        className || ''
      }`}
      style={{ backgroundColor: statusColor }}
    >
      <span className="truncate">{statusLabel}</span>
      {showChevron ? <ChevronDown className="h-4 w-4 shrink-0 text-white/90" /> : null}
    </div>
  );
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

type ConfirmationOrderTagDetail = {
  id: string | null;
  name: string;
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
  has_duplicated_phone?: boolean;
  has_duplicated_ip?: boolean;
  tags: string[];
  tags_detail?: ConfirmationOrderTagDetail[];
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

type PhoneHistoryResponse = {
  items: ConfirmationOrderRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
  selected: {
    phone: string;
    canonical_phone: string;
  };
};

type TagOptionItem = {
  tag_id: string;
  name: string;
};

type TagOptionGroup = {
  group_id: string;
  group_name: string;
  tags: TagOptionItem[];
};

type ConfirmationTagOptionsResponse = {
  order_id: string;
  shop_id: string;
  groups: TagOptionGroup[];
  individual: TagOptionItem[];
  total: number;
};

const normalizeTagNameKey = (value: string): string => value.trim().toLowerCase();

const normalizeTagDetails = (
  tagsDetailRaw: unknown,
  fallbackTagsRaw: unknown,
): ConfirmationOrderTagDetail[] => {
  const normalized: ConfirmationOrderTagDetail[] = [];
  const seen = new Set<string>();

  if (Array.isArray(tagsDetailRaw)) {
    for (const entry of tagsDetailRaw) {
      const source = toRecord(entry);
      if (!source) continue;
      const name = toText(source.name).trim();
      if (!name) continue;
      const idText = toText(source.id).trim();
      const id = idText || null;
      const key = `${id || ''}|${normalizeTagNameKey(name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({ id, name });
    }
  }

  if (normalized.length > 0) return normalized;

  if (Array.isArray(fallbackTagsRaw)) {
    for (const entry of fallbackTagsRaw) {
      const name = toText(entry).trim();
      if (!name) continue;
      const key = `|${normalizeTagNameKey(name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({ id: null, name });
    }
  }

  return normalized;
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
  address: string;
  communeName: string;
  districtName: string;
  provinceName: string;
};

type ParsedOrderSnapshotPayment = {
  totalDiscount: number;
  shippingFee: number;
  surcharge: number;
  bankPaymentsRaw: unknown;
  bankTransfer: number;
};

type ParsedOrderSnapshot = {
  note: string;
  notePrint: string;
  items: ParsedSnapshotItem[];
  customer: ParsedOrderSnapshotCustomer;
  shippingAddress: ParsedOrderSnapshotShippingAddress;
  payment: ParsedOrderSnapshotPayment;
  orderLink: string;
  conversationId: string;
  duplicatedPhone: boolean;
  duplicatedIp: boolean;
};

const CONFIRMATION_STATUS_OPTIONS = [
  { label: 'Restocking', value: 11 },
  { label: 'Cancel', value: 6 },
  { label: 'Delete', value: 7 },
  { label: 'Confirm', value: 1 },
] as const;

const getConfirmationStatusOptionLabel = (value: number | null): string | null => {
  if (typeof value !== 'number') return null;
  const found = CONFIRMATION_STATUS_OPTIONS.find((item) => item.value === value);
  return found?.label || null;
};

const normalizeLineBreaks = (value: string) => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const toApiLineBreaks = (value: string) =>
  normalizeLineBreaks(value).replace(/\n/g, '\r\n');

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const hasNonEmptyText = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const getDeliveryFieldClass = (hasValue: boolean): string =>
  hasValue
    ? 'rounded-md bg-slate-100 px-3 py-2 text-slate-900'
    : 'rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-rose-700';

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

const sumNumericValuesDeep = (value: unknown, depth = 0): number => {
  if (depth > 4) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, entry) => sum + sumNumericValuesDeep(entry, depth + 1), 0);
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (sum, entry) => sum + sumNumericValuesDeep(entry, depth + 1),
      0,
    );
  }
  return 0;
};

const toBooleanFlag = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
};

const extractDuplicateFlagsFromSnapshot = (
  snapshotValue: unknown,
): { duplicatedPhone: boolean; duplicatedIp: boolean } => {
  const snapshot = toRecord(snapshotValue);
  return {
    duplicatedPhone: toBooleanFlag(snapshot?.duplicated_phone ?? snapshot?.duplicatedPhone),
    duplicatedIp: toBooleanFlag(snapshot?.duplicated_ip ?? snapshot?.duplicatedIp),
  };
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
  const bankPaymentsRaw = snapshot?.bank_payments ?? snapshot?.bankPayments ?? null;
  const duplicateFlags = extractDuplicateFlagsFromSnapshot(snapshot);

  const phoneFromList = Array.isArray(customerRaw?.phone_numbers)
    ? toText(customerRaw?.phone_numbers[0])
    : '';

  return {
    note: normalizeLineBreaks(toText(snapshot?.note)),
    notePrint: normalizeLineBreaks(toText(snapshot?.note_print || snapshot?.notePrint)),
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
      address: toText(shippingRaw?.address),
      communeName: toText(shippingRaw?.commune_name || shippingRaw?.commnue_name),
      districtName: toText(shippingRaw?.district_name),
      provinceName: toText(shippingRaw?.province_name),
    },
    payment: {
      totalDiscount: toAmount(snapshot?.total_discount),
      shippingFee: toAmount(snapshot?.shipping_fee),
      surcharge: toAmount(snapshot?.surcharge),
      bankPaymentsRaw,
      bankTransfer: sumNumericValuesDeep(bankPaymentsRaw),
    },
    orderLink: toText(snapshot?.order_link || snapshot?.orderLink),
    conversationId: toText(snapshot?.conversation_id || snapshot?.conversationId),
    duplicatedPhone: duplicateFlags.duplicatedPhone,
    duplicatedIp: duplicateFlags.duplicatedIp,
  };
};

const getHistoryProductSummary = (row: Pick<ConfirmationOrderRow, 'order_snapshot' | 'item_data'>): string => {
  const snapshotItems = parseOrderSnapshot(row.order_snapshot).items;
  if (snapshotItems.length > 0) {
    return snapshotItems
      .map((item) => {
        const itemName = item.name || item.productDisplayId || item.displayId || 'Item';
        const quantity = item.quantity > 0 ? item.quantity : 1;
        return `${itemName} x${quantity}`;
      })
      .join(', ');
  }

  if (Array.isArray(row.item_data)) {
    const fallbackProducts = row.item_data
      .map((entry) => {
        const item = toRecord(entry);
        if (!item) return '';
        const itemName = toText(item.variationName || item.variation_name || item.name || item.note_product);
        const quantity = toCount(item.quantity);
        if (!itemName) return '';
        return `${itemName} x${quantity > 0 ? quantity : 1}`;
      })
      .filter((value) => value.trim().length > 0);

    if (fallbackProducts.length > 0) {
      return fallbackProducts.join(', ');
    }
  }

  return '—';
};

const hasRowProductItems = (row: Pick<ConfirmationOrderRow, 'order_snapshot' | 'item_data'>): boolean => {
  const snapshotItems = parseOrderSnapshot(row.order_snapshot).items;
  if (snapshotItems.length > 0) return true;

  if (!Array.isArray(row.item_data)) return false;
  return row.item_data.some((entry) => {
    const item = toRecord(entry);
    if (!item) return false;
    const productId = toText(item.productId || item.product_id);
    const variationName = toText(item.variationName || item.variation_name || item.name || item.note_product);
    return productId.trim().length > 0 || variationName.trim().length > 0;
  });
};

type TenantSocketPayload = {
  tenantId?: string;
  teamId?: string | null;
};

export default function OrdersConfirmationPage() {
  const { addToast } = useToast();
  const today = formatDateInTimezone(new Date());
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [range, setRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: parseYmdToLocalDate(today),
    endDate: parseYmdToLocalDate(today),
  });

  const [rows, setRows] = useState<ConfirmationOrderRow[]>([]);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<ConfirmationOrderRow | null>(null);
  const [isPhoneHistoryOpen, setIsPhoneHistoryOpen] = useState(false);
  const [phoneHistoryRows, setPhoneHistoryRows] = useState<ConfirmationOrderRow[]>([]);
  const [phoneHistoryLoading, setPhoneHistoryLoading] = useState(false);
  const [phoneHistoryError, setPhoneHistoryError] = useState<string | null>(null);
  const [phoneHistoryCanonicalPhone, setPhoneHistoryCanonicalPhone] = useState('');
  const [phoneHistoryLookupPhone, setPhoneHistoryLookupPhone] = useState('');
  const [phoneHistoryPage, setPhoneHistoryPage] = useState(1);
  const phoneHistoryPageSize = 20;
  const [phoneHistoryPagination, setPhoneHistoryPagination] = useState({
    page: 1,
    limit: phoneHistoryPageSize,
    total: 0,
    pageCount: 0,
  });
  const [isMounted, setIsMounted] = useState(false);
  const [draftStatus, setDraftStatus] = useState<number | null>(null);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [statusSaveError, setStatusSaveError] = useState<string | null>(null);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [draftTags, setDraftTags] = useState<ConfirmationOrderTagDetail[] | null>(null);
  const [activeNoteTab, setActiveNoteTab] = useState<'all' | 'internal' | 'printing'>('all');
  const [draftInternalNote, setDraftInternalNote] = useState<string | null>(null);
  const [draftPrintingNote, setDraftPrintingNote] = useState<string | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagOptions, setTagOptions] = useState<ConfirmationTagOptionsResponse | null>(null);
  const [isTagOptionsLoading, setIsTagOptionsLoading] = useState(false);
  const [tagOptionsError, setTagOptionsError] = useState<string | null>(null);
  const [activeTagGroupId, setActiveTagGroupId] = useState<string | null>(null);
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([]);
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([]);
  const [isAllShopsMode, setIsAllShopsMode] = useState(true);
  const [shopSearch, setShopSearch] = useState('');
  const [showShopPicker, setShowShopPicker] = useState(false);
  const shopPickerRef = useRef<HTMLDivElement | null>(null);
  const tagPickerRef = useRef<HTMLDivElement | null>(null);

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

      const normalizedItems = ((data.items || []) as ConfirmationResponseItemRaw[]).map((item) => {
        const duplicateFlags = extractDuplicateFlagsFromSnapshot(item.order_snapshot);
        const tagDetails = normalizeTagDetails(
          (item as ConfirmationOrderRow).tags_detail,
          item.tags,
        );
        return {
          ...item,
          status: typeof item.status === 'string' ? Number(item.status) : item.status,
          is_abandoned: item.is_abandoned ?? item.isAbandoned ?? false,
          has_duplicated_phone: duplicateFlags.duplicatedPhone,
          has_duplicated_ip: duplicateFlags.duplicatedIp,
          tags_detail: tagDetails,
          tags: tagDetails.map((entry) => entry.name),
        };
      }) as ConfirmationOrderRow[];

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

  const fetchPhoneHistory = async (phone: string, targetPage: number) => {
    setPhoneHistoryLoading(true);
    setPhoneHistoryError(null);

    try {
      const params = new URLSearchParams();
      params.set('phone', phone);
      params.set('page', String(targetPage));
      params.set('limit', String(phoneHistoryPageSize));
      const response = await apiClient.get<PhoneHistoryResponse>(
        `/orders/confirmation/history-by-phone?${params.toString()}`,
      );
      const data = response.data;

      const normalizedItems = ((data.items || []) as ConfirmationResponseItemRaw[]).map((item) => {
        const duplicateFlags = extractDuplicateFlagsFromSnapshot(item.order_snapshot);
        const tagDetails = normalizeTagDetails(
          (item as ConfirmationOrderRow).tags_detail,
          item.tags,
        );
        return {
          ...item,
          status: typeof item.status === 'string' ? Number(item.status) : item.status,
          is_abandoned: item.is_abandoned ?? item.isAbandoned ?? false,
          has_duplicated_phone: duplicateFlags.duplicatedPhone,
          has_duplicated_ip: duplicateFlags.duplicatedIp,
          tags_detail: tagDetails,
          tags: tagDetails.map((entry) => entry.name),
        };
      }) as ConfirmationOrderRow[];

      setPhoneHistoryRows(normalizedItems);
      setPhoneHistoryPagination(
        data.pagination || {
          page: targetPage,
          limit: phoneHistoryPageSize,
          total: 0,
          pageCount: 0,
        },
      );
      setPhoneHistoryCanonicalPhone(data.selected?.canonical_phone || '');
      setPhoneHistoryLookupPhone(data.selected?.phone || phone);
    } catch (err: unknown) {
      const message =
        (typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === 'string' &&
          (err as { response?: { data?: { message?: string } } }).response?.data?.message) ||
        (err instanceof Error ? err.message : null) ||
        'Failed to load phone history';
      setPhoneHistoryError(message);
      setPhoneHistoryRows([]);
      setPhoneHistoryPagination({
        page: targetPage,
        limit: phoneHistoryPageSize,
        total: 0,
        pageCount: 0,
      });
    } finally {
      setPhoneHistoryLoading(false);
    }
  };

  const fetchTagOptions = async (orderRowId: string) => {
    setIsTagOptionsLoading(true);
    setTagOptionsError(null);
    try {
      const response = await apiClient.get<ConfirmationTagOptionsResponse>(
        `/orders/confirmation/${orderRowId}/tag-options`,
      );
      const data = response.data;
      setTagOptions({
        order_id: data.order_id,
        shop_id: data.shop_id,
        groups: Array.isArray(data.groups) ? data.groups : [],
        individual: Array.isArray(data.individual) ? data.individual : [],
        total: Number(data.total || 0),
      });
    } catch (err: unknown) {
      const message =
        (typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === 'string' &&
          (err as { response?: { data?: { message?: string } } }).response?.data?.message) ||
        (err instanceof Error ? err.message : null) ||
        'Failed to load tag options';
      setTagOptionsError(message);
      setTagOptions(null);
    } finally {
      setIsTagOptionsLoading(false);
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
      if (showTagPicker && tagPickerRef.current && target && !tagPickerRef.current.contains(target)) {
        setShowTagPicker(false);
        setActiveTagGroupId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShopPicker, showTagPicker]);

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
    if (!selectedOrderForModal && !isPhoneHistoryOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isPhoneHistoryOpen) {
        setIsPhoneHistoryOpen(false);
        return;
      }
      setSelectedOrderForModal(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedOrderForModal, isPhoneHistoryOpen]);

  useEffect(() => {
    if (!selectedOrderForModal) {
      setDraftStatus(null);
      setDraftTags(null);
      setStatusSaveError(null);
      setIsSavingStatus(false);
      setIsStatusMenuOpen(false);
      setShowTagPicker(false);
      setTagOptions(null);
      setIsTagOptionsLoading(false);
      setTagOptionsError(null);
      setActiveTagGroupId(null);
      setIsPhoneHistoryOpen(false);
      setPhoneHistoryRows([]);
      setPhoneHistoryError(null);
      setPhoneHistoryCanonicalPhone('');
      setPhoneHistoryLookupPhone('');
      setPhoneHistoryPage(1);
      setPhoneHistoryPagination({
        page: 1,
        limit: phoneHistoryPageSize,
        total: 0,
        pageCount: 0,
      });
      return;
    }
    setDraftStatus(null);
    setDraftTags(null);
    setActiveNoteTab('all');
    setDraftInternalNote(null);
    setDraftPrintingNote(null);
    setStatusSaveError(null);
    setIsSavingStatus(false);
    setIsStatusMenuOpen(false);
    setShowTagPicker(false);
    setTagOptions(null);
    setIsTagOptionsLoading(false);
    setTagOptionsError(null);
    setActiveTagGroupId(null);
  }, [selectedOrderForModal]);

  useEffect(() => {
    if (!isPhoneHistoryOpen || !phoneHistoryLookupPhone) return;
    fetchPhoneHistory(phoneHistoryLookupPhone, phoneHistoryPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhoneHistoryOpen, phoneHistoryLookupPhone, phoneHistoryPage]);

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
  const statusDisplayColor = getHistoryStatusBadgeColor(
    draftStatus ?? selectedOrderForModal?.status ?? null,
    draftStatus === null ? selectedOrderForModal?.is_abandoned : false,
  );
  const hasStatusDraftChanges = draftStatus !== null;
  const selectedOrderStatusNumber =
    typeof selectedOrderForModal?.status === 'number'
      ? selectedOrderForModal.status
      : Number(selectedOrderForModal?.status ?? NaN);
  const isSelectedOrderEditable = selectedOrderStatusNumber === 0;
  const customerSummaryLookupPhone = (
    modalSnapshot.customer.phone ||
    selectedOrderForModal?.customer_phone ||
    ''
  ).trim();
  const canOpenPhoneHistory = customerSummaryLookupPhone.length > 0;
  const phoneHistoryStartRow =
    phoneHistoryPagination.total === 0 ? 0 : (phoneHistoryPagination.page - 1) * phoneHistoryPagination.limit + 1;
  const phoneHistoryEndRow = Math.min(
    phoneHistoryPagination.page * phoneHistoryPagination.limit,
    phoneHistoryPagination.total,
  );
  const phoneHistoryCanPrev = phoneHistoryPagination.page > 1;
  const phoneHistoryCanNext =
    phoneHistoryPagination.page < Math.max(1, phoneHistoryPagination.pageCount);
  const availableTagGroups = tagOptions?.groups || [];
  const availableIndividualTags = tagOptions?.individual || [];
  const activeTagGroup =
    availableTagGroups.find((group) => group.group_id === activeTagGroupId) || null;
  const selectedOrderBaseTags = useMemo(
    () =>
      normalizeTagDetails(
        selectedOrderForModal?.tags_detail,
        selectedOrderForModal?.tags || [],
      ),
    [selectedOrderForModal?.tags_detail, selectedOrderForModal?.tags],
  );
  const effectiveDraftTags = draftTags ?? selectedOrderBaseTags;
  const hasTagDraftChanges = useMemo(() => {
    const toComparable = (list: ConfirmationOrderTagDetail[]) =>
      list
        .map((entry) => `${entry.id || ''}|${normalizeTagNameKey(entry.name)}`)
        .sort()
        .join('||');
    return toComparable(effectiveDraftTags) !== toComparable(selectedOrderBaseTags);
  }, [effectiveDraftTags, selectedOrderBaseTags]);
  const effectiveInternalNote = draftInternalNote ?? modalSnapshot.note;
  const effectivePrintingNote = draftPrintingNote ?? modalSnapshot.notePrint;
  const hasInternalNoteDraftChanges =
    normalizeLineBreaks(effectiveInternalNote) !== normalizeLineBreaks(modalSnapshot.note);
  const hasPrintingNoteDraftChanges =
    normalizeLineBreaks(effectivePrintingNote) !== normalizeLineBreaks(modalSnapshot.notePrint);
  const hasPendingChanges =
    hasStatusDraftChanges ||
    hasTagDraftChanges ||
    hasInternalNoteDraftChanges ||
    hasPrintingNoteDraftChanges;
  const selectedTagNameSet = useMemo(
    () =>
      new Set(
        effectiveDraftTags
          .map((tag) => normalizeTagNameKey(tag.name))
          .filter((tag) => tag.length > 0),
      ),
    [effectiveDraftTags],
  );
  const isTagSelected = (name: string) => selectedTagNameSet.has(name.trim().toLowerCase());
  const applyDraftTags = (nextTags: ConfirmationOrderTagDetail[]) => {
    const normalizedNext = normalizeTagDetails(nextTags, []);
    setDraftTags(normalizedNext);
  };
  const addDraftTag = (tag: TagOptionItem) => {
    const name = tag.name.trim();
    const id = tag.tag_id.trim();
    if (!name || !id) return;
    const exists = effectiveDraftTags.some(
      (entry) => normalizeTagNameKey(entry.name) === normalizeTagNameKey(name),
    );
    if (exists) return;
    applyDraftTags([...effectiveDraftTags, { id, name }]);
  };
  const removeDraftTag = (tagName: string) => {
    applyDraftTags(
      effectiveDraftTags.filter(
        (entry) => normalizeTagNameKey(entry.name) !== normalizeTagNameKey(tagName),
      ),
    );
  };

  const openPhoneHistoryModal = () => {
    if (!canOpenPhoneHistory) return;
    setPhoneHistoryRows([]);
    setPhoneHistoryError(null);
    setPhoneHistoryCanonicalPhone('');
    setPhoneHistoryLookupPhone(customerSummaryLookupPhone);
    setPhoneHistoryPage(1);
    setIsPhoneHistoryOpen(true);
  };

  const openOrderDetailsFromHistory = (row: ConfirmationOrderRow) => {
    setSelectedOrderForModal(row);
    setIsPhoneHistoryOpen(false);
    setDraftStatus(null);
    setDraftTags(null);
    setStatusSaveError(null);
    setIsStatusMenuOpen(false);
    setShowTagPicker(false);
  };

  const handleOpenAndCopyOrderLink = async () => {
    const orderLink = modalSnapshot.orderLink;
    if (!orderLink) return;

    window.open(orderLink, '_blank', 'noopener,noreferrer');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(orderLink);
      }
    } catch {
      // ignore clipboard errors (unsupported browser / denied permission)
    }
  };

  const deliveryFullName = modalSnapshot.shippingAddress.fullName;
  const deliveryPhoneNumber = modalSnapshot.shippingAddress.phoneNumber;
  const deliveryAddress = modalSnapshot.shippingAddress.address;
  const deliveryCommuneName = modalSnapshot.shippingAddress.communeName;
  const deliveryDistrictName = modalSnapshot.shippingAddress.districtName;
  const deliveryProvinceName = modalSnapshot.shippingAddress.provinceName;
  const hasDeliveryFullName = hasNonEmptyText(deliveryFullName);
  const hasDeliveryPhoneNumber = hasNonEmptyText(deliveryPhoneNumber);
  const hasDeliveryAddress = hasNonEmptyText(deliveryAddress);
  const hasDeliveryCommuneName = hasNonEmptyText(deliveryCommuneName);
  const hasDeliveryDistrictName = hasNonEmptyText(deliveryDistrictName);
  const hasDeliveryProvinceName = hasNonEmptyText(deliveryProvinceName);
  const hasDeliveryArea = hasDeliveryCommuneName && hasDeliveryDistrictName && hasDeliveryProvinceName;
  const deliveryAreaText = [deliveryCommuneName, deliveryDistrictName, deliveryProvinceName]
    .filter((entry) => hasNonEmptyText(entry))
    .join(', ');
  const paymentShippingFee = Math.max(0, modalSnapshot.payment.shippingFee);
  const paymentDiscount = Math.max(0, modalSnapshot.payment.totalDiscount);
  const paymentSurcharge = Math.max(0, modalSnapshot.payment.surcharge);
  const paymentBankTransfer = Math.max(0, modalSnapshot.payment.bankTransfer);
  const paymentSubtotal = Math.max(
    0,
    (selectedOrderForModal?.cod || 0) + paymentDiscount + paymentShippingFee + paymentSurcharge,
  );
  const paymentAfterDiscount = Math.max(0, paymentSubtotal - paymentDiscount);
  const paymentNeedToPay = paymentAfterDiscount;
  const paymentPaid = paymentBankTransfer;
  const paymentRemain = Math.max(0, paymentNeedToPay - paymentPaid);

  const handleSaveStatus = async () => {
    if (!selectedOrderForModal || !isSelectedOrderEditable || !hasPendingChanges || isSavingStatus) return;
    const statusLabel = draftStatus !== null
      ? getConfirmationStatusOptionLabel(draftStatus) || String(draftStatus)
      : null;
    const orderRef = `${selectedOrderForModal.shop_id} - ${selectedOrderForModal.pos_order_id}`;
    const normalizedOptionLookup = new Map<string, string>();
    for (const tag of availableIndividualTags) {
      const key = normalizeTagNameKey(tag.name);
      if (key && tag.tag_id.trim()) {
        normalizedOptionLookup.set(key, tag.tag_id.trim());
      }
    }
    for (const group of availableTagGroups) {
      for (const tag of group.tags) {
        const key = normalizeTagNameKey(tag.name);
        if (key && tag.tag_id.trim()) {
          normalizedOptionLookup.set(key, tag.tag_id.trim());
        }
      }
    }

    let resolvedTagsPayload: Array<{ id: string; name: string }> | undefined;
    if (hasTagDraftChanges) {
      const unresolved: string[] = [];
      resolvedTagsPayload = effectiveDraftTags
        .map((entry) => {
          const normalizedName = normalizeTagNameKey(entry.name);
          const id = (entry.id || normalizedOptionLookup.get(normalizedName) || '').trim();
          if (!id || !entry.name.trim()) {
            unresolved.push(entry.name || '(empty)');
            return null;
          }
          return { id, name: entry.name.trim() };
        })
        .filter((entry): entry is { id: string; name: string } => !!entry);

      if (unresolved.length > 0) {
        const errorMessage =
          'Some tags are missing tag IDs. Please sync tags for this store, then retry.';
        setStatusSaveError(errorMessage);
        addToast('error', errorMessage);
        return;
      }
    }

    const payload: Record<string, unknown> = {};
    if (draftStatus !== null) payload.status = draftStatus;
    if (hasTagDraftChanges) payload.tags = resolvedTagsPayload || [];
    if (hasInternalNoteDraftChanges) payload.note = toApiLineBreaks(effectiveInternalNote);
    if (hasPrintingNoteDraftChanges) payload.note_print = toApiLineBreaks(effectivePrintingNote);

    setIsSavingStatus(true);
    setStatusSaveError(null);
    if (statusLabel) {
      addToast('info', `Updating order ${orderRef} to ${statusLabel}...`);
    } else if (hasTagDraftChanges) {
      addToast('info', `Updating tags for order ${orderRef}...`);
    } else if (hasInternalNoteDraftChanges || hasPrintingNoteDraftChanges) {
      addToast('info', `Updating notes for order ${orderRef}...`);
    } else {
      addToast('info', `Updating order ${orderRef}...`);
    }
    try {
      await apiClient.patch(`/orders/confirmation/${selectedOrderForModal.id}/status`, payload);
      addToast('success', `Order ${orderRef} successfully submitted for update.`);
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
        'Failed to update order';
      addToast('error', message);
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">COD</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Return Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Tags</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Phone</th>
                  <th className="w-[200px] min-w-[200px] px-2 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap sticky right-0 z-20 bg-slate-50 border-l border-slate-200">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-400" colSpan={10}>
                      Loading...
                    </td>
                  </tr>
                ) : rows.length > 0 ? (
                  rows.map((row) => {
                    const rowHasDuplicate = !!row.has_duplicated_phone || !!row.has_duplicated_ip;
                    const productSummary = getHistoryProductSummary(row);
                    const rowHasNoProduct = !hasRowProductItems(row);
                    return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer transition-colors ${
                        rowHasNoProduct
                          ? 'bg-rose-100 hover:bg-rose-200/80'
                          : rowHasDuplicate
                          ? 'bg-rose-50 hover:bg-rose-100/70'
                          : 'bg-white hover:bg-slate-50/80'
                      }`}
                      onClick={() => setSelectedOrderForModal(row)}
                    >
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.date_local}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.shop_name}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap">{row.pos_order_id}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <span className="block max-w-[360px] truncate" title={productSummary}>
                          {productSummary}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(row.cod || 0)}
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
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                        {row.tags?.length ? row.tags.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.customer_name || '—'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.customer_phone || '—'}</td>
                      <td
                        className={`w-[200px] min-w-[200px] px-2 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap sticky right-0 z-10 border-l border-slate-100 ${
                          rowHasNoProduct ? 'bg-rose-100' : rowHasDuplicate ? 'bg-rose-50' : 'bg-white'
                        }`}
                      >
                        <StatusBadge
                          status={row.status}
                          statusName={row.status_name}
                          isAbandoned={row.is_abandoned}
                          className="w-full"
                        />
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-400" colSpan={10}>
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
            className="relative mx-auto my-2 flex h-[calc(100vh-1.5rem)] w-[min(96vw,1480px)] max-h-[calc(100vh-1.5rem)] max-w-none flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:my-4 sm:h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-3rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order Detail</p>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {selectedOrderForModal.shop_id} - {selectedOrderForModal.pos_order_id}
                  </h3>
                  {modalSnapshot.orderLink ? (
                    <button
                      type="button"
                      onClick={handleOpenAndCopyOrderLink}
                      className="inline-flex rounded-lg p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      aria-label="Open and copy order link"
                      title="Open and copy order link"
                    >
                      <Link2 className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>
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

            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-32">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
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
                      onMouseEnter={() => {
                        if (isSelectedOrderEditable) setIsStatusMenuOpen(true);
                      }}
                      onMouseLeave={() => {
                        if (isSelectedOrderEditable) setIsStatusMenuOpen(false);
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (!isSelectedOrderEditable) return;
                          setIsStatusMenuOpen((prev) => !prev);
                        }}
                        disabled={!isSelectedOrderEditable}
                        className={`inline-flex min-w-[160px] max-w-full items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm ${
                          isSelectedOrderEditable ? '' : 'cursor-not-allowed opacity-85'
                        }`}
                        style={{ backgroundColor: statusDisplayColor }}
                      >
                        <span className="truncate">{statusDisplayLabel}</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 ${isSelectedOrderEditable ? 'text-white/90' : 'text-slate-200'}`}
                        />
                      </button>
                      {isSelectedOrderEditable && isStatusMenuOpen ? (
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
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="relative" ref={tagPickerRef}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isSelectedOrderEditable || !selectedOrderForModal?.id) return;
                            setShowTagPicker((prev) => {
                              const next = !prev;
                              if (next) {
                                const needsFetch =
                                  !tagOptions ||
                                  tagOptions.order_id !== selectedOrderForModal.id;
                                if (needsFetch && !isTagOptionsLoading) {
                                  fetchTagOptions(selectedOrderForModal.id);
                                }
                              } else {
                                setActiveTagGroupId(null);
                              }
                              return next;
                            });
                          }}
                          disabled={!isSelectedOrderEditable}
                          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                            isSelectedOrderEditable
                              ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                          }`}
                        >
                          Add Tags
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        {isSelectedOrderEditable && showTagPicker ? (
                          <div
                            className="absolute left-0 top-full z-30 mt-1 w-[320px] md:-left-[220px]"
                            onMouseLeave={() => setActiveTagGroupId(null)}
                          >
                            <div className="relative overflow-visible rounded-lg border border-slate-200 bg-white shadow-lg">
                              <div className="max-h-[320px] overflow-auto py-1">
                                {isTagOptionsLoading ? (
                                  <div className="px-3 py-2 text-sm text-slate-500">Loading tags...</div>
                                ) : tagOptionsError ? (
                                  <div className="px-3 py-2 text-sm text-rose-600">{tagOptionsError}</div>
                                ) : (
                                  <>
                                    {availableTagGroups.map((group) => (
                                      <button
                                        key={group.group_id}
                                        type="button"
                                        onMouseEnter={() => setActiveTagGroupId(group.group_id)}
                                        className="flex w-full items-center justify-between border-b border-dashed border-slate-200 px-4 py-2.5 text-left text-sm font-semibold uppercase tracking-wide text-slate-800 hover:bg-slate-50"
                                      >
                                        <span>{group.group_name}</span>
                                        <ChevronDown className="-rotate-90 h-4 w-4 text-slate-500" />
                                      </button>
                                    ))}

                                    {availableIndividualTags.map((tag) => {
                                      const selected = isTagSelected(tag.name);
                                      return (
                                        <button
                                          key={tag.tag_id}
                                          type="button"
                                          onClick={() => addDraftTag(tag)}
                                          className={`flex w-full items-center gap-2 border-b border-dashed border-slate-200 px-4 py-2.5 text-left text-sm ${
                                            selected
                                              ? 'bg-indigo-50 font-semibold text-indigo-700'
                                              : 'text-slate-800 hover:bg-slate-50'
                                          }`}
                                        >
                                          <span className="h-2 w-2 rounded-full bg-emerald-700" />
                                          <span>{tag.name}</span>
                                        </button>
                                      );
                                    })}

                                    {!availableTagGroups.length && !availableIndividualTags.length ? (
                                      <div className="px-3 py-2 text-sm text-slate-500">No tags available for this shop.</div>
                                    ) : null}
                                  </>
                                )}
                              </div>

                              {activeTagGroup ? (
                                <div className="absolute left-full top-0 ml-2 w-[300px] rounded-lg border border-slate-200 bg-white shadow-lg">
                                  <div className="max-h-[320px] overflow-auto py-1">
                                    {activeTagGroup.tags.map((tag) => {
                                      const selected = isTagSelected(tag.name);
                                      return (
                                        <button
                                          key={tag.tag_id}
                                          type="button"
                                          onClick={() => addDraftTag(tag)}
                                          className={`flex w-full items-center gap-2 border-b border-dashed border-slate-200 px-4 py-2.5 text-left text-sm ${
                                            selected
                                              ? 'bg-indigo-50 font-semibold text-indigo-700'
                                              : 'text-slate-800 hover:bg-slate-50'
                                          }`}
                                        >
                                          <span className="h-2 w-2 rounded-full bg-emerald-700" />
                                          <span>{tag.name}</span>
                                        </button>
                                      );
                                    })}
                                    {!activeTagGroup.tags.length ? (
                                      <div className="px-3 py-2 text-sm text-slate-500">No tags in this group.</div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {effectiveDraftTags.length ? (
                          effectiveDraftTags.map((tag) => (
                            <span
                              key={`${tag.id || 'tag'}-${tag.name}`}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              <span>{tag.name}</span>
                              {isSelectedOrderEditable ? (
                                <button
                                  type="button"
                                  onClick={() => removeDraftTag(tag.name)}
                                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                  aria-label={`Remove tag ${tag.name}`}
                                  title={`Remove ${tag.name}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              ) : null}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">No tags</span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-4">
                <h4 className="mb-3 text-base font-semibold text-slate-900">Payment</h4>
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                    <span>Shipping fee</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(paymentShippingFee)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                    <span>Discounted</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(paymentDiscount)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                    <span>Bank transfer</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(paymentBankTransfer)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                    <span>Surcharge</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(paymentSurcharge)}</span>
                  </div>
                </div>

                <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 text-slate-700">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(paymentSubtotal)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 text-slate-700">
                    <span>Discount</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(paymentDiscount)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-slate-200 pt-2 text-slate-700">
                    <span>After discount</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(paymentAfterDiscount)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 text-slate-700">
                    <span>Need to pay</span>
                    <span className="font-semibold text-blue-700">{formatCurrency(paymentNeedToPay)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 text-slate-700">
                    <span>Paid</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(paymentPaid)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-slate-200 pt-2 text-slate-700">
                    <span>Remain</span>
                    <span className="font-semibold text-rose-600">{formatCurrency(paymentRemain)}</span>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-4">
                <h4 className="mb-3 text-base font-semibold text-slate-900">Note</h4>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setActiveNoteTab('all')}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                        activeNoteTab === 'all'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNoteTab('internal')}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                        activeNoteTab === 'internal'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Internal
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNoteTab('printing')}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                        activeNoteTab === 'printing'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Printing
                    </button>
                  </div>

                  {activeNoteTab === 'all' ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="inline-flex rounded-lg border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                            Internal
                          </span>
                          {isSelectedOrderEditable ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveNoteTab('internal');
                              }}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                              aria-label="Edit internal note"
                              title="Edit internal note"
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                          {effectiveInternalNote || '—'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="inline-flex rounded-lg border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                            Printing
                          </span>
                          {isSelectedOrderEditable ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveNoteTab('printing');
                              }}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                              aria-label="Edit printing note"
                              title="Edit printing note"
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                          {effectivePrintingNote || '—'}
                        </p>
                      </div>
                    </div>
                  ) : activeNoteTab === 'internal' ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-2">
                        <span className="inline-flex rounded-lg border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                          Internal
                        </span>
                      </div>
                      {isSelectedOrderEditable ? (
                        <textarea
                          value={effectiveInternalNote}
                          onChange={(event) => setDraftInternalNote(normalizeLineBreaks(event.target.value))}
                          className="min-h-[190px] w-full rounded-lg border border-blue-400 px-3 py-2 text-sm text-slate-800 outline-none"
                          placeholder="Add internal note..."
                        />
                      ) : (
                        <p className="min-h-[190px] whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                          {effectiveInternalNote || '—'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-2">
                        <span className="inline-flex rounded-lg border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                          Printing
                        </span>
                      </div>
                      {isSelectedOrderEditable ? (
                        <textarea
                          value={effectivePrintingNote}
                          onChange={(event) => setDraftPrintingNote(normalizeLineBreaks(event.target.value))}
                          className="min-h-[190px] w-full rounded-lg border border-blue-400 px-3 py-2 text-sm text-slate-800 outline-none"
                          placeholder="Add printing note..."
                        />
                      ) : (
                        <p className="min-h-[190px] whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                          {effectivePrintingNote || '—'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <div className="space-y-4 lg:col-span-4">
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-base font-semibold text-slate-900">Customer</h4>
                    <div className="inline-flex items-center gap-2">
                      <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700">
                        {modalSnapshot.customer.gender || '—'}
                      </span>
                    </div>
                  </div>

                  {(modalSnapshot.duplicatedPhone || modalSnapshot.duplicatedIp) ? (
                    <div className="mb-3 space-y-2">
                      {modalSnapshot.duplicatedPhone ? (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                          <PhoneCall className="h-4 w-4 text-amber-600" />
                          <span>This phone number has multiple orders</span>
                        </div>
                      ) : null}
                      {modalSnapshot.duplicatedIp ? (
                        <div className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">
                          <Wifi className="h-4 w-4 text-rose-600" />
                          <span>Multiple IP detected in this order</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

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

                  <button
                    type="button"
                    onClick={openPhoneHistoryModal}
                    disabled={!canOpenPhoneHistory}
                    className={`mt-3 w-full rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-left transition ${
                      canOpenPhoneHistory ? 'hover:bg-sky-100' : 'cursor-default'
                    }`}
                    title={canOpenPhoneHistory ? 'Open history of orders by this phone number' : 'Phone number unavailable'}
                  >
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
                  </button>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="mb-3 text-base font-semibold text-slate-900">Delivery</h4>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className={getDeliveryFieldClass(hasDeliveryFullName)}>
                        {deliveryFullName || 'Missing full name'}
                      </div>
                      <div className={getDeliveryFieldClass(hasDeliveryPhoneNumber)}>
                        {deliveryPhoneNumber || 'Missing phone number'}
                      </div>
                    </div>
                    <div className={getDeliveryFieldClass(hasDeliveryAddress)}>
                      {deliveryAddress || 'Missing address'}
                    </div>
                    <div className={getDeliveryFieldClass(hasDeliveryArea)}>
                      {deliveryAreaText || 'Missing commune / district / province'}
                    </div>
                  </div>
                </section>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-10px_20px_-14px_rgba(15,23,42,0.45)] backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
                  Status: {statusDisplayLabel}
                </span>
                <span className="inline-flex items-center rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700">
                  COD: {formatCurrency(selectedOrderForModal?.cod || 0)}
                </span>
                {statusSaveError ? (
                  <span className="text-sm text-rose-600">{statusSaveError}</span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={!isSelectedOrderEditable || !hasPendingChanges || isSavingStatus}
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

      {isMounted && selectedOrderForModal && isPhoneHistoryOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[130] overflow-y-auto bg-slate-900/45 p-3 sm:p-6"
              onClick={() => setIsPhoneHistoryOpen(false)}
            >
              <div className="flex min-h-full items-center justify-center">
                <div
                  className="relative flex h-auto w-[min(96vw,1480px)] max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      History of Orders (Phone)
                    </p>
                    <h3 className="text-xl font-semibold text-slate-900">
                      {phoneHistoryLookupPhone || '—'}
                    </h3>
                    {phoneHistoryCanonicalPhone ? (
                      <p className="mt-1 text-sm text-slate-500">
                        Canonical: {phoneHistoryCanonicalPhone}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPhoneHistoryOpen(false)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    aria-label="Close history modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-4">
                  {phoneHistoryError ? (
                    <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {phoneHistoryError}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">
                              Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">
                              Shop
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">
                              Order ID
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">
                              Customer
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">
                              Product
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">
                              Phone
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">
                              COD
                            </th>
                            <th className="w-[190px] min-w-[190px] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap sticky right-0 z-20 bg-slate-50 border-l border-slate-200">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {phoneHistoryLoading ? (
                            <tr>
                              <td className="px-4 py-6 text-sm text-slate-400" colSpan={8}>
                                Loading...
                              </td>
                            </tr>
                          ) : phoneHistoryRows.length > 0 ? (
                            phoneHistoryRows.map((row) => {
                              const rowHasDuplicate = !!row.has_duplicated_phone || !!row.has_duplicated_ip;
                              const productSummary = getHistoryProductSummary(row);
                              return (
                                <tr
                                  key={`history-${row.id}`}
                                  onClick={() => openOrderDetailsFromHistory(row)}
                                  className={`cursor-pointer transition-colors ${
                                    rowHasDuplicate
                                      ? 'bg-rose-50 hover:bg-rose-100/70'
                                      : 'bg-white hover:bg-slate-50/80'
                                  }`}
                                >
                                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.date_local}</td>
                                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.shop_name}</td>
                                  <td className="px-4 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap">
                                    {row.pos_order_id}
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.customer_name || '—'}</td>
                                  <td className="px-4 py-4 text-sm text-slate-700">
                                    <span className="block max-w-[380px] truncate" title={productSummary}>
                                      {productSummary}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{row.customer_phone || '—'}</td>
                                  <td className="px-4 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap">
                                    {formatCurrency(row.cod || 0)}
                                  </td>
                                  <td
                                    className={`w-[190px] min-w-[190px] px-2 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap sticky right-0 z-10 border-l border-slate-100 ${
                                      rowHasDuplicate ? 'bg-rose-50' : 'bg-white'
                                    }`}
                                  >
                                    <StatusBadge
                                      status={row.status}
                                      statusName={row.status_name}
                                      isAbandoned={row.is_abandoned}
                                      className="w-full"
                                    />
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td className="px-4 py-6 text-sm text-slate-400" colSpan={8}>
                                No orders found for this phone number.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-600">
                        Showing {phoneHistoryStartRow}-{phoneHistoryEndRow} of {phoneHistoryPagination.total}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPhoneHistoryPage((prev) => Math.max(1, prev - 1))}
                          disabled={!phoneHistoryCanPrev || phoneHistoryLoading}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhoneHistoryPage((prev) => prev + 1)}
                          disabled={!phoneHistoryCanNext || phoneHistoryLoading}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
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
