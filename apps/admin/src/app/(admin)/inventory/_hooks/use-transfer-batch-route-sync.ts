'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { WmsReceivingBatchRow } from '../../receiving/_types/receiving';

type UseTransferBatchRouteSyncInput = {
  transferBatches: WmsReceivingBatchRow[];
  selectedBatchId: string | null;
  onSelectBatch: (batch: WmsReceivingBatchRow) => void;
};

export function useTransferBatchRouteSync({
  transferBatches,
  selectedBatchId,
  onSelectBatch,
}: UseTransferBatchRouteSyncInput) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedBatchId = searchParams.get('batch');
  const searchParamsKey = searchParams.toString();
  const handledBatchParamRef = useRef<string | null>(null);
  const isTransferRoute = pathname === '/inventory/transfer';

  useEffect(() => {
    if (!isTransferRoute) {
      return;
    }

    if (requestedBatchId) {
      const requestedBatch = transferBatches.find((batch) => batch.id === requestedBatchId);

      if (!requestedBatch || handledBatchParamRef.current === requestedBatchId) {
        return;
      }

      handledBatchParamRef.current = requestedBatchId;
      onSelectBatch(requestedBatch);

      const nextParams = new URLSearchParams(searchParamsKey);
      nextParams.delete('batch');
      const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
      window.history.replaceState(window.history.state, '', nextUrl);
      return;
    }

    handledBatchParamRef.current = null;

    if (!selectedBatchId && transferBatches[0]) {
      onSelectBatch(transferBatches[0]);
    }
  }, [
    isTransferRoute,
    onSelectBatch,
    pathname,
    requestedBatchId,
    searchParamsKey,
    selectedBatchId,
    transferBatches,
  ]);
}
