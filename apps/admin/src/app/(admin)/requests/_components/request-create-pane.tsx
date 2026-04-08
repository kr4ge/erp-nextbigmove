"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { WmsSectionCard } from "../../_components/wms-section-card";
import { WmsTablePagination } from "../../_components/wms-table-pagination";
import { ProductImage } from "../../inventory/_components/product-image";
import { RequestStatusBadge } from "./request-status-badge";
import type { Partner } from "../../partners/_types/partners";
import type {
  WmsRequestDraftRow,
  WmsRequestType,
  WmsStockRequest,
} from "../_types/requests";

type RequestCreatePaneProps = {
  partners: Partner[];
  shops: Array<{
    id: string;
    name: string;
    shopId: string;
  }>;
  requestType: WmsRequestType;
  tenantId: string;
  storeId: string;
  search: string;
  rows: WmsRequestDraftRow[];
  editingRequest: WmsStockRequest | null;
  loading: boolean;
  error: string | null;
  totalAmount: number;
  activeLineCount: number;
  isSaving: boolean;
  onRequestTypeChange: (value: WmsRequestType) => void;
  onTenantChange: (value: string) => void;
  onStoreChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onQuantityChange: (rowId: string, value: number) => void;
  onDeclaredCostChange: (rowId: string, value: number) => void;
  onReset: () => void;
  onOpenNewRequest: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  formatMoney: (value: number | null | undefined, currency?: string) => string;
};

