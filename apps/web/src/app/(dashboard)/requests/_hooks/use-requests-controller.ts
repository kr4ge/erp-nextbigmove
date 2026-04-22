'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useToast } from '@/components/ui/toast';
import {
  createWmsPurchasingBatch,
  fetchWmsPurchasingBatch,
  fetchWmsPurchasingOverview,
  fetchWmsPurchasingProductOptions,
  respondWmsPurchasingRevision,
  submitWmsPurchasingPaymentProof,
} from '../_services/requests.service';
import type {
  CreateWmsPurchasingBatchInput,
  RespondWmsPurchasingRevisionInput,
  SubmitWmsPurchasingPaymentProofInput,
  WmsPurchasingBatchDetail,
  WmsPurchasingBatchStatus,
  WmsPurchasingOverviewResponse,
  WmsPurchasingProductOption,
  WmsPurchasingProductOptionsResponse,
  WmsPurchasingRequestType,
} from '../_types/request';
import { parseRequestError } from '../_utils/request-errors';

type CartLine = {
  id: string;
  product: WmsPurchasingProductOption;
  quantity: number;
};

function getSourceRequestId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ERP-${stamp}-${suffix}`;
}

function getUnitAmount(product: WmsPurchasingProductOption, requestType: WmsPurchasingRequestType) {
  if (requestType === 'PROCUREMENT') {
    return product.inhouseUnitCost ?? 0;
  }
  return product.inhouseUnitCost ?? 0;
}

export function useRequestsController() {
  const { addToast } = useToast();

  const [overview, setOverview] = useState<WmsPurchasingOverviewResponse | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [createStoreScopeId, setCreateStoreScopeIdState] = useState('');
  const [createRequestType, setCreateRequestType] = useState<WmsPurchasingRequestType>('PROCUREMENT');
  const [createPartnerNotes, setCreatePartnerNotes] = useState('');
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedRequestType, setSelectedRequestType] = useState<WmsPurchasingRequestType | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<WmsPurchasingBatchStatus | ''>('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [overviewPage, setOverviewPage] = useState(1);

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<WmsPurchasingBatchDetail | null>(null);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isSubmittingPaymentProof, setIsSubmittingPaymentProof] = useState(false);
  const [isRespondingToRevision, setIsRespondingToRevision] = useState(false);

  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productSearchText, setProductSearchText] = useState('');
  const deferredProductSearch = useDeferredValue(productSearchText.trim());
  const [productOptions, setProductOptions] = useState<WmsPurchasingProductOptionsResponse | null>(null);
  const [isLoadingProductOptions, setIsLoadingProductOptions] = useState(false);
  const [productOptionsError, setProductOptionsError] = useState<string | null>(null);
  const [productOptionsPage, setProductOptionsPage] = useState(1);

  const refreshOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    setOverviewError(null);
    try {
      const data = await fetchWmsPurchasingOverview({
        ...(selectedStoreId ? { storeId: selectedStoreId } : {}),
        ...(selectedRequestType ? { requestType: selectedRequestType } : {}),
        ...(selectedStatus ? { status: selectedStatus } : {}),
        ...(deferredSearch ? { search: deferredSearch } : {}),
        page: overviewPage,
        pageSize: 10,
      });
      setOverview(data);
    } catch (error) {
      setOverviewError(parseRequestError(error, 'Failed to load stock requests'));
      setOverview(null);
    } finally {
      setIsLoadingOverview(false);
    }
  }, [deferredSearch, overviewPage, selectedRequestType, selectedStatus, selectedStoreId]);

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  useEffect(() => {
    setOverviewPage(1);
  }, [selectedStoreId, selectedRequestType, selectedStatus, deferredSearch]);

  useEffect(() => {
    if (!selectedBatchId) {
      setSelectedBatch(null);
      setBatchError(null);
      return;
    }

    let active = true;
    setIsLoadingBatch(true);
    setBatchError(null);

    void fetchWmsPurchasingBatch(selectedBatchId)
      .then((response) => {
        if (!active) {
          return;
        }
        setSelectedBatch(response.batch);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setBatchError(parseRequestError(error, 'Failed to load request detail'));
        setSelectedBatch(null);
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setIsLoadingBatch(false);
      });

    return () => {
      active = false;
    };
  }, [selectedBatchId]);

  const effectiveStoreId = useMemo(() => {
    if (createStoreScopeId) {
      return createStoreScopeId;
    }
    if (cartLines.length > 0) {
      return cartLines[0].product.store.id;
    }
    return undefined;
  }, [cartLines, createStoreScopeId]);

  const refreshProductOptions = useCallback(async () => {
    if (!isProductPickerOpen) {
      return;
    }

    setIsLoadingProductOptions(true);
    setProductOptionsError(null);
    try {
      const data = await fetchWmsPurchasingProductOptions({
        ...(effectiveStoreId ? { storeId: effectiveStoreId } : {}),
        ...(deferredProductSearch ? { search: deferredProductSearch } : {}),
        page: productOptionsPage,
        pageSize: 10,
      });
      setProductOptions(data);
    } catch (error) {
      setProductOptionsError(parseRequestError(error, 'Failed to load products'));
      setProductOptions(null);
    } finally {
      setIsLoadingProductOptions(false);
    }
  }, [deferredProductSearch, effectiveStoreId, isProductPickerOpen, productOptionsPage]);

  useEffect(() => {
    void refreshProductOptions();
  }, [refreshProductOptions]);

  const setCreateStoreScopeId = useCallback(
    (nextStoreId: string) => {
      setCreateStoreScopeIdState(nextStoreId);
      setProductOptionsPage(1);
      if (cartLines.length > 0) {
        setCartLines([]);
        addToast('info', 'Cart cleared after changing store scope');
      }
    },
    [addToast, cartLines.length],
  );

  const openProductPicker = useCallback(() => {
    setProductOptionsPage(1);
    setProductSearchText('');
    setIsProductPickerOpen(true);
  }, []);

  const closeProductPicker = useCallback(() => {
    setIsProductPickerOpen(false);
  }, []);

  const addProductToCart = useCallback(
    (product: WmsPurchasingProductOption) => {
      if (effectiveStoreId && product.store.id !== effectiveStoreId) {
        addToast('error', 'Only products from one store can be requested in a single batch');
        return;
      }

      setCartLines((current) => {
        const existing = current.find((line) => line.product.profileId === product.profileId);
        if (existing) {
          return current.map((line) =>
            line.product.profileId === product.profileId
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          );
        }

        return [
          ...current,
          {
            id: `cart-${product.profileId}-${Date.now()}`,
            product,
            quantity: 1,
          },
        ];
      });

      setIsProductPickerOpen(false);
    },
    [addToast, effectiveStoreId],
  );

  const removeCartLine = useCallback((lineId: string) => {
    setCartLines((current) => current.filter((line) => line.id !== lineId));
  }, []);

  const updateCartLineQuantity = useCallback((lineId: string, quantity: number) => {
    const nextQuantity = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
    setCartLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, quantity: nextQuantity } : line)),
    );
  }, []);

  const cartTotals = useMemo(() => {
    const totalItems = cartLines.reduce((sum, line) => sum + line.quantity, 0);
    const totalAmount = cartLines.reduce(
      (sum, line) => sum + getUnitAmount(line.product, createRequestType) * line.quantity,
      0,
    );
    return {
      totalItems,
      totalAmount,
    };
  }, [cartLines, createRequestType]);

  const submitRequest = useCallback(async () => {
    if (!cartLines.length) {
      addToast('error', 'Add at least one product to cart');
      return;
    }

    const requestStoreId = effectiveStoreId;
    if (!requestStoreId) {
      addToast('error', 'Select a store scope or add a product first');
      return;
    }

    const payload: CreateWmsPurchasingBatchInput = {
      storeId: requestStoreId,
      requestType: createRequestType,
      sourceType: 'ERP_REQUEST',
      sourceRequestId: getSourceRequestId(),
      sourceRequestType: 2,
      sourceStatus: 'UNDER_REVIEW',
      partnerNotes: createPartnerNotes.trim() || undefined,
      lines: cartLines.map((line, index) => {
        const unitAmount = getUnitAmount(line.product, createRequestType);
        return {
          lineNo: index + 1,
          sourceItemId: line.product.posProductId,
          sourceSnapshot: {
            profileId: line.product.profileId,
            storeId: line.product.store.id,
            originalPartnerUnitCost: unitAmount,
            originalSupplierUnitCost: line.product.supplierUnitCost ?? null,
            originalApprovedQuantity: line.quantity,
          },
          productId: line.product.productId,
          variationId: line.product.variationId,
          requestedProductName: line.product.name,
          requestedQuantity: line.quantity,
          uom: 'unit',
          partnerUnitCost: unitAmount,
          supplierUnitCost: line.product.supplierUnitCost ?? undefined,
          needsProfiling: false,
          resolvedPosProductId: line.product.posProductId,
          resolvedProfileId: line.product.profileId,
        };
      }),
    };

    setIsSubmitting(true);
    try {
      const response = await createWmsPurchasingBatch(payload);
      addToast('success', 'Stock request sent to WMS purchasing queue');
      setCartLines([]);
      setCreatePartnerNotes('');
      setSelectedBatchId(response.batch.id);
      await refreshOverview();
    } catch (error) {
      addToast('error', parseRequestError(error, 'Failed to submit stock request'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    addToast,
    cartLines,
    createPartnerNotes,
    createRequestType,
    effectiveStoreId,
    refreshOverview,
  ]);

  const submitPaymentProof = useCallback(
    async (input: SubmitWmsPurchasingPaymentProofInput) => {
      if (!selectedBatchId) {
        addToast('error', 'Select a request first');
        return;
      }

      setIsSubmittingPaymentProof(true);
      try {
        const response = await submitWmsPurchasingPaymentProof(selectedBatchId, input);
        setSelectedBatch(response.batch);
        addToast('success', 'Payment proof submitted to WMS');
        await refreshOverview();
      } catch (error) {
        addToast('error', parseRequestError(error, 'Failed to submit payment proof'));
      } finally {
        setIsSubmittingPaymentProof(false);
      }
    },
    [addToast, refreshOverview, selectedBatchId],
  );

  const respondToRevision = useCallback(
    async (input: RespondWmsPurchasingRevisionInput) => {
      if (!selectedBatchId) {
        addToast('error', 'Select a request first');
        return;
      }

      setIsRespondingToRevision(true);
      try {
        const response = await respondWmsPurchasingRevision(selectedBatchId, input);
        setSelectedBatch(response.batch);
        addToast(
          'success',
          input.decision === 'ACCEPT'
            ? 'Revised request accepted. Payment is now pending.'
            : 'Revised request rejected.',
        );
        await refreshOverview();
      } catch (error) {
        addToast('error', parseRequestError(error, 'Failed to respond to revision'));
      } finally {
        setIsRespondingToRevision(false);
      }
    },
    [addToast, refreshOverview, selectedBatchId],
  );

  return {
    isLoadingOverview,
    overviewError,
    overview,
    stores: overview?.filters.stores ?? [],
    queueRows: overview?.batches ?? [],
    queuePagination: overview?.pagination ?? { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    queueFilters: overview?.filters ?? null,
    selectedStoreId,
    selectedRequestType,
    selectedStatus,
    search,
    setSelectedStoreId,
    setSelectedRequestType,
    setSelectedStatus,
    setSearch,
    overviewPage,
    setOverviewPage,
    selectedBatchId,
    setSelectedBatchId,
    selectedBatch,
    isLoadingBatch,
    batchError,
    submitPaymentProof,
    isSubmittingPaymentProof,
    respondToRevision,
    isRespondingToRevision,
    createStoreScopeId,
    createRequestType,
    createPartnerNotes,
    cartLines,
    cartTotals,
    isSubmitting,
    setCreateStoreScopeId,
    setCreateRequestType,
    setCreatePartnerNotes,
    removeCartLine,
    updateCartLineQuantity,
    submitRequest,
    isProductPickerOpen,
    productSearchText,
    productOptions,
    isLoadingProductOptions,
    productOptionsError,
    productOptionsPage,
    setProductSearchText: (value: string) => {
      setProductSearchText(value);
      setProductOptionsPage(1);
    },
    setProductOptionsPage,
    openProductPicker,
    closeProductPicker,
    addProductToCart,
    effectiveStoreId,
  };
}
