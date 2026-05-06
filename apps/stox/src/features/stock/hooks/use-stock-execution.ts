import { useCallback, useState } from 'react';
import type { DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { ApiError } from '@/src/shared/services/http';
import {
  moveMobileStockUnit,
  putawayMobileStockUnit,
  scanMobileStockCode,
} from '../services/stock-api';
import { createQueuedStockAction, type QueuedStockAction } from '../services/stock-offline-store';
import type {
  StockFilters,
  WmsMobileStockScanResult,
  WmsMobileStockUnitDetail,
} from '../types';

export type StockScanTarget = 'lookup' | 'target';

type UseStockExecutionParams = {
  device: DeviceIdentity | null;
  filters: StockFilters;
  session: StoredSession;
  onExecuted: () => Promise<void>;
  onQueued: (action: QueuedStockAction) => Promise<void>;
};

export function useStockExecution({
  device,
  filters,
  session,
  onExecuted,
  onQueued,
}: UseStockExecutionParams) {
  const [scanCode, setScanCode] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [scanTarget, setScanTarget] = useState<StockScanTarget>('lookup');
  const [result, setResult] = useState<WmsMobileStockScanResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateScanCode = useCallback((value: string) => {
    setScanCode(normalizeScannedCode(value));
  }, []);

  const updateTargetCode = useCallback((value: string) => {
    setTargetCode(normalizeScannedCode(value));
  }, []);

  const scan = useCallback(async (nextCode?: string) => {
    const code = normalizeScannedCode(nextCode ?? scanCode);

    if (!device) {
      setError('Device is not ready.');
      return;
    }

    if (!code) {
      setError('Scan or enter a code.');
      return;
    }

    setIsScanning(true);
    setError(null);
    setMessage(null);

    try {
      const nextResult = await scanMobileStockCode({
        accessToken: session.accessToken,
        device,
        code,
        tenantId: filters.tenantId,
      });

      setResult(nextResult);
      setScanCode('');
      setTargetCode('');

      if (!nextResult.found) {
        setError(`No stock record found for ${code}.`);
        setScanTarget('lookup');
        return;
      }

      if (nextResult.type === 'unit') {
        setScanTarget('target');
        return;
      }

      setScanTarget('lookup');
    } catch (requestError) {
      setError(resolveExecutionError(requestError));
    } finally {
      setIsScanning(false);
    }
  }, [device, filters.tenantId, scanCode, session.accessToken]);

  const scanRelatedUnit = useCallback(async (code: string) => {
    setScanTarget('lookup');
    setScanCode('');
    setTargetCode('');
    await scan(code);
  }, [scan]);

  const resetLookup = useCallback(() => {
    setScanTarget('lookup');
    setScanCode('');
    setTargetCode('');
    setResult(null);
    setError(null);
    setMessage(null);
  }, []);

  const executeUnitAction = useCallback(async (action: 'putaway' | 'move') => {
    if (!device) {
      setError('Device is not ready.');
      return;
    }

    if (!result?.found || result.type !== 'unit') {
      setError('Scan a unit first.');
      return;
    }

    const target = targetCode.trim();
    if (!target) {
      setError('Scan or enter a target bin/location.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const request = {
        accessToken: session.accessToken,
        device,
        tenantId: filters.tenantId ?? result.unit.tenantId,
        unitId: result.unit.id,
        targetCode: target,
        clientRequestId: createClientRequestId(),
        expectedStatus: result.unit.status,
        expectedCurrentLocationId: result.unit.currentLocation?.id ?? null,
        expectedUpdatedAt: result.unit.updatedAt,
      };

      const response = action === 'putaway'
        ? await putawayMobileStockUnit(request)
        : await moveMobileStockUnit(request);

      setResult({
        found: true,
        type: 'unit',
        unit: response.unit,
      });
      setTargetCode('');
      setScanCode('');
      setScanTarget('lookup');
      setMessage(action === 'putaway' ? 'Putaway confirmed.' : 'Move confirmed.');
      await onExecuted();
    } catch (requestError) {
      if (isNetworkRequestError(requestError)) {
        await onQueued(createQueuedStockAction({
          action,
          targetCode: target,
          tenantId: filters.tenantId ?? result.unit.tenantId,
          unit: result.unit,
        }));
        setTargetCode('');
        setScanCode('');
        setScanTarget('lookup');
        setMessage('Saved offline. Sync before relying on this stock change.');
        return;
      }

      setError(resolveExecutionError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }, [device, filters.tenantId, onExecuted, onQueued, result, session.accessToken, targetCode]);

  const activeUnit: WmsMobileStockUnitDetail | null =
    result?.found && result.type === 'unit' ? result.unit : null;

  return {
    activeUnit,
    error,
    isScanning,
    isSubmitting,
    message,
    result,
    resetLookup,
    scan,
    scanCode,
    scanTarget,
    scanRelatedUnit,
    setScanCode: updateScanCode,
    setScanTarget,
    setTargetCode: updateTargetCode,
    targetCode,
    executeMove: () => executeUnitAction('move'),
    executePutaway: () => executeUnitAction('putaway'),
  };
}

export function normalizeScannedCode(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveExecutionError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Stock action failed.';
}

function isNetworkRequestError(error: unknown) {
  return !(error instanceof ApiError);
}

function createClientRequestId() {
  return `stock-online-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
