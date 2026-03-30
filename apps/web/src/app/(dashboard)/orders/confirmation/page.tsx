'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  CreditCard,
  Link2,
  MapPin,
  MessageCircle,
  Package,
  PencilLine,
  PhoneCall,
  Search,
  StickyNote,
  Tag,
  User,
  Wifi,
  X,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

import { StatusBadge } from '../_components/status-badge';
import { ReturnRateCell } from '../_components/return-rate-cell';
import { useConfirmationRealtime } from '../_hooks/use-confirmation-realtime';
import {
  fetchConfirmationOrders,
  fetchConfirmationPhoneHistory,
  fetchConfirmationProductOptions,
  fetchConfirmationTagOptions,
  fetchGeoCommunes,
  fetchGeoDistricts,
  fetchGeoProvinces,
  syncStoreProductsByShop,
  syncStoreTags,
  syncStoreWarehouses,
  updateConfirmationOrder,
} from '../_services/confirmation-api';
import type {
  ConfirmationOrderRow,
  ConfirmationOrderTagDetail,
  ConfirmationTagOptionsResponse,
  GeoCommuneOption,
  GeoDistrictOption,
  GeoProvinceOption,
  ParsedDeliveryAddress,
  ParsedSnapshotItem,
  ProductOptionItem,
  ShopOption,
  TagOptionItem,
} from '../_types/confirmation';
import { CONFIRMATION_STATUS_OPTIONS, GEO_COUNTRY_CODE } from '../_utils/constants';
import {
  buildBankPaymentsPayloadFromTransferAmount,
  buildShippingAddressPayload,
  cloneDeliveryAddress,
  composeDeliveryFullAddress,
  formatCurrency,
  formatDateInTimezone,
  getHistoryProductSummary,
  hasNonEmptyText,
  hasNumericDraftChanged,
  hasRowProductItems,
  normalizeLineBreaks,
  normalizeItemsForUpdatePayload,
  normalizeTagDetails,
  normalizeTagNameKey,
  parseApiErrorMessage,
  parseNumericDraftInput,
  parseOrderSnapshot,
  parseYmdToLocalDate,
  resolveNumericDraftForUi,
  toApiLineBreaks,
  toSafeDate,
  toComparableShippingAddress,
} from '../_utils/confirmation-helpers';
import {
  formatStatusLabel,
  getConfirmationStatusOptionLabel,
  getHistoryStatusBadgeColor,
} from '../_utils/status';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });
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
  const [isConversationLinkCopied, setIsConversationLinkCopied] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [draftTags, setDraftTags] = useState<ConfirmationOrderTagDetail[] | null>(null);
  const [activeNoteTab, setActiveNoteTab] = useState<'all' | 'internal' | 'printing'>('all');
  const [draftInternalNote, setDraftInternalNote] = useState<string | null>(null);
  const [draftPrintingNote, setDraftPrintingNote] = useState<string | null>(null);
  const [draftPaymentShippingFee, setDraftPaymentShippingFee] = useState<string | null>(null);
  const [draftPaymentTotalDiscount, setDraftPaymentTotalDiscount] = useState<string | null>(null);
  const [draftPaymentBankTransfer, setDraftPaymentBankTransfer] = useState<string | null>(null);
  const [draftPaymentSurcharge, setDraftPaymentSurcharge] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<ParsedSnapshotItem[] | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [isProductOptionsLoading, setIsProductOptionsLoading] = useState(false);
  const [productOptionsError, setProductOptionsError] = useState<string | null>(null);
  const [productOptions, setProductOptions] = useState<ProductOptionItem[]>([]);
  const [productOptionsWarehouseName, setProductOptionsWarehouseName] = useState<string | null>(null);
  const [isSyncingFallbackProducts, setIsSyncingFallbackProducts] = useState(false);
  const [isSyncingFallbackTags, setIsSyncingFallbackTags] = useState(false);
  const [isSyncingFallbackWarehouses, setIsSyncingFallbackWarehouses] = useState(false);
  const [selectedDeliveryAddressKey, setSelectedDeliveryAddressKey] = useState<string>('');
  const [draftDeliveryAddress, setDraftDeliveryAddress] = useState<ParsedDeliveryAddress | null>(null);
  const [geoProvinces, setGeoProvinces] = useState<GeoProvinceOption[]>([]);
  const [geoDistricts, setGeoDistricts] = useState<GeoDistrictOption[]>([]);
  const [geoCommunes, setGeoCommunes] = useState<GeoCommuneOption[]>([]);
  const [isGeoProvincesLoading, setIsGeoProvincesLoading] = useState(false);
  const [isGeoDistrictsLoading, setIsGeoDistrictsLoading] = useState(false);
  const [isGeoCommunesLoading, setIsGeoCommunesLoading] = useState(false);
  const [geoLookupError, setGeoLookupError] = useState<string | null>(null);
  const [showGeoPicker, setShowGeoPicker] = useState(false);
  const [geoSearchTerm, setGeoSearchTerm] = useState('');
  const [activeGeoTab, setActiveGeoTab] = useState<'province' | 'district' | 'commune'>('province');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagOptions, setTagOptions] = useState<ConfirmationTagOptionsResponse | null>(null);
  const [isTagOptionsLoading, setIsTagOptionsLoading] = useState(false);
  const [tagOptionsError, setTagOptionsError] = useState<string | null>(null);
  const [activeTagGroupId, setActiveTagGroupId] = useState<string | null>(null);
  const [isPaymentExpanded, setIsPaymentExpanded] = useState(true);
  const [isPhoneCopied, setIsPhoneCopied] = useState(false);
  const phoneCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([]);
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([]);
  const [isAllShopsMode, setIsAllShopsMode] = useState(true);
  const [shopSearch, setShopSearch] = useState('');
  const [showShopPicker, setShowShopPicker] = useState(false);
  const shopPickerRef = useRef<HTMLDivElement | null>(null);
  const tagPickerRef = useRef<HTMLDivElement | null>(null);
  const geoPickerRef = useRef<HTMLDivElement | null>(null);
  const productPickerRef = useRef<HTMLDivElement | null>(null);
  const conversationCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      const data = await fetchConfirmationOrders(params);

      setRows(data.items || []);
      setPagination(data.pagination || { page: 1, limit: pageSize, total: 0, pageCount: 0 });

      const nextShopOptions = data.filters?.shops || [];
      setShopOptions(nextShopOptions);

      if (!isAllShopsMode) {
        const validShopIds = new Set(nextShopOptions.map((shop) => shop.shop_id));
        setSelectedShopIds((prev) => prev.filter((shopId) => validShopIds.has(shopId)));
      }
    } catch (err: unknown) {
      const message = parseApiErrorMessage(err, 'Failed to load confirmation orders');
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
      const data = await fetchConfirmationPhoneHistory(params);

      setPhoneHistoryRows(data.items || []);
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
      const message = parseApiErrorMessage(err, 'Failed to load phone history');
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
      const data = await fetchConfirmationTagOptions(orderRowId);
      setTagOptions(data);
    } catch (err: unknown) {
      const message = parseApiErrorMessage(err, 'Failed to load tag options');
      setTagOptionsError(message);
      setTagOptions(null);
    } finally {
      setIsTagOptionsLoading(false);
    }
  };

  const fetchProductOptions = async (orderRowId: string, searchTerm: string) => {
    setIsProductOptionsLoading(true);
    setProductOptionsError(null);
    try {
      const data = await fetchConfirmationProductOptions(orderRowId, searchTerm);
      setProductOptions(Array.isArray(data.items) ? data.items : []);
      setProductOptionsWarehouseName(typeof data.warehouse_name === 'string' ? data.warehouse_name : null);
    } catch (err: unknown) {
      const message = parseApiErrorMessage(err, 'Failed to load product options');
      setProductOptionsError(message);
      setProductOptions([]);
      setProductOptionsWarehouseName(null);
    } finally {
      setIsProductOptionsLoading(false);
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
      if (showGeoPicker && geoPickerRef.current && target && !geoPickerRef.current.contains(target)) {
        setShowGeoPicker(false);
        setGeoSearchTerm('');
      }
      if (showProductPicker && productPickerRef.current && target && !productPickerRef.current.contains(target)) {
        setShowProductPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShopPicker, showTagPicker, showGeoPicker, showProductPicker]);

  useConfirmationRealtime({
    onRefresh: () => fetchDataRef.current?.({ silent: true }),
  });

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
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
      setDraftPaymentShippingFee(null);
      setDraftPaymentTotalDiscount(null);
      setDraftPaymentBankTransfer(null);
      setDraftPaymentSurcharge(null);
      setDraftItems(null);
      setProductSearchTerm('');
      setShowProductPicker(false);
      setIsProductOptionsLoading(false);
      setProductOptionsError(null);
      setProductOptions([]);
      setProductOptionsWarehouseName(null);
      setIsSyncingFallbackProducts(false);
      setIsSyncingFallbackTags(false);
      setIsSyncingFallbackWarehouses(false);
      setSelectedDeliveryAddressKey('');
      setDraftDeliveryAddress(null);
      setGeoProvinces([]);
      setGeoDistricts([]);
      setGeoCommunes([]);
      setIsGeoProvincesLoading(false);
      setIsGeoDistrictsLoading(false);
      setIsGeoCommunesLoading(false);
      setGeoLookupError(null);
      setShowGeoPicker(false);
      setGeoSearchTerm('');
      setActiveGeoTab('province');
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
    setDraftPaymentShippingFee(null);
    setDraftPaymentTotalDiscount(null);
    setDraftPaymentBankTransfer(null);
    setDraftPaymentSurcharge(null);
    setDraftItems(null);
    setProductSearchTerm('');
    setShowProductPicker(false);
    setIsProductOptionsLoading(false);
    setProductOptionsError(null);
    setProductOptions([]);
    setProductOptionsWarehouseName(null);
    setIsSyncingFallbackProducts(false);
    setIsSyncingFallbackTags(false);
    setIsSyncingFallbackWarehouses(false);
    setSelectedDeliveryAddressKey('');
    setDraftDeliveryAddress(null);
    setGeoDistricts([]);
    setGeoCommunes([]);
    setIsGeoDistrictsLoading(false);
    setIsGeoCommunesLoading(false);
    setGeoLookupError(null);
    setShowGeoPicker(false);
    setGeoSearchTerm('');
    setActiveGeoTab('province');
    setStatusSaveError(null);
    setIsSavingStatus(false);
    setIsConversationLinkCopied(false);
    setIsStatusMenuOpen(false);
    setShowTagPicker(false);
    setTagOptions(null);
    setIsTagOptionsLoading(false);
    setTagOptionsError(null);
    setActiveTagGroupId(null);
  }, [selectedOrderForModal]);

  useEffect(() => {
    return () => {
      if (conversationCopyTimeoutRef.current) {
        clearTimeout(conversationCopyTimeoutRef.current);
        conversationCopyTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isPhoneHistoryOpen || !phoneHistoryLookupPhone) return;
    fetchPhoneHistory(phoneHistoryLookupPhone, phoneHistoryPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhoneHistoryOpen, phoneHistoryLookupPhone, phoneHistoryPage]);

  useEffect(() => {
    if (!selectedOrderForModal?.id || !showProductPicker) return;
    fetchProductOptions(selectedOrderForModal.id, productSearchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderForModal?.id, productSearchTerm, showProductPicker]);

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
  const storeIdByShopId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      const shopId = (row.shop_id || '').trim();
      const storeId = (row.store_id || '').trim();
      if (shopId && storeId && !map.has(shopId)) {
        map.set(shopId, storeId);
      }
    }
    for (const row of phoneHistoryRows) {
      const shopId = (row.shop_id || '').trim();
      const storeId = (row.store_id || '').trim();
      if (shopId && storeId && !map.has(shopId)) {
        map.set(shopId, storeId);
      }
    }
    return map;
  }, [rows, phoneHistoryRows]);

  const modalSnapshot = useMemo(
    () => parseOrderSnapshot(selectedOrderForModal?.order_snapshot),
    [selectedOrderForModal?.order_snapshot],
  );
  const modalItems = modalSnapshot.items;
  const modalWarehouseId = (
    selectedOrderForModal?.warehouse_id ||
    modalSnapshot.warehouseId ||
    ''
  ).trim();
  const modalWarehouseName = (
    selectedOrderForModal?.warehouse_name ||
    ''
  ).trim();
  const selectedStoreId = (
    selectedOrderForModal?.store_id ||
    (selectedOrderForModal?.shop_id ? storeIdByShopId.get(selectedOrderForModal.shop_id) : null) ||
    ''
  ).trim();
  const effectiveWarehouseName = (modalWarehouseName || productOptionsWarehouseName || '').trim();
  const warehouseScopedModalItems = useMemo(() => {
    if (!modalWarehouseId) return modalItems;
    return modalItems.filter((item) => !item.warehouseId || item.warehouseId === modalWarehouseId);
  }, [modalItems, modalWarehouseId]);
  const baseWarehouseScopedModalItems = useMemo(
    () =>
      warehouseScopedModalItems.map((item) => ({
        ...item,
        quantity: Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 1,
      })),
    [warehouseScopedModalItems],
  );
  const effectiveModalItems = draftItems ?? baseWarehouseScopedModalItems;
  const hasItemsDraftChanges = useMemo(() => {
    const source = normalizeItemsForUpdatePayload(baseWarehouseScopedModalItems);
    const draft = normalizeItemsForUpdatePayload(effectiveModalItems);
    return JSON.stringify(source) !== JSON.stringify(draft);
  }, [baseWarehouseScopedModalItems, effectiveModalItems]);
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
  const shouldShowProductFallbackSync =
    isSelectedOrderEditable &&
    showProductPicker &&
    !isProductOptionsLoading &&
    productOptions.length === 0 &&
    !!selectedOrderForModal?.shop_id;
  const shouldShowWarehouseFallbackSync =
    shouldShowProductFallbackSync &&
    !!selectedStoreId &&
    !!modalWarehouseId &&
    !effectiveWarehouseName;
  const selectedOrderHasProducts = selectedOrderForModal
    ? hasRowProductItems(selectedOrderForModal)
    : false;
  const shouldShowEmptyCartState = !selectedOrderHasProducts && effectiveModalItems.length === 0;
  const shouldShowTagFallbackSync =
    isSelectedOrderEditable &&
    showTagPicker &&
    !isTagOptionsLoading &&
    !!selectedStoreId &&
    (Boolean(tagOptionsError) || (!availableTagGroups.length && !availableIndividualTags.length));
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
  const effectivePaymentShippingFee = resolveNumericDraftForUi(
    draftPaymentShippingFee,
    modalSnapshot.payment.shippingFee,
  );
  const effectivePaymentDiscount = resolveNumericDraftForUi(
    draftPaymentTotalDiscount,
    modalSnapshot.payment.totalDiscount,
  );
  const effectivePaymentBankTransfer = resolveNumericDraftForUi(
    draftPaymentBankTransfer,
    modalSnapshot.payment.bankTransfer,
  );
  const effectivePaymentSurcharge = resolveNumericDraftForUi(
    draftPaymentSurcharge,
    modalSnapshot.payment.surcharge,
  );
  const hasPaymentShippingFeeDraftChanges = hasNumericDraftChanged(
    draftPaymentShippingFee,
    modalSnapshot.payment.shippingFee,
  );
  const hasPaymentTotalDiscountDraftChanges = hasNumericDraftChanged(
    draftPaymentTotalDiscount,
    modalSnapshot.payment.totalDiscount,
  );
  const hasPaymentBankTransferDraftChanges = hasNumericDraftChanged(
    draftPaymentBankTransfer,
    modalSnapshot.payment.bankTransfer,
  );
  const hasPaymentSurchargeDraftChanges = hasNumericDraftChanged(
    draftPaymentSurcharge,
    modalSnapshot.payment.surcharge,
  );
  const hasPendingChangesBase =
    hasStatusDraftChanges ||
    hasTagDraftChanges ||
    hasItemsDraftChanges ||
    hasInternalNoteDraftChanges ||
    hasPrintingNoteDraftChanges ||
    hasPaymentShippingFeeDraftChanges ||
    hasPaymentTotalDiscountDraftChanges ||
    hasPaymentBankTransferDraftChanges ||
    hasPaymentSurchargeDraftChanges;
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
  const addDraftTag = (tag: TagOptionItem, groupTags?: TagOptionItem[]) => {
    const name = tag.name.trim();
    const id = tag.tag_id.trim();
    if (!name || !id) return;
    const exists = effectiveDraftTags.some(
      (entry) => normalizeTagNameKey(entry.name) === normalizeTagNameKey(name),
    );
    if (exists) return;
    let base = effectiveDraftTags;
    if (groupTags && groupTags.length > 0) {
      const groupTagKeys = new Set(groupTags.map((gt) => normalizeTagNameKey(gt.name)));
      base = base.filter((entry) => !groupTagKeys.has(normalizeTagNameKey(entry.name)));
    }
    applyDraftTags([...base, { id, name }]);
  };
  const removeDraftTag = (tagName: string) => {
    applyDraftTags(
      effectiveDraftTags.filter(
        (entry) => normalizeTagNameKey(entry.name) !== normalizeTagNameKey(tagName),
      ),
    );
  };
  const updateDraftItemQuantity = (variationIdRaw: string, quantityText: string) => {
    const variationId = variationIdRaw.trim();
    if (!variationId) return;

    setDraftItems((prev) => {
      const base = (prev ?? baseWarehouseScopedModalItems).map((item) => ({ ...item }));
      const index = base.findIndex(
        (item) => (item.variationId || item.id || '').trim() === variationId,
      );
      if (index < 0) return base;

      const parsed = Number.parseInt(quantityText, 10);
      const nextQuantity = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      base[index] = {
        ...base[index],
        quantity: nextQuantity,
      };
      return base;
    });
  };
  const addProductToDraftItems = (option: ProductOptionItem) => {
    const variationId = option.variation_id.trim();
    if (!variationId) return;

    setDraftItems((prev) => {
      const base = (prev ?? baseWarehouseScopedModalItems).map((item) => ({ ...item }));
      const existingIndex = base.findIndex(
        (item) => (item.variationId || item.id || '').trim() === variationId,
      );

      if (existingIndex >= 0) {
        const existing = base[existingIndex];
        base[existingIndex] = {
          ...existing,
          quantity: (Number.isFinite(existing.quantity) && existing.quantity > 0
            ? Math.floor(existing.quantity)
            : 1) + 1,
        };
        return base;
      }

      base.unshift({
        id: variationId,
        variationId,
        warehouseId: modalWarehouseId,
        quantity: 1,
        name: option.name || 'Unnamed product',
        productDisplayId: option.custom_id || '',
        displayId: '',
        retailPrice: Number.isFinite(option.retail_price) ? option.retail_price : 0,
        imageUrl: option.image_url || '',
      });
      return base;
    });

    setProductSearchTerm('');
    setShowProductPicker(false);
  };
  const removeDraftItem = (variationIdRaw: string) => {
    const variationId = variationIdRaw.trim();
    if (!variationId) return;

    setDraftItems((prev) => {
      const base = (prev ?? baseWarehouseScopedModalItems).map((item) => ({ ...item }));
      return base.filter((item) => (item.variationId || item.id || '').trim() !== variationId);
    });
  };
  const handleFallbackSyncProducts = async () => {
    if (!selectedOrderForModal?.shop_id) return;
    setIsSyncingFallbackProducts(true);
    try {
      const syncedRows = await syncStoreProductsByShop(selectedOrderForModal.shop_id);
      addToast('success', `Products synced (${syncedRows} rows).`);
      if (selectedOrderForModal.id && showProductPicker) {
        await fetchProductOptions(selectedOrderForModal.id, productSearchTerm);
      }
      fetchDataRef.current?.({ silent: true });
    } catch (err: unknown) {
      const message = parseApiErrorMessage(err, 'Failed to sync products');
      addToast('error', message);
    } finally {
      setIsSyncingFallbackProducts(false);
    }
  };
  const handleFallbackSyncTags = async () => {
    if (!selectedStoreId || !selectedOrderForModal?.id) return;
    setIsSyncingFallbackTags(true);
    try {
      const synced = await syncStoreTags(selectedStoreId);
      addToast('success', `Tags synced (${synced}).`);
      await fetchTagOptions(selectedOrderForModal.id);
    } catch (err: unknown) {
      const message = parseApiErrorMessage(err, 'Failed to sync tags');
      addToast('error', message);
    } finally {
      setIsSyncingFallbackTags(false);
    }
  };
  const handleFallbackSyncWarehouses = async () => {
    if (!selectedStoreId) return;
    setIsSyncingFallbackWarehouses(true);
    try {
      const synced = await syncStoreWarehouses(selectedStoreId);
      addToast('success', `Warehouses synced (${synced}).`);
      if (selectedOrderForModal?.id && showProductPicker) {
        await fetchProductOptions(selectedOrderForModal.id, productSearchTerm);
      }
      fetchDataRef.current?.({ silent: true });
    } catch (err: unknown) {
      const message = parseApiErrorMessage(err, 'Failed to sync warehouses');
      addToast('error', message);
    } finally {
      setIsSyncingFallbackWarehouses(false);
    }
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

  const handleCopyConversationLink = async () => {
    const conversationLink = modalSnapshot.customer.conversationLink;
    if (!conversationLink) return;

    window.open(conversationLink, '_blank', 'noopener,noreferrer');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(conversationLink);
      } else {
        throw new Error('Clipboard API unavailable');
      }

      setIsConversationLinkCopied(true);
      if (conversationCopyTimeoutRef.current) {
        clearTimeout(conversationCopyTimeoutRef.current);
      }
      conversationCopyTimeoutRef.current = setTimeout(() => {
        setIsConversationLinkCopied(false);
        conversationCopyTimeoutRef.current = null;
      }, 1400);
    } catch {
      // Ignore clipboard errors silently for this quick action.
    }
  };

  const currentDeliveryAddress = modalSnapshot.shippingAddress;
  const getDeliveryComparableKey = (address: ParsedDeliveryAddress): string => {
    return [
      (address.fullAddress || address.address || '').trim().toLowerCase(),
      (address.fullName || '').trim().toLowerCase(),
      (address.phoneNumber || '').trim().toLowerCase(),
      (address.communeId || '').trim().toLowerCase(),
      (address.districtId || '').trim().toLowerCase(),
      (address.provinceId || '').trim().toLowerCase(),
    ].join('|');
  };
  const currentDeliveryComparableKey = getDeliveryComparableKey(currentDeliveryAddress);
  const deliveryAddressOptions = modalSnapshot.customer.shopCustomerAddresses
    .map((entry, idx) => ({ entry, idx }))
    .filter(({ idx, entry }) => {
      if (idx === 0) return false;
      return getDeliveryComparableKey(entry) !== currentDeliveryComparableKey;
    })
    .map(({ entry, idx }) => ({
      key: `${idx}:${entry.id || entry.phoneNumber || entry.fullAddress || entry.address}`,
      index: idx,
      value: entry,
      label:
        `${idx} - ${entry.fullAddress || entry.address || 'Unnamed address'}`,
    }));
  const selectedDeliveryAddressOption =
    deliveryAddressOptions.find((option) => option.key === selectedDeliveryAddressKey) || null;
  const selectedOrCurrentDeliveryAddress = selectedDeliveryAddressOption?.value || currentDeliveryAddress;
  const effectiveDeliveryAddress = draftDeliveryAddress || selectedOrCurrentDeliveryAddress;
  const selectedProvinceId = effectiveDeliveryAddress.provinceId.trim();
  const selectedDistrictId = effectiveDeliveryAddress.districtId.trim();
  const selectedCommuneId = effectiveDeliveryAddress.communeId.trim();
  const hasShippingAddressDraftChanges =
    JSON.stringify(toComparableShippingAddress(effectiveDeliveryAddress)) !==
    JSON.stringify(toComparableShippingAddress(currentDeliveryAddress));
  const hasPendingChanges = hasPendingChangesBase || hasShippingAddressDraftChanges;

  const deliveryFullName = effectiveDeliveryAddress.fullName;
  const deliveryPhoneNumber = effectiveDeliveryAddress.phoneNumber;
  const deliveryAddress = effectiveDeliveryAddress.address;
  const deliveryCommuneName = effectiveDeliveryAddress.communeName;
  const deliveryDistrictName = effectiveDeliveryAddress.districtName;
  const deliveryProvinceName = effectiveDeliveryAddress.provinceName;
  const deliveryAreaText = [deliveryProvinceName, deliveryDistrictName, deliveryCommuneName]
    .filter((entry) => hasNonEmptyText(entry))
    .join(', ');
  const geoSearchNormalized = geoSearchTerm.trim().toLowerCase();
  const matchesGeoSearch = (name: string, nameEn?: string | null): boolean => {
    if (!geoSearchNormalized) return true;
    const source = `${name} ${nameEn || ''}`.toLowerCase();
    return source.includes(geoSearchNormalized);
  };
  const filteredGeoProvinces = geoProvinces.filter((entry) =>
    matchesGeoSearch(entry.name, entry.name_en),
  );
  const filteredGeoDistricts = geoDistricts.filter((entry) =>
    matchesGeoSearch(entry.name, entry.name_en),
  );
  const filteredGeoCommunes = geoCommunes.filter((entry) =>
    matchesGeoSearch(entry.name, entry.name_en),
  );
  const selectedProvinceLabel =
    geoProvinces.find((entry) => entry.id === selectedProvinceId)?.name ||
    deliveryProvinceName ||
    'Province/State';
  const selectedDistrictLabel =
    geoDistricts.find((entry) => entry.id === selectedDistrictId)?.name ||
    deliveryDistrictName ||
    'City';
  const selectedCommuneLabel =
    geoCommunes.find((entry) => entry.id === selectedCommuneId)?.name ||
    deliveryCommuneName ||
    'Barangay';
  const hasProvinceGeoValue = selectedProvinceId.length > 0 || hasNonEmptyText(deliveryProvinceName);
  const hasDistrictGeoValue = selectedDistrictId.length > 0 || hasNonEmptyText(deliveryDistrictName);
  const hasCommuneGeoValue = selectedCommuneId.length > 0 || hasNonEmptyText(deliveryCommuneName);
  const missingGeoParts: string[] = [];
  if (!hasProvinceGeoValue) missingGeoParts.push('Province');
  if (!hasDistrictGeoValue) missingGeoParts.push('City');
  if (!hasCommuneGeoValue) missingGeoParts.push('Barangay');
  const hasMissingGeoParts = missingGeoParts.length > 0;
  const missingGeoMessage = hasMissingGeoParts
    ? `${missingGeoParts.join(', ')} ${missingGeoParts.length > 1 ? 'are' : 'is'} missing.`
    : null;
  const effectiveCustomerName = deliveryFullName;
  const effectiveCustomerPhone = deliveryPhoneNumber;
  const customerSummaryLookupPhone = (
    effectiveCustomerPhone ||
    selectedOrderForModal?.customer_phone ||
    ''
  ).trim();
  const canOpenPhoneHistory = customerSummaryLookupPhone.length > 0;

  type EditableDeliveryField =
    | 'fullName'
    | 'phoneNumber'
    | 'address'
    | 'fullAddress'
    | 'communeName'
    | 'districtName'
    | 'provinceName'
    | 'postCode';
  const updateDraftDeliveryAddress = (field: EditableDeliveryField, nextValue: string) => {
    setDraftDeliveryAddress((prev) => {
      const base = prev
        ? cloneDeliveryAddress(prev)
        : cloneDeliveryAddress(selectedOrCurrentDeliveryAddress);
      const next: ParsedDeliveryAddress = {
        ...base,
        [field]: nextValue,
      };
      if (
        field === 'address' ||
        field === 'communeName' ||
        field === 'districtName' ||
        field === 'provinceName'
      ) {
        next.fullAddress = composeDeliveryFullAddress(next);
      }
      return next;
    });
  };

  const handleProvinceChange = (provinceId: string) => {
    const selected = geoProvinces.find((entry) => entry.id === provinceId);
    setDraftDeliveryAddress((prev) => {
      const base = prev
        ? cloneDeliveryAddress(prev)
        : cloneDeliveryAddress(selectedOrCurrentDeliveryAddress);
      const next: ParsedDeliveryAddress = {
        ...base,
        provinceId: selected ? selected.id : '',
        provinceName: selected ? (selected.name || selected.name_en || '') : '',
        districtId: '',
        districtName: '',
        communeId: '',
        communeName: '',
        postCode: '',
        countryCode: GEO_COUNTRY_CODE,
      };
      next.fullAddress = composeDeliveryFullAddress(next);
      return next;
    });
    setGeoSearchTerm('');
    setActiveGeoTab('district');
  };

  const handleDistrictChange = (districtId: string) => {
    const selected = geoDistricts.find((entry) => entry.id === districtId);
    setDraftDeliveryAddress((prev) => {
      const base = prev
        ? cloneDeliveryAddress(prev)
        : cloneDeliveryAddress(selectedOrCurrentDeliveryAddress);
      const next: ParsedDeliveryAddress = {
        ...base,
        districtId: selected ? selected.id : '',
        districtName: selected ? (selected.name || selected.name_en || '') : '',
        communeId: '',
        communeName: '',
        postCode: '',
        countryCode: GEO_COUNTRY_CODE,
      };
      next.fullAddress = composeDeliveryFullAddress(next);
      return next;
    });
    setGeoSearchTerm('');
    setActiveGeoTab('commune');
  };

  const handleCommuneChange = (communeId: string) => {
    const selected = geoCommunes.find((entry) => entry.id === communeId);
    setDraftDeliveryAddress((prev) => {
      const base = prev
        ? cloneDeliveryAddress(prev)
        : cloneDeliveryAddress(selectedOrCurrentDeliveryAddress);
      const next: ParsedDeliveryAddress = {
        ...base,
        communeId: selected ? selected.id : '',
        communeName: selected ? (selected.name || selected.name_en || '') : '',
        countryCode: GEO_COUNTRY_CODE,
      };
      next.fullAddress = composeDeliveryFullAddress(next);
      return next;
    });
    setGeoSearchTerm('');
    setShowGeoPicker(false);
  };

  const clearGeoLocationSelection = () => {
    setDraftDeliveryAddress((prev) => {
      const base = prev
        ? cloneDeliveryAddress(prev)
        : cloneDeliveryAddress(selectedOrCurrentDeliveryAddress);
      const next: ParsedDeliveryAddress = {
        ...base,
        provinceId: '',
        provinceName: '',
        districtId: '',
        districtName: '',
        communeId: '',
        communeName: '',
        postCode: '',
        countryCode: GEO_COUNTRY_CODE,
      };
      next.fullAddress = composeDeliveryFullAddress(next);
      return next;
    });
    setGeoSearchTerm('');
    setActiveGeoTab('province');
  };

  const openGeoPicker = () => {
    setShowGeoPicker(true);
  };

  const selectedOrderId = selectedOrderForModal?.id ?? '';

  useEffect(() => {
    if (!selectedOrderId) return;

    let cancelled = false;
    setIsGeoProvincesLoading(true);
    setGeoLookupError(null);

    fetchGeoProvinces(GEO_COUNTRY_CODE)
      .then((response) => {
        if (cancelled) return;
        const items = Array.isArray(response.items) ? response.items : [];
        setGeoProvinces(items);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = parseApiErrorMessage(error, 'Failed to load province options');
        setGeoLookupError(message);
        setGeoProvinces([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsGeoProvincesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId) return;

    if (!selectedProvinceId) {
      setGeoDistricts([]);
      setGeoCommunes([]);
      setIsGeoDistrictsLoading(false);
      setIsGeoCommunesLoading(false);
      return;
    }

    let cancelled = false;
    setIsGeoDistrictsLoading(true);
    setGeoLookupError(null);

    fetchGeoDistricts(selectedProvinceId)
      .then((response) => {
        if (cancelled) return;
        const items = Array.isArray(response.items) ? response.items : [];
        setGeoDistricts(items);
        if (selectedDistrictId && !items.some((entry) => entry.id === selectedDistrictId)) {
          setDraftDeliveryAddress((prev) => {
            if (!prev) return prev;
            const base = cloneDeliveryAddress(prev);
            const next: ParsedDeliveryAddress = {
              ...base,
              districtId: '',
              districtName: '',
              communeId: '',
              communeName: '',
              postCode: '',
              countryCode: GEO_COUNTRY_CODE,
            };
            next.fullAddress = composeDeliveryFullAddress(next);
            return next;
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = parseApiErrorMessage(error, 'Failed to load city options');
        setGeoLookupError(message);
        setGeoDistricts([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsGeoDistrictsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDistrictId, selectedOrderId, selectedProvinceId]);

  useEffect(() => {
    if (!selectedOrderId) return;

    if (!selectedProvinceId || !selectedDistrictId) {
      setGeoCommunes([]);
      setIsGeoCommunesLoading(false);
      return;
    }

    let cancelled = false;
    setIsGeoCommunesLoading(true);
    setGeoLookupError(null);

    fetchGeoCommunes(selectedProvinceId, selectedDistrictId)
      .then((response) => {
        if (cancelled) return;
        const items = Array.isArray(response.items) ? response.items : [];
        setGeoCommunes(items);
        if (selectedCommuneId && !items.some((entry) => entry.id === selectedCommuneId)) {
          setDraftDeliveryAddress((prev) => {
            if (!prev) return prev;
            const base = cloneDeliveryAddress(prev);
            const next: ParsedDeliveryAddress = {
              ...base,
              communeId: '',
              communeName: '',
              countryCode: GEO_COUNTRY_CODE,
            };
            next.fullAddress = composeDeliveryFullAddress(next);
            return next;
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = parseApiErrorMessage(error, 'Failed to load barangay options');
        setGeoLookupError(message);
        setGeoCommunes([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsGeoCommunesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedOrderId,
    selectedProvinceId,
    selectedDistrictId,
    selectedCommuneId,
  ]);

  const paymentShippingFee = Math.max(0, effectivePaymentShippingFee);
  const paymentDiscount = Math.max(0, effectivePaymentDiscount);
  const paymentSurcharge = Math.max(0, effectivePaymentSurcharge);
  const paymentBankTransfer = Math.max(0, effectivePaymentBankTransfer);
  const paymentProductBase = Math.max(
    0,
    effectiveModalItems.reduce(
      (sum, item) => sum + Math.max(0, item.retailPrice) * Math.max(0, item.quantity),
      0,
    ),
  );
  const paymentSubtotal = Math.max(
    0,
    paymentProductBase + paymentShippingFee + paymentSurcharge,
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

    const parsedShippingFeeDraft =
      draftPaymentShippingFee === null ? undefined : parseNumericDraftInput(draftPaymentShippingFee);
    if (draftPaymentShippingFee !== null && parsedShippingFeeDraft === null) {
      const errorMessage = 'Shipping fee must be a valid number.';
      setStatusSaveError(errorMessage);
      addToast('error', errorMessage);
      return;
    }
    const parsedTotalDiscountDraft =
      draftPaymentTotalDiscount === null ? undefined : parseNumericDraftInput(draftPaymentTotalDiscount);
    if (draftPaymentTotalDiscount !== null && parsedTotalDiscountDraft === null) {
      const errorMessage = 'Discounted must be a valid number.';
      setStatusSaveError(errorMessage);
      addToast('error', errorMessage);
      return;
    }
    const parsedBankTransferDraft =
      draftPaymentBankTransfer === null ? undefined : parseNumericDraftInput(draftPaymentBankTransfer);
    if (draftPaymentBankTransfer !== null && parsedBankTransferDraft === null) {
      const errorMessage = 'Bank transfer must be a valid number.';
      setStatusSaveError(errorMessage);
      addToast('error', errorMessage);
      return;
    }
    const parsedSurchargeDraft =
      draftPaymentSurcharge === null ? undefined : parseNumericDraftInput(draftPaymentSurcharge);
    if (draftPaymentSurcharge !== null && parsedSurchargeDraft === null) {
      const errorMessage = 'Surcharge must be a valid number.';
      setStatusSaveError(errorMessage);
      addToast('error', errorMessage);
      return;
    }
    const shouldUpdateShippingFee =
      typeof parsedShippingFeeDraft === 'number' &&
      Math.abs(parsedShippingFeeDraft - modalSnapshot.payment.shippingFee) > 0.0001;
    const shouldUpdateTotalDiscount =
      typeof parsedTotalDiscountDraft === 'number' &&
      Math.abs(parsedTotalDiscountDraft - modalSnapshot.payment.totalDiscount) > 0.0001;
    const shouldUpdateBankPayments =
      typeof parsedBankTransferDraft === 'number' &&
      Math.abs(parsedBankTransferDraft - modalSnapshot.payment.bankTransfer) > 0.0001;
    const shouldUpdateSurcharge =
      typeof parsedSurchargeDraft === 'number' &&
      Math.abs(parsedSurchargeDraft - modalSnapshot.payment.surcharge) > 0.0001;

    const payload: Record<string, unknown> = {};
    const normalizedItemsPayload = hasItemsDraftChanges
      ? normalizeItemsForUpdatePayload(effectiveModalItems)
      : undefined;
    if (draftStatus !== null) payload.status = draftStatus;
    if (hasTagDraftChanges) payload.tags = resolvedTagsPayload || [];
    if (hasItemsDraftChanges) payload.items = normalizedItemsPayload || [];
    if (hasInternalNoteDraftChanges) payload.note = toApiLineBreaks(effectiveInternalNote);
    if (hasPrintingNoteDraftChanges) payload.note_print = toApiLineBreaks(effectivePrintingNote);
    if (shouldUpdateShippingFee) payload.shipping_fee = parsedShippingFeeDraft;
    if (shouldUpdateTotalDiscount) payload.total_discount = parsedTotalDiscountDraft;
    if (shouldUpdateBankPayments) {
      payload.bank_payments = buildBankPaymentsPayloadFromTransferAmount(
        modalSnapshot.payment.bankPaymentsRaw,
        parsedBankTransferDraft as number,
      );
    }
    if (shouldUpdateSurcharge) payload.surcharge = parsedSurchargeDraft;
    if (hasShippingAddressDraftChanges) {
      if (!effectiveDeliveryAddress.fullName.trim() || !effectiveDeliveryAddress.phoneNumber.trim()) {
        const errorMessage = 'Customer name and phone number are required before saving.';
        setStatusSaveError(errorMessage);
        addToast('error', errorMessage);
        return;
      }
      payload.shipping_address = buildShippingAddressPayload(effectiveDeliveryAddress);
    }

    setIsSavingStatus(true);
    setStatusSaveError(null);
    if (statusLabel) {
      addToast('info', `Updating order ${orderRef} to ${statusLabel}...`);
    } else if (hasTagDraftChanges) {
      addToast('info', `Updating tags for order ${orderRef}...`);
    } else if (hasItemsDraftChanges) {
      addToast('info', `Updating products for order ${orderRef}...`);
    } else if (hasInternalNoteDraftChanges || hasPrintingNoteDraftChanges) {
      addToast('info', `Updating notes for order ${orderRef}...`);
    } else if (
      shouldUpdateShippingFee ||
      shouldUpdateTotalDiscount ||
      shouldUpdateBankPayments ||
      shouldUpdateSurcharge
    ) {
      addToast('info', `Updating payment details for order ${orderRef}...`);
    } else if (hasShippingAddressDraftChanges) {
      addToast('info', `Updating delivery address for order ${orderRef}...`);
    } else {
      addToast('info', `Updating order ${orderRef}...`);
    }
    try {
      await updateConfirmationOrder(selectedOrderForModal.id, payload);
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
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2">
        <h1 className="text-lg font-semibold text-slate-900">Confirmation of Order</h1>
      </div>

      <Card padding="sm" className="border-slate-200 shadow-sm bg-white">
        <div className="flex flex-wrap items-center justify-end gap-2 mb-2">
          <div className="relative order-1" ref={shopPickerRef}>
            <button
              type="button"
              onClick={() => setShowShopPicker((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white hover:border-slate-300 focus:outline-none"
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
              inputClassName="w-[240px] rounded-lg border border-slate-200 pl-3 pr-10 py-1.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-slate-300"
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
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Shop</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Order ID</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Product</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">COD</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Return Rate</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Tags</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Customer</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap">Phone</th>
                  <th className="w-[150px] min-w-[150px] px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500 whitespace-nowrap sticky right-0 z-20 bg-slate-50 border-l border-slate-200">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td className="px-3 py-3 text-xs text-slate-400" colSpan={10}>
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
                      <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">{row.date_local}</td>
                      <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">{row.shop_name}</td>
                      <td className="px-3 py-2 text-xs font-semibold text-slate-900 whitespace-nowrap">{row.pos_order_id}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        <span className="block max-w-[280px] truncate" title={productSummary}>
                          {productSummary}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(row.cod || 0)}
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap">
                        <ReturnRateCell
                          success={row.reports_by_phone_success}
                          fail={row.reports_by_phone_fail}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                        {row.tags?.length ? row.tags.join(', ') : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">{row.customer_name || '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">{row.customer_phone || '—'}</td>
                      <td
                        className={`w-[150px] min-w-[150px] px-2 py-1.5 text-xs font-semibold text-slate-900 whitespace-nowrap sticky right-0 z-10 border-l border-slate-100 ${
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
                    <td className="px-3 py-3 text-xs text-slate-400" colSpan={10}>
                      No new orders for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-600">
              Showing {startRow}-{endRow} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={!canPrev || isLoading}
              >
                Previous
              </button>
              <button
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="relative mx-auto my-2 flex h-[calc(100vh-1.5rem)] w-[min(94vw,1200px)] max-h-[calc(100vh-1.5rem)] max-w-none flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:my-4 sm:h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-3rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Order Detail</p>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {selectedOrderForModal.shop_id} - {selectedOrderForModal.pos_order_id}
                  </h3>
                  {modalSnapshot.orderLink ? (
                    <button
                      type="button"
                      onClick={handleOpenAndCopyOrderLink}
                      className="inline-flex rounded-md p-0.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      aria-label="Open and copy order link"
                      title="Open and copy order link"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {isConversationLinkCopied ? (
                  <span className="text-[10px] font-semibold text-emerald-600">Copied</span>
                ) : null}
                {modalSnapshot.customer.conversationLink ? (
                  <button
                    type="button"
                    onClick={handleCopyConversationLink}
                    className="inline-flex rounded-lg border-2 border-blue-400 p-1.5 text-blue-500"
                    title="Copy conversation link"
                    aria-label="Copy conversation link"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedOrderForModal(null)}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Close order modal"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-20">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-start">

              {/* ── LEFT COLUMN: Products + Payment ── */}
              <div className="space-y-3 lg:col-span-7">
                <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
                  {/* Header row 1: Title + warehouse + counts */}
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                    <Package className="h-3.5 w-3.5 text-indigo-500" />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Products</h4>
                    {modalWarehouseName || modalWarehouseId ? (
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {modalWarehouseName || modalWarehouseId}
                      </span>
                    ) : null}
                    {effectiveModalItems.length > 0 ? (
                      <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">
                        <span>
                          {effectiveModalItems.length} variation
                          {effectiveModalItems.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span>
                          Qty: {effectiveModalItems.reduce((total, item) => total + item.quantity, 0)}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Header row 2: Search product (inside header area) */}
                  {isSelectedOrderEditable ? (
                    <div className="relative border-b border-slate-100 px-3 py-1.5" ref={productPickerRef}>
                      <div className="flex items-center gap-1.5">
                        <Search className="h-3 w-3 shrink-0 text-slate-400" />
                        <input
                          type="text"
                          value={productSearchTerm}
                          onChange={(event) => {
                            setProductSearchTerm(event.target.value);
                            if (!showProductPicker) setShowProductPicker(true);
                          }}
                          onFocus={() => setShowProductPicker(true)}
                          placeholder="Search product to add"
                          className="w-full bg-transparent text-[11px] text-slate-900 outline-none placeholder:text-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowProductPicker((prev) => !prev)}
                          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          {showProductPicker ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      {showProductPicker ? (
                        <div className="absolute left-0 right-0 top-full z-30 mt-px max-h-56 overflow-y-auto rounded-b-lg border border-t-0 border-slate-200 bg-white shadow-lg">
                          {isProductOptionsLoading ? (
                            <div className="px-2.5 py-2 text-[11px] text-slate-500">Loading products...</div>
                          ) : productOptionsError ? (
                            <div className="px-2.5 py-2 text-[11px] text-rose-600">{productOptionsError}</div>
                          ) : productOptions.length === 0 ? (
                            <div className="space-y-2 px-2.5 py-2">
                              <div className="text-[11px] text-slate-500">
                                {shouldShowWarehouseFallbackSync
                                  ? 'Warehouse is not matched yet for this order. Sync warehouse and products.'
                                  : 'No products available for this warehouse.'}
                              </div>
                              {(shouldShowWarehouseFallbackSync || shouldShowProductFallbackSync) ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {shouldShowWarehouseFallbackSync ? (
                                    <button
                                      type="button"
                                      onClick={handleFallbackSyncWarehouses}
                                      disabled={isSyncingFallbackWarehouses || isSyncingFallbackProducts}
                                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isSyncingFallbackWarehouses ? 'Syncing warehouse...' : 'Sync Warehouse'}
                                    </button>
                                  ) : null}
                                  {shouldShowProductFallbackSync ? (
                                    <button
                                      type="button"
                                      onClick={handleFallbackSyncProducts}
                                      disabled={isSyncingFallbackProducts || isSyncingFallbackWarehouses}
                                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isSyncingFallbackProducts ? 'Syncing products...' : 'Sync Products'}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            productOptions.map((option) => (
                              <button
                                key={option.variation_id}
                                type="button"
                                onClick={() => addProductToDraftItems(option)}
                                className="flex w-full items-center gap-2 border-b border-slate-50 px-2.5 py-1.5 text-left transition hover:bg-indigo-50/50"
                              >
                                <div className="h-7 w-7 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                                  {option.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={option.image_url}
                                      alt={option.name || 'Product image'}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <Package className="h-3 w-3 text-slate-300" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[11px] font-medium text-slate-900">
                                    {option.name || 'Unnamed product'}
                                  </p>
                                  <p className="truncate text-[10px] text-slate-400">
                                    {option.custom_id || option.variation_id}
                                  </p>
                                </div>
                                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-emerald-600">
                                  {formatCurrency(option.retail_price || 0)}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Product list */}
                  <div className="p-2">
                    {effectiveModalItems.length > 0 ? (
                      <div className="space-y-1">
                        {effectiveModalItems.map((item, index) => (
                          <div
                            key={`${item.variationId || item.id || item.productDisplayId || item.displayId || item.name}-${index}`}
                            className="relative rounded-lg border border-slate-100 bg-slate-50/40 px-2 py-1.5 text-xs text-slate-800 transition hover:border-slate-200 hover:bg-slate-50"
                          >
                            {isSelectedOrderEditable ? (
                              <button
                                type="button"
                                onClick={() => removeDraftItem((item.variationId || item.id || '').trim())}
                                className="absolute -right-1.5 -top-1.5 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-400 shadow-sm transition hover:bg-rose-50 hover:text-rose-600"
                                aria-label="Remove product"
                                title="Remove product"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            ) : null}
                            <div className="flex items-center gap-2">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                                {item.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name || 'Product image'}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Package className="h-3.5 w-3.5 text-slate-300" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-0.5">
                                  {item.productDisplayId ? (
                                    <span className="inline-flex rounded border border-green-200 bg-green-50 px-1 py-px text-[9px] font-semibold text-green-700">
                                      {item.productDisplayId}
                                    </span>
                                  ) : null}
                                  {item.displayId ? (
                                    <span className="inline-flex rounded border border-pink-200 bg-pink-50 px-1 py-px text-[9px] font-semibold text-pink-700">
                                      {item.displayId}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 truncate text-[11px] font-medium text-slate-900">{item.name || '—'}</p>
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-0.5">
                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                  <span className="tabular-nums">{Math.round(item.retailPrice)}</span>
                                  <span className="text-slate-300">x</span>
                                  {isSelectedOrderEditable ? (
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.quantity}
                                      onChange={(event) =>
                                        updateDraftItemQuantity(
                                          (item.variationId || item.id || '').trim(),
                                          event.target.value,
                                        )
                                      }
                                      className="h-5 w-12 rounded border border-slate-200 bg-white px-1 text-right text-[11px] tabular-nums font-medium text-slate-900 outline-none focus:border-indigo-400"
                                    />
                                  ) : (
                                    <span className="tabular-nums font-medium">{item.quantity}</span>
                                  )}
                                </div>
                                <p className="text-[11px] font-semibold tabular-nums text-indigo-600">
                                  {formatCurrency(item.retailPrice * item.quantity)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2 py-3 text-center">
                        <p className="text-[11px] text-slate-400">
                          {shouldShowEmptyCartState ? 'Empty Cart' : 'No product data available'}
                        </p>
                        {!shouldShowEmptyCartState &&
                        isSelectedOrderEditable &&
                        (selectedOrderForModal?.shop_id || selectedStoreId) ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {selectedStoreId && modalWarehouseId && !effectiveWarehouseName ? (
                              <button
                                type="button"
                                onClick={handleFallbackSyncWarehouses}
                                disabled={isSyncingFallbackWarehouses || isSyncingFallbackProducts}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSyncingFallbackWarehouses ? 'Syncing warehouse...' : 'Sync Warehouse'}
                              </button>
                            ) : null}
                            {selectedOrderForModal?.shop_id ? (
                              <button
                                type="button"
                                onClick={handleFallbackSyncProducts}
                                disabled={isSyncingFallbackProducts || isSyncingFallbackWarehouses}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSyncingFallbackProducts ? 'Syncing products...' : 'Sync Products'}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </section>

                {/* ── Payment (collapsible) ── */}
                <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIsPaymentExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-left transition hover:bg-slate-100/80"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Payment</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-indigo-600">
                        {formatCurrency(paymentNeedToPay)}
                      </span>
                      {isPaymentExpanded ? (
                        <ChevronUp className="h-3 w-3 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </button>
                  {isPaymentExpanded ? (
                    <div className="p-3">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-3 py-0.5 text-slate-600">
                          <span>Shipping fee</span>
                          <div className="relative w-36">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                draftPaymentShippingFee !== null
                                  ? draftPaymentShippingFee
                                  : String(paymentShippingFee)
                              }
                              onChange={(event) => setDraftPaymentShippingFee(event.target.value)}
                              disabled={!isSelectedOrderEditable || isSavingStatus}
                              className="h-8 w-full rounded-md border border-slate-200 bg-slate-100 pl-2 pr-7 text-right tabular-nums font-medium text-slate-900 outline-none transition focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-900">
                              ₱
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-0.5 text-slate-600">
                          <span>Discounted</span>
                          <div className="relative w-36">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                draftPaymentTotalDiscount !== null
                                  ? draftPaymentTotalDiscount
                                  : String(paymentDiscount)
                              }
                              onChange={(event) => setDraftPaymentTotalDiscount(event.target.value)}
                              disabled={!isSelectedOrderEditable || isSavingStatus}
                              className="h-8 w-full rounded-md border border-slate-200 bg-slate-100 pl-2 pr-7 text-right tabular-nums font-medium text-slate-900 outline-none transition focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-900">
                              ₱
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-0.5 text-slate-600">
                          <span>Bank transfer</span>
                          <div className="relative w-36">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                draftPaymentBankTransfer !== null
                                  ? draftPaymentBankTransfer
                                  : String(paymentBankTransfer)
                              }
                              onChange={(event) => setDraftPaymentBankTransfer(event.target.value)}
                              disabled={!isSelectedOrderEditable || isSavingStatus}
                              className="h-8 w-full rounded-md border border-slate-200 bg-slate-100 pl-2 pr-7 text-right tabular-nums font-medium text-slate-900 outline-none transition focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-900">
                              ₱
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-0.5 text-slate-600">
                          <span>Surcharge</span>
                          <div className="relative w-36">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                draftPaymentSurcharge !== null
                                  ? draftPaymentSurcharge
                                  : String(paymentSurcharge)
                              }
                              onChange={(event) => setDraftPaymentSurcharge(event.target.value)}
                              disabled={!isSelectedOrderEditable || isSavingStatus}
                              className="h-8 w-full rounded-md border border-slate-200 bg-slate-100 pl-2 pr-7 text-right tabular-nums font-medium text-slate-900 outline-none transition focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-900">
                              ₱
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1 rounded-md border border-slate-100 bg-slate-50 p-2 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Subtotal</span>
                          <span className="tabular-nums font-medium text-slate-900">{formatCurrency(paymentSubtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Discount</span>
                          <span className="tabular-nums font-medium text-emerald-600">{formatCurrency(paymentDiscount)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200 pt-1 text-slate-600">
                          <span>After discount</span>
                          <span className="tabular-nums font-medium text-slate-900">{formatCurrency(paymentAfterDiscount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="font-medium">Need to pay</span>
                          <span className="tabular-nums font-semibold text-indigo-600">{formatCurrency(paymentNeedToPay)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Paid</span>
                          <span className="tabular-nums font-medium text-slate-900">{formatCurrency(paymentPaid)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200 pt-1 text-slate-700">
                          <span className="font-medium">Remain</span>
                          <span className="tabular-nums font-semibold text-rose-600">{formatCurrency(paymentRemain)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>

                {/* ── Notes (full width in left column) ── */}
                <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                    <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Notes</h4>
                    {effectiveInternalNote.trim() || effectivePrintingNote.trim() ? (
                      <span className="ml-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" title="Has notes" />
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="mb-2 inline-flex rounded-md bg-slate-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => setActiveNoteTab('all')}
                        className={`relative rounded px-2 py-1 text-xs font-medium transition ${
                          activeNoteTab === 'all'
                            ? 'bg-white text-indigo-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveNoteTab('internal')}
                        className={`relative rounded px-2 py-1 text-xs font-medium transition ${
                          activeNoteTab === 'internal'
                            ? 'bg-white text-indigo-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Internal
                        {effectiveInternalNote.trim() ? (
                          <span className="absolute -right-0.5 -top-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" />
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveNoteTab('printing')}
                        className={`relative rounded px-2 py-1 text-xs font-medium transition ${
                          activeNoteTab === 'printing'
                            ? 'bg-white text-indigo-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Printing
                        {effectivePrintingNote.trim() ? (
                          <span className="absolute -right-0.5 -top-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
                        ) : null}
                      </button>
                    </div>

                    {activeNoteTab === 'all' ? (
                      <div className="space-y-2">
                        <div className="rounded-md border border-slate-100 bg-slate-50/50 p-2">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="inline-flex rounded border border-violet-200 bg-violet-50 px-1.5 py-px text-[10px] font-semibold text-violet-700">
                              Internal
                            </span>
                            {isSelectedOrderEditable ? (
                              <button
                                type="button"
                                onClick={() => setActiveNoteTab('internal')}
                                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                aria-label="Edit internal note"
                                title="Edit internal note"
                              >
                                <PencilLine className="h-3 w-3" />
                              </button>
                            ) : null}
                          </div>
                          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">
                            {effectiveInternalNote || '\u00A0'}
                          </p>
                        </div>

                        <div className="rounded-md border border-slate-100 bg-slate-50/50 p-2">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="inline-flex rounded border border-orange-200 bg-orange-50 px-1.5 py-px text-[10px] font-semibold text-orange-700">
                              Printing
                            </span>
                            {isSelectedOrderEditable ? (
                              <button
                                type="button"
                                onClick={() => setActiveNoteTab('printing')}
                                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                aria-label="Edit printing note"
                                title="Edit printing note"
                              >
                                <PencilLine className="h-3 w-3" />
                              </button>
                            ) : null}
                          </div>
                          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">
                            {effectivePrintingNote || '\u00A0'}
                          </p>
                        </div>
                      </div>
                    ) : activeNoteTab === 'internal' ? (
                      <div>
                        <div className="mb-1.5">
                          <span className="inline-flex rounded border border-violet-200 bg-violet-50 px-1.5 py-px text-[10px] font-semibold text-violet-700">
                            Internal
                          </span>
                        </div>
                        {isSelectedOrderEditable ? (
                          <textarea
                            value={effectiveInternalNote}
                            onChange={(event) => setDraftInternalNote(normalizeLineBreaks(event.target.value))}
                            className="min-h-[100px] w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            placeholder="Add internal note..."
                          />
                        ) : (
                          <p className="min-h-[100px] whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">
                            {effectiveInternalNote || '\u00A0'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="mb-1.5">
                          <span className="inline-flex rounded border border-orange-200 bg-orange-50 px-1.5 py-px text-[10px] font-semibold text-orange-700">
                            Printing
                          </span>
                        </div>
                        {isSelectedOrderEditable ? (
                          <textarea
                            value={effectivePrintingNote}
                            onChange={(event) => setDraftPrintingNote(normalizeLineBreaks(event.target.value))}
                            className="min-h-[100px] w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            placeholder="Add printing note..."
                          />
                        ) : (
                          <p className="min-h-[100px] whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">
                            {effectivePrintingNote || '\u00A0'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* ── RIGHT COLUMN: Order Info + Customer + Delivery ── */}
              <div className="space-y-3 lg:col-span-5">

                {/* ── Order Info: Date + Status + Tags ── */}
                <section className="relative overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 rounded-t-xl border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                    <Package className="h-3.5 w-3.5 text-blue-500" />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Order Info</h4>
                    <span className="ml-auto rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-600 tabular-nums">
                      {selectedOrderForModal.date_local}
                    </span>
                  </div>
                  <div className="space-y-2 p-3">
                    {/* Status selector */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600">Status</span>
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
                          className={`inline-flex min-w-[120px] max-w-full items-center justify-between gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition ${
                            isSelectedOrderEditable ? 'hover:opacity-90' : 'cursor-not-allowed opacity-85'
                          }`}
                          style={{ backgroundColor: statusDisplayColor }}
                        >
                          <span className="truncate">{statusDisplayLabel}</span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 ${isSelectedOrderEditable ? 'text-white/90' : 'text-slate-200'}`}
                          />
                        </button>
                        {isSelectedOrderEditable && isStatusMenuOpen ? (
                          <div className="absolute right-0 top-full z-30 mt-1 min-w-[140px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
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
                                  className={`block w-full px-2.5 py-1.5 text-left text-xs transition ${
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

                    {/* Tags */}
                    <div className="border-t border-slate-100 pt-2">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Tag className="h-3 w-3 text-slate-400" />
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Tags</span>
                        {effectiveDraftTags.length > 0 ? (
                          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                            {effectiveDraftTags.length}
                          </span>
                        ) : null}
                      </div>
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
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${
                              isSelectedOrderEditable
                                ? 'border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                                : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                            }`}
                          >
                            Add Tags
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          {isSelectedOrderEditable && showTagPicker ? (
                            <div
                              className="absolute left-0 top-full z-30 mt-1 w-[220px]"
                              onMouseLeave={() => setActiveTagGroupId(null)}
                            >
                              <div className="relative overflow-visible rounded-md border border-slate-200 bg-white shadow-lg">
                                <div className="max-h-[240px] overflow-auto py-0.5">
                                  {isTagOptionsLoading ? (
                                    <div className="px-2.5 py-1.5 text-xs text-slate-500">Loading tags...</div>
                                  ) : tagOptionsError ? (
                                    <div className="space-y-2 px-2.5 py-1.5">
                                      <div className="text-xs text-rose-600">{tagOptionsError}</div>
                                      {shouldShowTagFallbackSync ? (
                                        <button
                                          type="button"
                                          onClick={handleFallbackSyncTags}
                                          disabled={isSyncingFallbackTags}
                                          className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {isSyncingFallbackTags ? 'Syncing tags...' : 'Sync Tags'}
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <>
                                      {availableTagGroups.map((group) => (
                                        <button
                                          key={group.group_id}
                                          type="button"
                                          onMouseEnter={() => setActiveTagGroupId(group.group_id)}
                                          className="flex w-full items-center justify-between border-b border-dashed border-slate-100 px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-800 hover:bg-slate-50"
                                        >
                                          <span>{group.group_name}</span>
                                          <ChevronDown className="-rotate-90 h-3 w-3 text-slate-500" />
                                        </button>
                                      ))}

                                      {availableIndividualTags.map((tag) => {
                                        const selected = isTagSelected(tag.name);
                                        return (
                                          <button
                                            key={tag.tag_id}
                                            type="button"
                                            onClick={() => addDraftTag(tag)}
                                            className={`flex w-full items-center gap-1.5 border-b border-dashed border-slate-100 px-2.5 py-1.5 text-left text-[11px] ${
                                              selected
                                                ? 'bg-indigo-50 font-semibold text-indigo-700'
                                                : 'text-slate-800 hover:bg-slate-50'
                                            }`}
                                          >
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />
                                            <span>{tag.name}</span>
                                          </button>
                                        );
                                      })}

                                      {!availableTagGroups.length && !availableIndividualTags.length ? (
                                        <div className="space-y-2 px-2.5 py-1.5">
                                          <div className="text-xs text-slate-500">No tags available for this shop.</div>
                                          {shouldShowTagFallbackSync ? (
                                            <button
                                              type="button"
                                              onClick={handleFallbackSyncTags}
                                              disabled={isSyncingFallbackTags}
                                              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              {isSyncingFallbackTags ? 'Syncing tags...' : 'Sync Tags'}
                                            </button>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </>
                                  )}
                                </div>

                                {activeTagGroup ? (
                                  <div className="absolute left-full top-0 ml-1 w-[200px] rounded-md border border-slate-200 bg-white shadow-lg">
                                    <div className="max-h-[240px] overflow-auto py-0.5">
                                      {activeTagGroup.tags.map((tag) => {
                                        const selected = isTagSelected(tag.name);
                                        return (
                                          <button
                                            key={tag.tag_id}
                                            type="button"
                                            onClick={() => addDraftTag(tag, activeTagGroup.tags)}
                                            className={`flex w-full items-center gap-1.5 border-b border-dashed border-slate-100 px-2.5 py-1.5 text-left text-[11px] ${
                                              selected
                                                ? 'bg-indigo-50 font-semibold text-indigo-700'
                                                : 'text-slate-800 hover:bg-slate-50'
                                            }`}
                                          >
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />
                                            <span>{tag.name}</span>
                                          </button>
                                        );
                                      })}
                                      {!activeTagGroup.tags.length ? (
                                        <div className="px-2.5 py-1.5 text-xs text-slate-500">No tags in this group.</div>
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
                                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                              >
                                <span>{tag.name}</span>
                                {isSelectedOrderEditable ? (
                                  <button
                                    type="button"
                                    onClick={() => removeDraftTag(tag.name)}
                                    className="rounded-full p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600"
                                    aria-label={`Remove tag ${tag.name}`}
                                    title={`Remove ${tag.name}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                ) : null}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">No tags</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── Customer ── */}
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                    <User className="h-3.5 w-3.5 text-sky-500" />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Customer</h4>
                    {modalSnapshot.customer.gender ? (
                      <span className="ml-auto rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">
                        {modalSnapshot.customer.gender}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3">
                    {(modalSnapshot.duplicatedPhone || modalSnapshot.duplicatedIp) ? (
                      <div className="mb-2 space-y-1">
                        {modalSnapshot.duplicatedPhone ? (
                          <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">
                            <PhoneCall className="h-3 w-3 text-amber-500" />
                            <span>Multiple orders from this phone</span>
                          </div>
                        ) : null}
                        {modalSnapshot.duplicatedIp ? (
                          <div className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-800">
                            <Wifi className="h-3 w-3 text-rose-500" />
                            <span>Multiple IP detected</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={effectiveCustomerName}
                        onChange={(event) => updateDraftDeliveryAddress('fullName', event.target.value)}
                        disabled={!isSelectedOrderEditable}
                        placeholder="Customer name"
                        className={`w-full rounded-md px-2.5 py-1.5 text-xs outline-none transition ${
                          isSelectedOrderEditable
                            ? 'border border-slate-200 bg-slate-50 text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                            : 'cursor-not-allowed border border-slate-100 text-slate-500'
                        }`}
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={effectiveCustomerPhone}
                          onChange={(event) => updateDraftDeliveryAddress('phoneNumber', event.target.value)}
                          disabled={!isSelectedOrderEditable}
                          placeholder="Phone number"
                          className={`min-w-0 flex-1 rounded-md px-2.5 py-1.5 text-xs outline-none transition ${
                            isSelectedOrderEditable
                              ? 'border border-slate-200 bg-slate-50 text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                              : 'cursor-not-allowed border border-slate-100 text-slate-500'
                          }`}
                        />
                        {effectiveCustomerPhone ? (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(effectiveCustomerPhone);
                              setIsPhoneCopied(true);
                              if (phoneCopyTimeoutRef.current) clearTimeout(phoneCopyTimeoutRef.current);
                              phoneCopyTimeoutRef.current = setTimeout(() => setIsPhoneCopied(false), 2000);
                            }}
                            className="shrink-0 rounded-md border border-slate-200 p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                            title="Copy phone number"
                          >
                            {isPhoneCopied ? (
                              <span className="text-[9px] font-semibold text-emerald-600">Done</span>
                            ) : (
                              <ClipboardCopy className="h-3 w-3" />
                            )}
                          </button>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-400">
                          {modalSnapshot.customer.email || 'Email'}
                        </div>
                        <div className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-400">
                          {modalSnapshot.customer.dateOfBirth || 'Date of birth'}
                        </div>
                      </div>
                    </div>

                    {/* Phone history button with success badge */}
                    <button
                      type="button"
                      onClick={openPhoneHistoryModal}
                      disabled={!canOpenPhoneHistory}
                      className={`mt-2 w-full rounded-md border px-2.5 py-2 text-left transition ${
                        canOpenPhoneHistory
                          ? 'border-sky-200 bg-sky-50/70 hover:bg-sky-100/70'
                          : 'cursor-default border-slate-100 bg-slate-50'
                      }`}
                      title={canOpenPhoneHistory ? 'Open history of orders by this phone number' : 'Phone number unavailable'}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">{effectiveCustomerName || '—'}</p>
                          <p className="text-[10px] text-blue-600">{effectiveCustomerPhone || '—'}</p>
                        </div>
                        {(() => {
                          const total = modalSnapshot.customer.orderCount;
                          const success = modalSnapshot.customer.succeedOrderCount;
                          const rate = total > 0 ? (success / total) * 100 : 0;
                          const badgeColor = total === 0
                            ? 'border-slate-200 bg-slate-50 text-slate-600'
                            : rate >= 70
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : rate >= 40
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-rose-200 bg-rose-50 text-rose-700';
                          return (
                            <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${badgeColor}`}>
                              {success}/{total} order{total !== 1 ? 's' : ''}
                            </span>
                          );
                        })()}
                      </div>
                    </button>
                  </div>
                </section>

                {/* ── Delivery ── */}
                <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                    <MapPin className="h-3.5 w-3.5 text-rose-500" />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Delivery</h4>
                    {deliveryAddressOptions.length > 0 ? (
                      <select
                        value={selectedDeliveryAddressKey}
                        onChange={(event) => {
                          setSelectedDeliveryAddressKey(event.target.value);
                          setDraftDeliveryAddress(null);
                        }}
                        disabled={!isSelectedOrderEditable}
                        className={`ml-auto max-w-[160px] truncate rounded-md border px-1.5 py-0.5 text-[10px] transition ${
                          isSelectedOrderEditable
                            ? 'border-slate-200 bg-white text-slate-800 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100'
                            : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-500'
                        }`}
                        title="Select a different saved customer address"
                      >
                        <option value="">Current address</option>
                        {deliveryAddressOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          value={deliveryFullName}
                          onChange={(event) => updateDraftDeliveryAddress('fullName', event.target.value)}
                          disabled={!isSelectedOrderEditable}
                          placeholder="Full name"
                          className={`rounded-md px-2.5 py-1.5 text-xs outline-none transition ${
                            isSelectedOrderEditable
                              ? 'border border-slate-200 bg-slate-100 text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                              : 'cursor-not-allowed border border-slate-100 text-slate-500'
                          }`}
                        />
                        <input
                          type="text"
                          value={deliveryPhoneNumber}
                          onChange={(event) => updateDraftDeliveryAddress('phoneNumber', event.target.value)}
                          disabled={!isSelectedOrderEditable}
                          placeholder="Phone number"
                          className={`rounded-md px-2.5 py-1.5 text-xs outline-none transition ${
                            isSelectedOrderEditable
                              ? 'border border-slate-200 bg-slate-100 text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                            : 'cursor-not-allowed border border-slate-100 text-slate-500'
                          }`}
                        />
                      </div>
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(event) => updateDraftDeliveryAddress('address', event.target.value)}
                        disabled={!isSelectedOrderEditable}
                        placeholder="Full address"
                        className={`w-full rounded-md px-2.5 py-1.5 text-xs outline-none transition ${
                          isSelectedOrderEditable
                            ? 'border border-slate-200 bg-slate-100 text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                            : 'cursor-not-allowed border border-slate-100 text-slate-500'
                        }`}
                      />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                        <div className="relative" ref={geoPickerRef}>
                          <div
                            className={`group/geo relative flex items-center rounded-md border bg-white transition ${
                              isSelectedOrderEditable
                                ? hasMissingGeoParts
                                  ? 'border-rose-300 bg-rose-50/30 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-100'
                                  : 'border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100'
                                : 'border-slate-100 bg-slate-50'
                            }`}
                          >
                            <input
                              type="text"
                              value={showGeoPicker ? geoSearchTerm : deliveryAreaText}
                              onFocus={() => {
                                if (!isSelectedOrderEditable) return;
                                openGeoPicker();
                              }}
                              onClick={() => {
                                if (!isSelectedOrderEditable) return;
                                openGeoPicker();
                              }}
                              onChange={(event) => {
                                if (!isSelectedOrderEditable) return;
                                openGeoPicker();
                                setGeoSearchTerm(event.target.value);
                              }}
                              readOnly={!isSelectedOrderEditable || !showGeoPicker}
                              disabled={!isSelectedOrderEditable}
                              placeholder="Type to search"
                              className={`w-full rounded-md bg-transparent px-2.5 py-1.5 pr-14 text-xs outline-none ${
                                isSelectedOrderEditable
                                  ? hasMissingGeoParts && !showGeoPicker
                                    ? 'text-rose-700 placeholder:text-rose-400'
                                    : 'text-slate-900'
                                  : 'cursor-not-allowed text-slate-500'
                              }`}
                            />
                            {showGeoPicker ? (
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  clearGeoLocationSelection();
                                }}
                                className={`absolute right-8 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-white transition ${
                                  isSelectedOrderEditable
                                    ? 'opacity-0 group-hover/geo:opacity-100 group-focus-within/geo:opacity-100 hover:bg-slate-400'
                                    : 'hidden'
                                }`}
                                aria-label="Clear search"
                                title="Clear search"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            ) : null}
                            <Search
                              className={`pointer-events-none absolute right-8 h-3.5 w-3.5 text-slate-300 transition ${
                                showGeoPicker
                                  ? 'opacity-100 group-hover/geo:opacity-0 group-focus-within/geo:opacity-0'
                                  : 'opacity-100'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!isSelectedOrderEditable) return;
                                if (showGeoPicker) {
                                  setShowGeoPicker(false);
                                  setGeoSearchTerm('');
                                } else {
                                  openGeoPicker();
                                }
                              }}
                              disabled={!isSelectedOrderEditable}
                              className={`absolute right-1 inline-flex h-6 w-6 items-center justify-center rounded transition ${
                                isSelectedOrderEditable
                                  ? 'text-slate-500 hover:bg-slate-100'
                                  : 'cursor-not-allowed text-slate-300'
                              }`}
                            >
                              {showGeoPicker ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          </div>

                          {showGeoPicker && isSelectedOrderEditable ? (
                            <div className="absolute left-0 top-full z-40 mt-1 w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                              <div className="grid grid-cols-3 border-b border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveGeoTab('province');
                                    setGeoSearchTerm('');
                                  }}
                                  className={`overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2 text-center text-[13px] font-medium leading-tight ${
                                    activeGeoTab === 'province'
                                      ? 'border-b-2 border-indigo-500 text-indigo-700'
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  {selectedProvinceLabel}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!selectedProvinceId) return;
                                    setActiveGeoTab('district');
                                    setGeoSearchTerm('');
                                  }}
                                  disabled={!selectedProvinceId}
                                  className={`overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2 text-center text-[13px] font-medium leading-tight ${
                                    activeGeoTab === 'district'
                                      ? 'border-b-2 border-indigo-500 text-indigo-700'
                                      : 'text-slate-500 hover:text-slate-700'
                                  } ${!selectedProvinceId ? 'cursor-not-allowed opacity-40' : ''}`}
                                >
                                  {selectedDistrictLabel}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!selectedDistrictId) return;
                                    setActiveGeoTab('commune');
                                    setGeoSearchTerm('');
                                  }}
                                  disabled={!selectedDistrictId}
                                  className={`overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2 text-center text-[13px] font-medium leading-tight ${
                                    activeGeoTab === 'commune'
                                      ? 'border-b-2 border-indigo-500 text-indigo-700'
                                      : 'text-slate-500 hover:text-slate-700'
                                  } ${!selectedDistrictId ? 'cursor-not-allowed opacity-40' : ''}`}
                                >
                                  {selectedCommuneLabel}
                                </button>
                              </div>

                              <div className="max-h-52 overflow-auto p-1.5">
                                {activeGeoTab === 'province' ? (
                                  <>
                                    {isGeoProvincesLoading ? (
                                      <div className="px-2 py-1.5 text-xs text-slate-500">Loading province...</div>
                                    ) : filteredGeoProvinces.length === 0 ? (
                                      <div className="px-2 py-1.5 text-xs text-slate-500">No province found.</div>
                                    ) : (
                                      filteredGeoProvinces.map((entry) => {
                                        const selected = entry.id === selectedProvinceId;
                                        return (
                                          <button
                                            key={entry.id}
                                            type="button"
                                            onClick={() => handleProvinceChange(entry.id)}
                                            className={`mb-1 block w-full rounded-md px-2 py-1.5 text-left text-xs ${
                                              selected
                                                ? 'bg-blue-50 font-semibold text-blue-700'
                                                : 'text-slate-800 hover:bg-slate-50'
                                            }`}
                                          >
                                            {entry.name || entry.name_en || entry.id}
                                          </button>
                                        );
                                      })
                                    )}
                                  </>
                                ) : null}

                                {activeGeoTab === 'district' ? (
                                  <>
                                    {!selectedProvinceId ? (
                                      <div className="px-2 py-1.5 text-xs text-slate-500">Select province first.</div>
                                    ) : isGeoDistrictsLoading ? (
                                      <div className="px-2 py-1.5 text-xs text-slate-500">Loading city...</div>
                                    ) : filteredGeoDistricts.length === 0 ? (
                                      <div className="px-2 py-1.5 text-xs text-slate-500">No city found.</div>
                                    ) : (
                                      filteredGeoDistricts.map((entry) => {
                                        const selected = entry.id === selectedDistrictId;
                                        return (
                                          <button
                                            key={entry.id}
                                            type="button"
                                            onClick={() => handleDistrictChange(entry.id)}
                                            className={`mb-1 block w-full rounded-md px-2 py-1.5 text-left text-xs ${
                                              selected
                                                ? 'bg-blue-50 font-semibold text-blue-700'
                                                : 'text-slate-800 hover:bg-slate-50'
                                            }`}
                                          >
                                            {entry.name || entry.name_en || entry.id}
                                          </button>
                                        );
                                      })
                                    )}
                                  </>
                                ) : null}

                                {activeGeoTab === 'commune' ? (
                                  <>
                                    {!selectedDistrictId ? (
                                      <div className="px-2 py-1.5 text-xs text-slate-500">Select city first.</div>
                                    ) : isGeoCommunesLoading ? (
                                      <div className="px-2 py-1.5 text-xs text-slate-500">Loading barangay...</div>
                                    ) : filteredGeoCommunes.length === 0 ? (
                                      <div className="px-2 py-1.5 text-xs text-slate-500">No barangay found.</div>
                                    ) : (
                                      filteredGeoCommunes.map((entry) => {
                                        const selected = entry.id === selectedCommuneId;
                                        return (
                                          <button
                                            key={entry.id}
                                            type="button"
                                            onClick={() => handleCommuneChange(entry.id)}
                                            className={`mb-1 block w-full rounded-md px-2 py-1.5 text-left text-xs ${
                                              selected
                                                ? 'bg-blue-50 font-semibold text-blue-700'
                                                : 'text-slate-800 hover:bg-slate-50'
                                            }`}
                                          >
                                            {entry.name || entry.name_en || entry.id}
                                          </button>
                                        );
                                      })
                                    )}
                                  </>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <input
                          type="text"
                          value={effectiveDeliveryAddress.postCode}
                          onChange={(event) => updateDraftDeliveryAddress('postCode', event.target.value)}
                          disabled={!isSelectedOrderEditable}
                          placeholder="Postcode"
                          className={`rounded-md px-2.5 py-1.5 text-xs outline-none transition ${
                            isSelectedOrderEditable
                              ? 'border border-slate-200 bg-slate-100 text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                            : 'cursor-not-allowed border border-slate-100 text-slate-500'
                          }`}
                        />
                      </div>
                      {missingGeoMessage ? (
                        <p className="text-[11px] text-rose-600">{missingGeoMessage}</p>
                      ) : null}
                      {geoLookupError ? (
                        <p className="text-[11px] text-rose-600">{geoLookupError}</p>
                      ) : null}
                    </div>
                  </div>
                </section>
              </div>

            </div>
            </div>

            {/* ── STICKY FOOTER ── */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2 shadow-[0_-4px_12px_-4px_rgba(15,23,42,0.08)]">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: statusDisplayColor }}
                >
                  {statusDisplayLabel}
                </span>
                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold tabular-nums text-slate-700">
                  COD: {formatCurrency(selectedOrderForModal?.cod || 0)}
                </span>
                {statusSaveError ? (
                  <span className="text-xs text-rose-600">{statusSaveError}</span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={!isSelectedOrderEditable || !hasPendingChanges || isSavingStatus}
                className={`inline-flex min-w-[100px] items-center justify-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition ${
                  !isSelectedOrderEditable || !hasPendingChanges || isSavingStatus
                    ? 'cursor-not-allowed bg-slate-300'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                }`}
              >
                {isSavingStatus ? 'Saving...' : 'Save'}
              </button>
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
