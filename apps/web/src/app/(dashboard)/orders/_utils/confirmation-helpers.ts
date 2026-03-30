import { TIMEZONE } from './constants';
import type {
  ConfirmationOrderRow,
  ConfirmationOrderTagDetail,
  ConfirmationResponseItemRaw,
  ParsedDeliveryAddress,
  ParsedOrderSnapshot,
  ParsedSnapshotItem,
} from '../_types/confirmation';

export const formatDateInTimezone = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

export const parseYmdToLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

export const toSafeDate = (value: Date | string | null | undefined): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return parseYmdToLocalDate(value);
  }
  return new Date();
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export const normalizeLineBreaks = (value: string) => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
export const toApiLineBreaks = (value: string) =>
  normalizeLineBreaks(value).replace(/\n/g, '\r\n');

export const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

export const hasNonEmptyText = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0;

export const composeDeliveryFullAddress = (value: Pick<
  ParsedDeliveryAddress,
  'address' | 'communeName' | 'districtName' | 'provinceName'
>): string => {
  const street = value.address.trim();
  const area = [value.communeName, value.districtName, value.provinceName]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .join(', ');

  if (street && area) return `${street}, ${area}`;
  return street || area;
};

export const toCount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

export const toAmount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

export const parseNumericDraftInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalized = trimmed.replace(/,/g, '');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

export const resolveNumericDraftForUi = (draftValue: string | null, fallbackValue: number): number => {
  if (draftValue === null) return fallbackValue;
  const parsed = parseNumericDraftInput(draftValue);
  if (parsed === null) return fallbackValue;
  return parsed;
};

export const hasNumericDraftChanged = (draftValue: string | null, fallbackValue: number): boolean => {
  if (draftValue === null) return false;
  const parsed = parseNumericDraftInput(draftValue);
  if (parsed === null) return false;
  return Math.abs(parsed - fallbackValue) > 0.0001;
};

export const buildBankPaymentsPayloadFromTransferAmount = (
  currentRaw: unknown,
  transferAmount: number,
): unknown => {
  if (currentRaw && typeof currentRaw === 'object' && !Array.isArray(currentRaw)) {
    const next = { ...(currentRaw as Record<string, unknown>) };
    const hasSnake = Object.prototype.hasOwnProperty.call(next, 'bank_transfer');
    const hasCamel = Object.prototype.hasOwnProperty.call(next, 'bankTransfer');
    if (hasSnake || hasCamel) {
      if (hasSnake) next.bank_transfer = transferAmount;
      if (hasCamel) next.bankTransfer = transferAmount;
      return next;
    }
    const numericKeys = Object.keys(next).filter((key) => {
      const entry = next[key];
      if (typeof entry === 'number') return Number.isFinite(entry);
      if (typeof entry === 'string') {
        const parsed = Number.parseFloat(entry);
        return Number.isFinite(parsed);
      }
      return false;
    });
    if (numericKeys.length === 1) {
      next[numericKeys[0]] = transferAmount;
      return next;
    }
    return {
      ...next,
      bank_transfer: transferAmount,
    };
  }

  return { bank_transfer: transferAmount };
};

export const sumNumericValuesDeep = (value: unknown, depth = 0): number => {
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

export const toBooleanFlag = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
};

export const extractDuplicateFlagsFromSnapshot = (
  snapshotValue: unknown,
): { duplicatedPhone: boolean; duplicatedIp: boolean } => {
  const snapshot = toRecord(snapshotValue);
  return {
    duplicatedPhone: toBooleanFlag(snapshot?.duplicated_phone ?? snapshot?.duplicatedPhone),
    duplicatedIp: toBooleanFlag(snapshot?.duplicated_ip ?? snapshot?.duplicatedIp),
  };
};

export const parseSnapshotItems = (value: unknown): ParsedSnapshotItem[] => {
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
        variationId: toText(item.variation_id || item.variationId || variation?.id || item.id),
        warehouseId: toText(
          item.warehouse_id || item.warehouseId || variation?.warehouse_id || variation?.warehouseId,
        ),
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

export const removeIdFromAddressPayload = (value: Record<string, unknown> | null): Record<string, unknown> => {
  if (!value) return {};
  const next = { ...value };
  delete (next as { id?: unknown }).id;
  return next;
};

export const parseDeliveryAddress = (value: Record<string, unknown> | null): ParsedDeliveryAddress => {
  const address = value || {};
  const payloadWithoutId = removeIdFromAddressPayload(value);

  return {
    id: toText(address.id),
    fullName: toText(address.full_name || address.fullName),
    phoneNumber: toText(address.phone_number || address.phoneNumber),
    address: toText(address.address),
    fullAddress: toText(address.full_address || address.fullAddress),
    communeName: toText(address.commune_name || address.commnue_name || address.communeName),
    districtName: toText(address.district_name || address.districtName),
    provinceName: toText(address.province_name || address.provinceName),
    communeId: toText(address.commune_id || address.communeId),
    districtId: toText(address.district_id || address.districtId),
    provinceId: toText(address.province_id || address.provinceId),
    countryCode: toText(address.country_code || address.countryCode),
    postCode: toText(address.post_code || address.postCode),
    payloadWithoutId,
  };
};

export const parseCustomerShopAddresses = (value: unknown): ParsedDeliveryAddress[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => parseDeliveryAddress(toRecord(entry)))
    .filter((entry) => {
      return (
        hasNonEmptyText(entry.fullAddress) ||
        hasNonEmptyText(entry.address) ||
        hasNonEmptyText(entry.phoneNumber) ||
        hasNonEmptyText(entry.fullName)
      );
    });
};

