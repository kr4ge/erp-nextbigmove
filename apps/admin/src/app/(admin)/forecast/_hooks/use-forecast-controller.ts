'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchWmsForecasting, generateWmsForecasting } from '../_services/forecast.service';
import type {
  WmsForecastStoreOption,
  WmsForecastTenantOption,
  WmsForecastingResponse,
} from '../_types/forecast';
import {
  getTodayDateValue,
  getDefaultCycleDate,
  getForecastCycleSnapshots,
  isForecastCycleDate,
} from '../_utils/forecast-formatters';

type ForecastOptionMaps = {
  stores: Map<string, WmsForecastStoreOption>;
};

const DEFAULT_SAFETY_STOCK_PCT = 20;
const DEFAULT_REORDER_TRIGGER_DAYS = 4;
const DEFAULT_PAST_SALES_WINDOW_DAYS = 3;

function getDefaultCustomForecastRange() {
  const startDate = getTodayDateValue();
  const end = new Date(`${startDate}T00:00:00`);
  end.setDate(end.getDate() + 6);
  const endDate = [
    end.getFullYear(),
    String(end.getMonth() + 1).padStart(2, '0'),
    String(end.getDate()).padStart(2, '0'),
  ].join('-');

  return { startDate, endDate };
}

export function useForecastController() {
  const requestIdRef = useRef(0);
  const [data, setData] = useState<WmsForecastingResponse | null>(null);
  const [optionMaps, setOptionMaps] = useState<ForecastOptionMaps>(() => ({
    stores: new Map(),
  }));
  const [selectedTenantId, setSelectedTenantId] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    return localStorage.getItem('current_tenant_id') ?? undefined;
  });
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'CYCLE' | 'CUSTOM'>('CYCLE');
  const [cycleDate, setCycleDate] = useState(getDefaultCycleDate);
  const [customForecastRange, setCustomForecastRange] = useState(getDefaultCustomForecastRange);
  const [safetyStockPct, setSafetyStockPct] = useState(DEFAULT_SAFETY_STOCK_PCT);
  const [reorderTriggerDays, setReorderTriggerDays] = useState(DEFAULT_REORDER_TRIGGER_DAYS);
  const [pastSalesWindowDays, setPastSalesWindowDays] = useState(DEFAULT_PAST_SALES_WINDOW_DAYS);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cycleSnapshots = useMemo(() => getForecastCycleSnapshots(2), []);

  const storeOptions = useMemo(() => {
    const stores = Array.from(optionMaps.stores.values());
    return stores
      .filter((store) => !selectedTenantId || store.tenantId === selectedTenantId)
      .sort((left, right) => {
        const tenantCompare = left.tenantName.localeCompare(right.tenantName);
        if (tenantCompare !== 0) {
          return tenantCompare;
        }

        return left.name.localeCompare(right.name);
      });
  }, [optionMaps.stores, selectedTenantId]);

  const tenantOptions = useMemo<WmsForecastTenantOption[]>(() => {
    const tenants = new Map<string, WmsForecastTenantOption>();

    for (const store of optionMaps.stores.values()) {
      if (!tenants.has(store.tenantId)) {
        tenants.set(store.tenantId, {
          id: store.tenantId,
          name: store.tenantName,
          slug: store.tenantSlug,
        });
      }
    }

    if (data?.context.activeTenantId && data.context.activeTenantName) {
      tenants.set(data.context.activeTenantId, {
        id: data.context.activeTenantId,
        name: data.context.activeTenantName,
        slug: null,
      });
    }

    return Array.from(tenants.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [data?.context.activeTenantId, data?.context.activeTenantName, optionMaps.stores]);

  const refresh = useCallback(async () => {
    if (mode === 'CYCLE' && !isForecastCycleDate(cycleDate)) {
      setError('Cycle date must be Monday, Wednesday, or Friday.');
      setIsLoading(false);
      return;
    }

    if (mode === 'CUSTOM' && customForecastRange.endDate < customForecastRange.startDate) {
      setError('Forecast end date must be on or after the forecast start date.');
      setIsLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWmsForecasting({
        tenantId: selectedTenantId,
        storeIds: selectedStoreIds,
        mode,
        cycleDate: mode === 'CUSTOM' ? getTodayDateValue() : cycleDate,
        forecastStartDate: mode === 'CUSTOM' ? customForecastRange.startDate : undefined,
        forecastEndDate: mode === 'CUSTOM' ? customForecastRange.endDate : undefined,
        pastSalesWindowDays,
        safetyStockPct,
        reorderTriggerDays,
      });

      if (requestIdRef.current !== requestId) {
        return;
      }

      setData(response);
      setOptionMaps((current) => {
        const nextStores = new Map(current.stores);
        for (const store of response.context.stores) {
          nextStores.set(store.id, store);
        }

        return {
          stores: nextStores,
        };
      });
      setSelectedStoreIds((current) => {
        const next = current.filter((storeId) => (
          response.context.stores.some((store) => store.id === storeId)
        ));

        if (next.length === current.length && next.every((storeId, index) => storeId === current[index])) {
          return current;
        }

        return next;
      });
    } catch (fetchError) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setError(resolveErrorMessage(fetchError));
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [
    cycleDate,
    customForecastRange.endDate,
    customForecastRange.startDate,
    mode,
    pastSalesWindowDays,
    reorderTriggerDays,
    safetyStockPct,
    selectedStoreIds,
    selectedTenantId,
  ]);

  const generateSnapshot = useCallback(async () => {
    if (mode === 'CYCLE' && !isForecastCycleDate(cycleDate)) {
      setError('Cycle date must be Monday, Wednesday, or Friday.');
      return;
    }

    if (mode === 'CUSTOM' && customForecastRange.endDate < customForecastRange.startDate) {
      setError('Forecast end date must be on or after the forecast start date.');
      return;
    }

    if (selectedStoreIds.length === 0) {
      setError('Select at least one store before generating a forecast snapshot.');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateWmsForecasting({
        tenantId: selectedTenantId,
        storeIds: selectedStoreIds,
        mode,
        cycleDate: mode === 'CUSTOM' ? getTodayDateValue() : cycleDate,
        forecastStartDate: mode === 'CUSTOM' ? customForecastRange.startDate : undefined,
        forecastEndDate: mode === 'CUSTOM' ? customForecastRange.endDate : undefined,
        pastSalesWindowDays,
        safetyStockPct,
        reorderTriggerDays,
      });

      if (requestIdRef.current !== requestId) {
        return;
      }

      setData(response);
      setOptionMaps((current) => {
        const nextStores = new Map(current.stores);
        for (const store of response.context.stores) {
          nextStores.set(store.id, store);
        }

        return {
          stores: nextStores,
        };
      });
    } catch (generateError) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setError(resolveErrorMessage(generateError));
    } finally {
      if (requestIdRef.current === requestId) {
        setIsGenerating(false);
      }
    }
  }, [
    cycleDate,
    customForecastRange.endDate,
    customForecastRange.startDate,
    mode,
    pastSalesWindowDays,
    reorderTriggerDays,
    safetyStockPct,
    selectedStoreIds,
    selectedTenantId,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const changeTenant = useCallback((tenantId: string | undefined) => {
    setSelectedTenantId(tenantId);
    setSelectedStoreIds([]);

    if (typeof window === 'undefined') {
      return;
    }

    if (tenantId) {
      localStorage.setItem('current_tenant_id', tenantId);
    } else {
      localStorage.removeItem('current_tenant_id');
    }

    window.dispatchEvent(new Event('wmsTenantScopeChanged'));
  }, []);

  const toggleStore = useCallback((storeId: string) => {
    setSelectedStoreIds((current) => (
      current.includes(storeId)
        ? current.filter((id) => id !== storeId)
        : [...current, storeId]
    ));
  }, []);

  const clearStores = useCallback(() => {
    setSelectedStoreIds([]);
  }, []);

  return {
    data,
    error,
    isLoading,
    isGenerating,
    selectedTenantId,
    selectedStoreIds,
    mode,
    cycleDate,
    customForecastRange,
    cycleSnapshots,
    safetyStockPct,
    reorderTriggerDays,
    pastSalesWindowDays,
    tenantOptions,
    storeOptions,
    changeTenant,
    toggleStore,
    clearStores,
    setMode,
    setCycleDate,
    setCustomForecastRange,
    setSafetyStockPct,
    setReorderTriggerDays,
    setPastSalesWindowDays,
    refresh,
    generateSnapshot,
  };
}

function resolveErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as {
      response?: {
        data?: {
          message?: string | string[];
        };
      };
    }).response;
    const message = response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (message) {
      return message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to load the forecast report.';
}
