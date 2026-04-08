'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, PackagePlus, Wallet, Warehouse } from 'lucide-react';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsStatCard } from '../../_components/wms-stat-card';
import { useAdminSession } from '../../_hooks/use-admin-session';
import { hasAdminPermission } from '../../_utils/access';
import { fetchWarehouses } from '../../warehouses/_services/warehouses.service';
import { fetchInventoryPosProducts } from '../../inventory/_services/inventory.service';
import { fetchWmsStockRequest, fetchWmsStockRequests } from '../../requests/_services/requests.service';
import { createStockReceipt, fetchStockReceipts } from '../_services/purchasing.service';
import { ReceiptStatusBadge } from '../_components/receipt-status-badge';
import { createEmptyReceiptForm, StockReceiptForm } from '../_components/stock-receipt-form';
import type { CreateWmsStockReceiptInput } from '../_types/purchasing';

function formatMoney(value: number, currency = 'PHP') {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function PurchasingReceiptsPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user, permissions } = useAdminSession();
  const [form, setForm] = useState<CreateWmsStockReceiptInput>(createEmptyReceiptForm());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdFromUrl = searchParams.get('requestId') || '';

  const warehousesQuery = useQuery({
    queryKey: ['wms-warehouses'],
    queryFn: fetchWarehouses,
  });
  const receiptsQuery = useQuery({
    queryKey: ['wms-stock-receipts'],
    queryFn: fetchStockReceipts,
  });
  const profiledProductsQuery = useQuery({
    queryKey: ['wms-profiled-products'],
    queryFn: () => fetchInventoryPosProducts({ profiledOnly: true, limit: 300 }),
  });
  const stockRequestsQuery = useQuery({
    queryKey: ['wms-stock-requests', 'receipt-options'],
    queryFn: () => fetchWmsStockRequests({ limit: 100 }),
  });
  const selectedRequestQuery = useQuery({
    queryKey: ['wms-stock-request', form.requestId || requestIdFromUrl],
    queryFn: () => fetchWmsStockRequest(form.requestId || requestIdFromUrl),
    enabled: Boolean(form.requestId || requestIdFromUrl),
  });

  useEffect(() => {
    if (form.warehouseId || !warehousesQuery.data?.length) {
      return;
    }

    const warehouse = warehousesQuery.data[0];
    const location =
      warehouse.locations.find(
        (item) => item.status === 'ACTIVE' && ['RECEIVING', 'STORAGE'].includes(item.type),
      ) || null;

    setForm((current) => ({
      ...current,
      warehouseId: warehouse.id,
      locationId: location?.id || '',
    }));
  }, [form.warehouseId, warehousesQuery.data]);

  useEffect(() => {
    if (requestIdFromUrl && form.requestId !== requestIdFromUrl) {
      setForm((current) => ({
        ...current,
        requestId: requestIdFromUrl,
      }));
    }
  }, [form.requestId, requestIdFromUrl]);

  useEffect(() => {
    if (!selectedRequestQuery.data) {
      return;
    }

    const request = selectedRequestQuery.data;
    const outstandingItems = request.items.filter(
      (item) =>
        item.isActive &&
        (request.requestType === 'PARTNER_SELF_BUY'
          ? item.acceptedQuantity
          : item.requestedQuantity) > item.receivedQuantity,
    );

    if (outstandingItems.length === 0) {
      setForm((current) => ({
        ...createEmptyReceiptForm(),
        warehouseId: current.warehouseId,
        locationId: current.locationId,
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      requestId: request.id,
      supplierName: current.supplierName || request.tenant.companyName || request.tenant.name,
      supplierReference: current.supplierReference || request.requestCode,
      notes:
        current.notes ||
        `Receipt posted from approved ${request.requestType === 'PARTNER_SELF_BUY' ? 'self-buy' : 'procurement'} request ${request.requestCode}.`,
      items: outstandingItems.map((item) => ({
        sourceProductId: item.posProductId,
        requestLineId: item.id,
        sku: item.sku || item.variationId || '',
        productName: item.productName,
        variationId: item.variationId || undefined,
        variationName: item.variationName || '',
        barcode: item.barcode || '',
        quantity: Math.max(
          (request.requestType === 'PARTNER_SELF_BUY'
            ? item.acceptedQuantity
            : item.requestedQuantity) - item.receivedQuantity,
          0,
        ),
        unitCost:
          item.confirmedUnitCost || item.declaredUnitCost || item.supplierCost || 0,
        lotCode: '',
        supplierBatchNo: '',
      })),
    }));
  }, [selectedRequestQuery.dataUpdatedAt]);

  const canCreateReceipt =
    hasAdminPermission(user?.role, permissions, 'wms.purchasing.create') ||
    hasAdminPermission(user?.role, permissions, 'wms.inventory.update');

  const createReceiptMutation = useMutation({
    mutationFn: () => createStockReceipt(form),
    onSuccess: async (receipt) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-stock-receipts'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-lots'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-ledger'] }),
      ]);

      const nextWarehouse =
        warehousesQuery.data?.find((warehouse) => warehouse.id === form.warehouseId) ||
        warehousesQuery.data?.[0] ||
        null;
      const nextLocation =
        nextWarehouse?.locations.find(
          (item) => item.status === 'ACTIVE' && ['RECEIVING', 'STORAGE'].includes(item.type),
        ) || null;

      setForm({
        ...createEmptyReceiptForm(),
        requestId: form.requestId || '',
        warehouseId: nextWarehouse?.id || '',
        locationId: nextLocation?.id || '',
      });
      setMessage(`Receipt ${receipt.receiptCode} posted.`);
      setError(null);
      await refreshRequestLinkedData();
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error ? mutationError.message : 'Unable to post stock receipt.',
      );
      setMessage(null);
    },
  });

  const receipts = receiptsQuery.data || [];
  const eligibleRequests = (stockRequestsQuery.data || []).filter((request) =>
    ['PAYMENT_VERIFIED', 'IN_PROCUREMENT', 'AUDIT_ACCEPTED', 'PARTIALLY_RECEIVED'].includes(
      request.status,
    ),
  );
  const receiptValue = receipts.reduce((sum, receipt) => sum + receipt.totalCost, 0);
  const receiptUnits = receipts.reduce((sum, receipt) => sum + receipt.totalQuantity, 0);

  async function refreshRequestLinkedData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wms-stock-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['wms-stock-request'] }),
    ]);
  }

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Stock Receiving"
        description="Post inbound quantity and COGS into inventory."
        eyebrow="Purchasing"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard label="Receipts" value={receipts.length} description="Posted receipt docs" icon={ClipboardList} />
        <WmsStatCard label="Units" value={receiptUnits.toLocaleString('en-US')} description="Received stock quantity" icon={PackagePlus} accent="emerald" />
        <WmsStatCard label="Value" value={formatMoney(receiptValue)} description="Posted inbound cost" icon={Wallet} accent="amber" />
        <WmsStatCard label="Sites" value={warehousesQuery.data?.length || 0} description="Available receiving warehouses" icon={Warehouse} accent="orange" />
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_440px]">
        <WmsSectionCard title="Receipt Form">
          <div className="mb-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Approved Request
              </span>
              <select
                value={form.requestId || ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...createEmptyReceiptForm(),
                    warehouseId: current.warehouseId,
                    locationId: current.locationId,
                    requestId: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              >
                <option value="">Manual / fallback inbound</option>
                {eligibleRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.requestCode} · {request.tenant.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedRequestQuery.data ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-950">
                  {selectedRequestQuery.data.requestCode}
                </span>
                {' · '}
                {selectedRequestQuery.data.tenant.name}
              </div>
            ) : null}
          </div>

          <StockReceiptForm
            warehouses={warehousesQuery.data || []}
            profiledProducts={profiledProductsQuery.data || []}
            value={form}
            disabled={!canCreateReceipt || createReceiptMutation.isPending}
            onChange={setForm}
            onSubmit={() => createReceiptMutation.mutate()}
          />
        </WmsSectionCard>

        <WmsSectionCard title="Recent Receipts" metadata={`${receipts.length} posted`}>
          <div className="space-y-3">
            {receipts.slice(0, 8).map((receipt) => (
              <div key={receipt.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{receipt.receiptCode}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {receipt.warehouse.code} · {receipt.location.code}
                    </p>
                  </div>
                  <ReceiptStatusBadge status={receipt.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Qty</p>
                    <p className="font-semibold tabular-nums text-slate-950">
                      {receipt.totalQuantity.toLocaleString('en-US')}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Cost</p>
                    <p className="font-semibold tabular-nums text-slate-950">
                      {formatMoney(receipt.totalCost, receipt.currency)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {!receiptsQuery.isLoading && receipts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No receipt yet.
              </div>
            ) : null}
          </div>
        </WmsSectionCard>
      </div>
    </div>
  );
}
