import * as SecureStore from 'expo-secure-store';
import type { WmsMobileStockResponse, WmsMobileStockUnitDetail } from '../types';

const STOCK_CACHE_PREFIX = 'stox.stock.cache';
const STOCK_QUEUE_PREFIX = 'stox.stock.queue';
const MAX_QUEUED_ACTIONS = 50;

export type QueuedStockActionType = 'putaway' | 'move';

export type QueuedStockAction = {
  id: string;
  action: QueuedStockActionType;
  unitId: string;
  unitCode: string;
  targetCode: string;
  tenantId: string | null;
  expectedStatus: string;
  expectedCurrentLocationId: string | null;
  expectedUpdatedAt: string;
  createdAt: string;
  attempts: number;
  lastError?: string | null;
};

type CachedStockPayload = {
  cachedAt: string;
  stock: WmsMobileStockResponse;
};

type StockCacheKeyParams = {
  userId: string;
  tenantId: string | null;
  storeId: string | null;
  warehouseId: string | null;
  mode: string;
};

export function createQueuedStockAction(params: {
  action: QueuedStockActionType;
  targetCode: string;
  tenantId: string | null;
  unit: WmsMobileStockUnitDetail;
}) {
  return {
    id: generateStockActionId(),
    action: params.action,
    unitId: params.unit.id,
    unitCode: params.unit.code,
    targetCode: params.targetCode,
    tenantId: params.tenantId ?? params.unit.tenantId,
    expectedStatus: params.unit.status,
    expectedCurrentLocationId: params.unit.currentLocation?.id ?? null,
    expectedUpdatedAt: params.unit.updatedAt,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  } satisfies QueuedStockAction;
}

export async function readCachedStock(params: StockCacheKeyParams) {
  const raw = await SecureStore.getItemAsync(buildStockCacheKey(params));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CachedStockPayload;
  } catch {
    return null;
  }
}

export async function writeCachedStock(params: StockCacheKeyParams, stock: WmsMobileStockResponse) {
  try {
    await SecureStore.setItemAsync(
      buildStockCacheKey(params),
      JSON.stringify({
        cachedAt: new Date().toISOString(),
        stock,
      } satisfies CachedStockPayload),
    );
  } catch {
    // Cache is a convenience layer. Failed cache writes must never block stock work.
  }
}

export async function readQueuedStockActions(userId: string) {
  const raw = await SecureStore.getItemAsync(buildStockQueueKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as QueuedStockAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeQueuedStockActions(userId: string, actions: QueuedStockAction[]) {
  await SecureStore.setItemAsync(
    buildStockQueueKey(userId),
    JSON.stringify(actions.slice(0, MAX_QUEUED_ACTIONS)),
  );
}

export async function appendQueuedStockAction(userId: string, action: QueuedStockAction) {
  const current = await readQueuedStockActions(userId);
  const deduped = current.filter((queued) => queued.id !== action.id);
  const next = [action, ...deduped].slice(0, MAX_QUEUED_ACTIONS);
  await writeQueuedStockActions(userId, next);
  return next;
}

export async function removeQueuedStockAction(userId: string, actionId: string) {
  const current = await readQueuedStockActions(userId);
  const next = current.filter((action) => action.id !== actionId);
  await writeQueuedStockActions(userId, next);
  return next;
}

export async function updateQueuedStockAction(userId: string, action: QueuedStockAction) {
  const current = await readQueuedStockActions(userId);
  const next = current.map((queued) => (queued.id === action.id ? action : queued));
  await writeQueuedStockActions(userId, next);
  return next;
}

function buildStockCacheKey(params: StockCacheKeyParams) {
  return [
    STOCK_CACHE_PREFIX,
    params.userId,
    params.mode,
    params.tenantId ?? 'all-tenants',
    params.storeId ?? 'all-stores',
    params.warehouseId ?? 'all-warehouses',
  ].join('.');
}

function buildStockQueueKey(userId: string) {
  return `${STOCK_QUEUE_PREFIX}.${userId}`;
}

function generateStockActionId() {
  return `stock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
