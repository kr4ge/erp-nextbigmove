import { useCallback, useState } from 'react';
import type { DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { lookupMobilePickingBasket } from '@/src/features/picking/services/picking-api';
import {
  fetchMobileStockBatch,
  fetchMobileStockBin,
  fetchMobileStockUnit,
  lookupMobileTrackingOrder,
  scanMobileStockCode,
} from '@/src/features/stock/services/stock-api';
import { ApiError } from '@/src/shared/services/http';
import type { UniversalScanFilters, UniversalScanResult } from '../types';
import { normalizeScannedCode } from '@/src/features/stock/hooks/use-stock-execution';

type UseUniversalScanParams = {
  device: DeviceIdentity | null;
  filters: UniversalScanFilters;
  session: StoredSession;
};

export function useUniversalScan({
  device,
  filters,
  session,
}: UseUniversalScanParams) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<UniversalScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const scan = useCallback(async (nextCode?: string) => {
    const normalized = normalizeScannedCode(nextCode ?? code);

    if (!device) {
      setError('Device is not ready.');
      return;
    }

    if (!normalized) {
      setError('Scan or enter a code.');
      return;
    }

    setIsScanning(true);
    setError(null);
    setMessage(null);

    try {
      const stockResult = await scanMobileStockCode({
        accessToken: session.accessToken,
        device,
        code: normalized,
        tenantId: filters.tenantId,
      });

      if (stockResult.found) {
        if (stockResult.type === 'unit') {
          const detail = await fetchMobileStockUnit({
            accessToken: session.accessToken,
            device,
            unitId: stockResult.unit.id,
            tenantId: filters.tenantId ?? stockResult.unit.tenantId,
          });
          setResult({
            kind: 'unit',
            unit: detail.unit,
            task: detail.task,
          });
        } else if (stockResult.type === 'batch') {
          const detail = await fetchMobileStockBatch({
            accessToken: session.accessToken,
            device,
            batchId: stockResult.batch.id,
            tenantId: filters.tenantId ?? stockResult.batch.tenantId,
          });
          setResult({
            kind: 'batch',
            batch: detail.batch,
          });
        } else {
          const detail = await fetchMobileStockBin({
            accessToken: session.accessToken,
            device,
            binId: stockResult.bin.id,
            tenantId: filters.tenantId,
          });
          setResult({
            kind: 'bin',
            bin: detail.bin,
          });
        }

        setCode('');
        return;
      }

      const basketResult = await lookupMobilePickingBasket({
        accessToken: session.accessToken,
        device,
        tenantId: filters.tenantId,
        code: normalized,
      });

      if (basketResult.found && basketResult.basket) {
        setResult({
          kind: 'basket',
          basket: basketResult.basket,
        });
        setCode('');
        return;
      }

      const trackingResult = await lookupMobileTrackingOrder({
        accessToken: session.accessToken,
        device,
        tenantId: filters.tenantId,
        code: normalized,
      });

      if (trackingResult.found && trackingResult.task) {
        setResult({
          kind: 'tracking',
          task: trackingResult.task,
        });
        setCode('');
        return;
      }

      setResult(null);
      setError(`No stock, basket, or waybill matched ${normalized}.`);
    } catch (requestError) {
      setError(resolveScanError(requestError));
      setResult(null);
    } finally {
      setIsScanning(false);
    }
  }, [code, device, filters.tenantId, session.accessToken]);

  const reset = useCallback(() => {
    setCode('');
    setResult(null);
    setError(null);
    setMessage(null);
  }, []);

  return {
    code,
    error,
    isScanning,
    message,
    result,
    reset,
    scan,
    setCode: (value: string) => setCode(normalizeScannedCode(value)),
  };
}

function resolveScanError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Scan failed.';
}