export function RequestCreatePane({
  partners,
  shops,
  requestType,
  tenantId,
  storeId,
  search,
  rows,
  editingRequest,
  loading,
  error,
  totalAmount,
  activeLineCount,
  isSaving,
  onRequestTypeChange,
  onTenantChange,
  onStoreChange,
  onSearchChange,
  onQuantityChange,
  onDeclaredCostChange,
  onReset,
  onOpenNewRequest,
  onSaveDraft,
  onSubmit,
  formatMoney,
}: RequestCreatePaneProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPageIndex(0);
  }, [requestType, tenantId, storeId, search, rows.length]);

  const paginatedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return rows.slice(start, start + pageSize);
  }, [pageIndex, pageSize, rows]);

  const searchPlaceholder =
    requestType === "PARTNER_SELF_BUY"
      ? "Search store product"
      : "Search requestable product";

  return (
    <div className="space-y-6">
      {editingRequest ? (
        <WmsSectionCard
          title="Editing Request"
          metadata={
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline">{editingRequest.requestCode}</span>
              <RequestStatusBadge status={editingRequest.status} />
            </div>
          }
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900">
                Reopened for partner-side edits.
              </p>
              <p className="text-sm text-slate-500">
                Update quantities or costs, then save or resubmit.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenNewRequest}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
            >
              New Request
            </button>
          </div>
        </WmsSectionCard>
      ) : null}

      <WmsSectionCard
        title="Create Request"
        metadata={
          <div className="flex items-center gap-2">
            {tenantId && storeId ? (
              <span className="hidden text-[11px] text-slate-500 lg:inline">
                {activeLineCount} active • {formatMoney(totalAmount)}
              </span>
            ) : (
              <span className="hidden text-[11px] text-slate-500 lg:inline">
                Pick a partner and store
              </span>
            )}
            <button
              type="button"
              disabled={!tenantId || !storeId || activeLineCount === 0 || isSaving}
              onClick={onSaveDraft}
              className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? "Saving..."
                : editingRequest
                  ? "Update Draft"
                  : "Save Draft"}
            </button>
            <button
              type="button"
              disabled={!tenantId || !storeId || activeLineCount === 0 || isSaving}
              onClick={onSubmit}
              className="inline-flex h-8 items-center justify-center rounded-full bg-orange-500 px-3 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? "Submitting..."
                : editingRequest
                  ? "Update & Submit"
                  : "Submit Request"}
            </button>
          </div>
        }
        bodyClassName="p-0"
      >
          <div className="border-b border-slate-100 px-3 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:items-center">
                <select
                  value={requestType}
                  onChange={(event) =>
                    onRequestTypeChange(event.target.value as WmsRequestType)
                  }
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[190px]"
                >
                  <option value="WMS_PROCUREMENT">WMS Procurement</option>
                  <option value="PARTNER_SELF_BUY">Partner Self-Buy</option>
                </select>

                <select
                  value={tenantId}
                  onChange={(event) => onTenantChange(event.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 xl:w-[210px]"
                >
                  <option value="">Select partner</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>

                <select
                  value={storeId}
                  onChange={(event) => onStoreChange(event.target.value)}
                  disabled={!tenantId}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50 xl:w-[230px]"
                >
                  <option value="">Select store</option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name} ({shop.shopId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative min-w-0 xl:flex-[1.1]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <button
                type="button"
                onClick={onReset}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>

          {!tenantId || !storeId ? (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              Choose a partner and store to load request candidates.
            </div>
          ) : loading ? (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              Loading request candidates...
            </div>
          ) : error ? (
            <div className="px-6 py-14 text-center text-sm text-rose-600">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              {requestType === "PARTNER_SELF_BUY"
                ? "No store products found for this self-buy request."
                : "No requestable products found for this store."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-sm">
                  <colgroup>
                    {requestType === "PARTNER_SELF_BUY" ? (
                      <>
                        <col className="w-[58%]" />
                        <col className="w-[18%]" />
                        <col className="w-[24%]" />
                      </>
                    ) : (
                      <>
                        <col className="w-[34%]" />
                        <col className="w-[8%]" />
                        <col className="w-[8%]" />
                        <col className="w-[8%]" />
                        <col className="w-[8%]" />
                        <col className="w-[10%]" />
                        <col className="w-[10%]" />
                        <col className="w-[14%]" />
                      </>
                    )}
                  </colgroup>
                  <thead className="border-y border-slate-200 bg-slate-50/70">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-4 py-3.5">Item</th>
                      {requestType === "PARTNER_SELF_BUY" ? null : (
                        <>
                          <th className="px-4 py-3.5 text-right">Remain</th>
                          <th className="px-4 py-3.5 text-right">Pending</th>
                          <th className="px-4 py-3.5 text-right">Past 2D</th>
                          <th className="px-4 py-3.5 text-right">Return</th>
                          <th className="px-4 py-3.5 text-right">Order Qty</th>
                        </>
                      )}
                      <th className="px-4 py-3.5 text-right">Request</th>
                      {requestType === "PARTNER_SELF_BUY" ? (
                        <th className="px-4 py-3.5 text-right">
                          Declared COGS
                        </th>
                      ) : (
                        <th className="px-4 py-3.5 text-right">Amount</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedRows.map((row) => {
                      const amount =
                        row.requestedQuantity *
                        (requestType === "PARTNER_SELF_BUY"
                          ? row.declaredUnitCost || 0
                          : row.skuProfile?.wmsUnitPrice || 0);

                      return (
                        <tr key={row.id} className="align-top">
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              <ProductImage
                                imageUrl={row.imageUrl}
                                name={row.name}
                                className="h-11 w-11 rounded-xl"
                              />
                              <div className="min-w-0">
                                <div className="line-clamp-2 text-[15px] font-semibold leading-5 text-slate-950">
                                  {row.name}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                                    {row.variationCustomId || "No ref"}
                                  </span>
                                </div>
                                {requestType === "WMS_PROCUREMENT" ? (
                                  <div className="mt-2 text-xs font-medium text-slate-500">
                                    WMS {formatMoney(row.skuProfile?.wmsUnitPrice)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          {requestType === "PARTNER_SELF_BUY" ? null : (
                            <>
                              <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-900">
                                {row.forecast.remainingStock}
                              </td>
                              <td className="px-4 py-4 text-right tabular-nums text-slate-600">
                                {row.forecast.pending}
                              </td>
                              <td className="px-4 py-4 text-right tabular-nums text-slate-600">
                                {row.forecast.pastTwoDays}
                              </td>
                              <td className="px-4 py-4 text-right tabular-nums text-slate-600">
                                {row.forecast.returning}
                              </td>
                              <td
                                className={`px-4 py-4 text-right font-semibold tabular-nums ${
                                  row.forecast.recommendedQuantity > 0
                                    ? "text-orange-700"
                                    : "text-slate-500"
                                }`}
                              >
                                {row.forecast.recommendedQuantity}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-4 text-right">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.requestedQuantity}
                              onChange={(event) =>
                                onQuantityChange(
                                  row.id,
                                  Number(event.target.value) || 0,
                                )
                              }
                              className="h-10 w-24 rounded-xl border border-slate-200 bg-white px-3 text-right text-sm text-slate-900 outline-none transition focus:border-orange-300"
                            />
                          </td>
                          {requestType === "PARTNER_SELF_BUY" ? (
                            <td className="px-4 py-4 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.declaredUnitCost}
                                onChange={(event) =>
                                  onDeclaredCostChange(
                                    row.id,
                                    Number(event.target.value) || 0,
                                  )
                                }
                                className="h-10 w-28 rounded-xl border border-slate-200 bg-white px-3 text-right text-sm text-slate-900 outline-none transition focus:border-orange-300"
                              />
                            </td>
                          ) : (
                            <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">
                              {formatMoney(amount)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <WmsTablePagination
                pageIndex={pageIndex}
                pageSize={pageSize}
                pageSizeOptions={[10, 25, 50]}
                totalItems={rows.length}
                onPageIndexChange={setPageIndex}
                onPageSizeChange={(nextPageSize) => {
                  setPageIndex(0);
                  setPageSize(nextPageSize);
                }}
              />
            </>
          )}
      </WmsSectionCard>
    </div>
  );
}
