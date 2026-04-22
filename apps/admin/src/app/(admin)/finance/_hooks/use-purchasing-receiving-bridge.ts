'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  createWmsReceivingBatch,
  fetchWmsReceivingOverview,
} from '../../receiving/_services/receiving.service';
import type { WmsReceivablePurchasingBatch } from '../../receiving/_types/receiving';
import type { WmsPurchasingBatchDetail } from '../_types/purchasing';

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;

    if (Array.isArray(payload?.message)) {
      return payload.message.join(' ');
    }

    if (typeof payload?.message === 'string') {
      return payload.message;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

export function usePurchasingReceivingBridge({
  batch,
  tenantId,
  onCreated,
  canPostReceiving,
}: {
  batch: WmsPurchasingBatchDetail | null;
  tenantId?: string;
  onCreated: (receivingBatchId: string) => void;
  canPostReceiving: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [stagingLocationId, setStagingLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lineQuantities, setLineQuantities] = useState<Record<string, number>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const receivableBatch = useMemo<WmsReceivablePurchasingBatch | null>(() => {
    if (!batch) {
      return null;
    }

    return {
      id: batch.id,
      sourceRequestId: batch.sourceRequestId,
      requestTitle: batch.requestTitle,
      requestType: batch.requestType,
      status: batch.status === 'RECEIVING' ? 'RECEIVING' : 'RECEIVING_READY',
      store: batch.store,
      lineCount: batch.lines.length,
      remainingQuantity: batch.lines.reduce((sum, line) => {
        const expectedQuantity = line.approvedQuantity ?? line.requestedQuantity;
        return sum + Math.max(expectedQuantity - line.receivedQuantity, 0);
      }, 0),
      readyForReceivingAt: batch.readyForReceivingAt,
      lines: batch.lines.map((line) => {
        const expectedQuantity = line.approvedQuantity ?? line.requestedQuantity;
        const remainingQuantity = Math.max(expectedQuantity - line.receivedQuantity, 0);

        return {
          id: line.id,
          lineNo: line.lineNo,
          requestedProductName: line.requestedProductName,
          productId: line.productId,
          variationId: line.variationId,
          expectedQuantity,
          receivedQuantity: line.receivedQuantity,
          remainingQuantity,
          resolvedPosProduct: line.resolvedPosProduct,
          resolvedProfile: line.resolvedProfile,
          notes: line.notes,
        };
      }),
    };
  }, [batch]);

  const canCreateReceiving = Boolean(
    canPostReceiving
    && receivableBatch
    && (batch?.status === 'RECEIVING_READY' || batch?.status === 'RECEIVING')
    && receivableBatch.remainingQuantity > 0,
  );

  const receivingOptionsQuery = useQuery({
    queryKey: ['wms-purchasing-receiving-options', tenantId ?? 'default-tenant'],
    queryFn: () => fetchWmsReceivingOverview({ tenantId }),
    enabled: open && canCreateReceiving,
  });

  useEffect(() => {
    if (!open || !receivableBatch) {
      return;
    }

    setNotes('');
    setSubmitError(null);
    setLineQuantities(
      Object.fromEntries(
        receivableBatch.lines.map((line) => [line.id, line.remainingQuantity]),
      ),
    );
  }, [open, receivableBatch]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstWarehouseId = receivingOptionsQuery.data?.warehouseOptions[0]?.id ?? '';
    setWarehouseId((current) => current || firstWarehouseId);
  }, [open, receivingOptionsQuery.data?.warehouseOptions]);

  const activeWarehouse = useMemo(
    () =>
      receivingOptionsQuery.data?.warehouseOptions.find((option) => option.id === warehouseId) ?? null,
    [receivingOptionsQuery.data?.warehouseOptions, warehouseId],
  );

  useEffect(() => {
    if (!activeWarehouse) {
      setStagingLocationId('');
      return;
    }

    if (
      stagingLocationId
      && !activeWarehouse.stagingLocations.some((location) => location.id === stagingLocationId)
    ) {
      setStagingLocationId('');
    }

    if (!stagingLocationId && activeWarehouse.stagingLocations.length > 0) {
      setStagingLocationId(activeWarehouse.stagingLocations[0].id);
    }
  }, [activeWarehouse, stagingLocationId]);

  const createBatchMutation = useMutation({
    mutationFn: async () => {
      if (!receivableBatch) {
        throw new Error('No purchasing batch is ready for receiving');
      }

      return createWmsReceivingBatch(
        {
          purchasingBatchId: receivableBatch.id,
          warehouseId,
          stagingLocationId,
          notes: notes.trim() || undefined,
          lines: receivableBatch.lines.map((line) => ({
            purchasingBatchLineId: line.id,
            receiveQuantity: Math.max(0, Math.floor(lineQuantities[line.id] ?? 0)),
          })),
        },
        tenantId,
      );
    },
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-purchasing-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-purchasing-batch'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-receiving-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-overview'] }),
      ]);

      setOpen(false);
      setWarehouseId('');
      setStagingLocationId('');
      setNotes('');
      setSubmitError(null);
      onCreated(response.batch.id);
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error));
    },
  });

  const totalUnits = useMemo(() => {
    if (!receivableBatch) {
      return 0;
    }

    return receivableBatch.lines.reduce(
      (sum, line) => sum + Math.max(0, Math.floor(lineQuantities[line.id] ?? 0)),
      0,
    );
  }, [lineQuantities, receivableBatch]);

  return {
    canCreateReceiving,
    receivableBatch,
    receivingModal: {
      isOpen: open,
      warehouseOptions: receivingOptionsQuery.data?.warehouseOptions ?? [],
      warehouseId,
      stagingLocationId,
      notes,
      lineQuantities,
      totalUnits,
      isLoadingOptions: receivingOptionsQuery.isLoading || receivingOptionsQuery.isFetching,
      isSubmitting: createBatchMutation.isPending,
      errorMessage: submitError,
      openModal: () => {
        if (!canCreateReceiving) {
          return;
        }
        setOpen(true);
      },
      close: () => {
        setOpen(false);
        setSubmitError(null);
      },
      setWarehouseId,
      setStagingLocationId,
      setNotes,
      setLineQuantity: (lineId: string, quantity: number) => {
        setLineQuantities((current) => ({
          ...current,
          [lineId]: Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0,
        }));
      },
      submit: async () => {
        setSubmitError(null);
        await createBatchMutation.mutateAsync();
      },
    },
  };
}