export const cloneDeliveryAddress = (value: ParsedDeliveryAddress): ParsedDeliveryAddress => ({
  ...value,
  payloadWithoutId: { ...(value.payloadWithoutId || {}) },
});

export const toNullableShippingText = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const toNullableShippingCountryCode = (value: string): number | string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : trimmed;
};

export const buildShippingAddressPayload = (value: ParsedDeliveryAddress): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    ...(value.payloadWithoutId || {}),
    full_name: toNullableShippingText(value.fullName),
    phone_number: toNullableShippingText(value.phoneNumber),
    address: toNullableShippingText(value.address),
    full_address: toNullableShippingText(value.fullAddress),
    commune_name: toNullableShippingText(value.communeName),
    district_name: toNullableShippingText(value.districtName),
    province_name: toNullableShippingText(value.provinceName),
    commune_id: toNullableShippingText(value.communeId),
    district_id: toNullableShippingText(value.districtId),
    province_id: toNullableShippingText(value.provinceId),
    country_code: toNullableShippingCountryCode(value.countryCode),
    post_code: toNullableShippingText(value.postCode),
  };
  delete (payload as { id?: unknown }).id;
  return payload;
};

export const toComparableShippingAddress = (value: ParsedDeliveryAddress): Record<string, string> => ({
  full_name: value.fullName,
  phone_number: value.phoneNumber,
  address: value.address,
  full_address: value.fullAddress,
  commune_name: value.communeName,
  district_name: value.districtName,
  province_name: value.provinceName,
  commune_id: value.communeId,
  district_id: value.districtId,
  province_id: value.provinceId,
  country_code: value.countryCode,
  post_code: value.postCode,
});

export const parseOrderSnapshot = (value: unknown): ParsedOrderSnapshot => {
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
    warehouseId: toText(snapshot?.warehouse_id || snapshot?.warehouseId),
    items: parseSnapshotItems(snapshot?.items),
    customer: {
      name: toText(customerRaw?.name),
      phone: toText(customerRaw?.phone_number) || phoneFromList,
      email: Array.isArray(customerRaw?.emails) ? toText(customerRaw?.emails[0]) : '',
      dateOfBirth: toText(customerRaw?.date_of_birth),
      gender: toText(customerRaw?.gender),
      conversationLink: toText(customerRaw?.conversation_link || customerRaw?.conversationLink),
      shopCustomerAddresses: parseCustomerShopAddresses(customerRaw?.shop_customer_addresses),
      succeedOrderCount: toCount(customerRaw?.succeed_order_count),
      orderCount: toCount(customerRaw?.order_count),
    },
    shippingAddress: parseDeliveryAddress(shippingRaw),
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

export const getHistoryProductSummary = (row: Pick<ConfirmationOrderRow, 'order_snapshot' | 'item_data'>): string => {
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
      .filter((entry) => entry.trim().length > 0);

    if (fallbackProducts.length > 0) {
      return fallbackProducts.join(', ');
    }
  }

  return '—';
};

export const hasRowProductItems = (row: Pick<ConfirmationOrderRow, 'order_snapshot' | 'item_data'>): boolean => {
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

export const normalizeItemsForUpdatePayload = (
  items: ParsedSnapshotItem[],
): Array<{ variation_id: string; quantity: number }> => {
  const map = new Map<string, { variation_id: string; quantity: number }>();
  for (const item of items) {
    const variationId = (item.variationId || item.id || '').trim();
    if (!variationId) continue;
    const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 1;
    map.set(variationId, { variation_id: variationId, quantity });
  }
  return Array.from(map.values());
};

export const normalizeTagNameKey = (value: string): string => value.trim().toLowerCase();

export const normalizeTagDetails = (
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

export const normalizeConfirmationRows = (
  items: ConfirmationResponseItemRaw[],
): ConfirmationOrderRow[] => {
  return items.map((item) => {
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
};

export const parseApiErrorMessage = (
  err: unknown,
  fallback: string,
): string => {
  return (
    (typeof err === 'object' &&
      err !== null &&
      'response' in err &&
      typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === 'string' &&
      (err as { response?: { data?: { message?: string } } }).response?.data?.message) ||
    (err instanceof Error ? err.message : null) ||
    fallback
  );
};
