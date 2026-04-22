'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { WmsModal } from '../../_components/wms-modal';
import type {
  UpdateWmsPurchasingLineInput,
  WmsPurchasingBatchDetail,
  WmsPurchasingBatchStatus,
} from '../_types/purchasing';
import {
  formatMoney,
  formatRequestTypeLabel,
  formatShortDate,
  formatStatusLabel,
  getStatusClasses,
} from '../_utils/purchasing-presenters';

type PurchasingBatchModalProps = {
  open: boolean;
  batch: WmsPurchasingBatchDetail | null;
  isLoading: boolean;
  canEdit: boolean;
  canCreateReceiving: boolean;
  isUpdatingStatus: boolean;
  isUpdatingLine: boolean;
  isCreatingReceiving: boolean;
  onClose: () => void;
  onApplyStatus: (status: WmsPurchasingBatchStatus, message?: string) => Promise<void>;
  onUpdateLine: (lineId: string, payload: UpdateWmsPurchasingLineInput) => Promise<void>;
  onCreateReceiving: () => void;
};

type LineDraft = {
  approvedQuantity: number;
  supplierUnitCost: string;
  partnerUnitCost: string;
};

export function PurchasingBatchModal({
  open,
  batch,
  isLoading,
  canEdit,
  canCreateReceiving,
  isUpdatingStatus,
  isUpdatingLine,
  isCreatingReceiving,
  onClose,
  onApplyStatus,
  onUpdateLine,
  onCreateReceiving,
}: PurchasingBatchModalProps) {
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});

  useEffect(() => {
    if (!batch) {
      setLineDrafts({});
      return;
    }

    setLineDrafts(
      Object.fromEntries(
        batch.lines.map((line) => [
          line.id,
          {
            approvedQuantity: line.approvedQuantity ?? line.requestedQuantity,
            supplierUnitCost: line.supplierUnitCost?.toString() ?? '',
            partnerUnitCost: line.partnerUnitCost?.toString() ?? '',
          },
        ]),
      ),
    );
  }, [batch]);

  const editableLines = canEdit && (batch?.status === 'UNDER_REVIEW' || batch?.status === 'REVISION');
  const statusActions = useMemo(() => {
    if (!batch) {
      return [];
    }

    if (batch.status === 'UNDER_REVIEW') {
      return [
        {
          label: 'Accept',
          status: 'PENDING_PAYMENT' as WmsPurchasingBatchStatus,
          tone: 'primary' as const,
          description: 'No pricing or quantity changes',
        },
        {
          label: 'Cancel',
          status: 'CANCELED' as WmsPurchasingBatchStatus,
          tone: 'danger' as const,
          description: 'Close this request',
        },
      ];
    }

    if (batch.status === 'PAYMENT_REVIEW') {
      return [
        {
          label: 'Request New Proof',
          status: 'PENDING_PAYMENT' as WmsPurchasingBatchStatus,
          tone: 'secondary' as const,
          description: 'Return to partner payment queue',
        },
        {
          label: 'Verify Payment',
          status: 'RECEIVING_READY' as WmsPurchasingBatchStatus,
          tone: 'primary' as const,
          description: 'Hand off to warehouse receiving',
        },
        {
          label: 'Reject',
          status: 'REJECTED' as WmsPurchasingBatchStatus,
          tone: 'danger' as const,
          description: 'Close this request',
        },
      ];
    }

    return [];
  }, [batch]);

  if (!open) {
    return null;
  }

  const title = batch?.sourceRequestId || batch?.requestTitle || 'Purchasing Batch';
  const description = batch
    ? `${batch.store.name} · ${formatRequestTypeLabel(batch.requestType)}`
    : 'Loading batch details';

  return (
    <WmsModal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
    >
      {!batch || isLoading ? (
        <div className="flex h-44 items-center justify-center text-sm text-[#718797]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading batch details…
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          <div className="space-y-4">
            <div className="rounded-[20px] border border-[#dce4ea] bg-[#fbfcfc]">
              <div className="border-b border-[#e7edf2] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">
                  Request Lines
                </p>
                {editableLines ? (
                  <p className="mt-1 text-[12px] text-[#5f7483]">
                    Saving quantity or cost changes will send the request back to the partner as a revision.
                  </p>
                ) : null}
              </div>

              <div className="max-h-[420px] overflow-y-auto">
                <table className="min-w-full divide-y divide-[#eef2f5]">
                  <thead className="bg-white">
                    <tr>
                      <HeaderCell className="w-[56px]">Line</HeaderCell>
                      <HeaderCell>Item</HeaderCell>
                      <HeaderCell className="text-right">Requested</HeaderCell>
                      <HeaderCell className="text-right">Approved</HeaderCell>
                      <HeaderCell className="text-right">Supplier</HeaderCell>
                      <HeaderCell className="text-right">Partner</HeaderCell>
                      {editableLines ? <HeaderCell className="text-right">Save</HeaderCell> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef2f5]">
                    {batch.lines.map((line) => {
                      const draft = lineDrafts[line.id] ?? {
                        approvedQuantity: line.approvedQuantity ?? line.requestedQuantity,
                        supplierUnitCost: line.supplierUnitCost?.toString() ?? '',
                        partnerUnitCost: line.partnerUnitCost?.toString() ?? '',
                      };
                      const isDirty =
                        draft.approvedQuantity !== (line.approvedQuantity ?? line.requestedQuantity)
                        || draft.supplierUnitCost !== (line.supplierUnitCost?.toString() ?? '')
                        || draft.partnerUnitCost !== (line.partnerUnitCost?.toString() ?? '');

                      return (
                        <tr key={line.id}>
                          <td className="px-4 py-3 text-sm font-semibold tabular-nums text-[#12384b]">
                            #{line.lineNo}
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-[280px] space-y-0.5">
                              <p className="truncate text-sm font-semibold text-[#12384b]">
                                {line.requestedProductName || line.variationId || line.productId || 'Item'}
                              </p>
                              <p className="truncate text-[12px] text-[#7b8e9c]">
                                {line.needsProfiling
                                  ? 'Needs profiling'
                                  : line.resolvedProfile
                                    ? `Profile: ${line.resolvedProfile.id.slice(0, 8)}`
                                    : 'No profile linked'}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-[#4d6677]">
                            {line.requestedQuantity}
                          </td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-[#12384b]">
                            {editableLines ? (
                              <input
                                type="number"
                                min={0}
                                max={line.requestedQuantity}
                                value={draft.approvedQuantity}
                                onChange={(event) =>
                                  setLineDrafts((current) => ({
                                    ...current,
                                    [line.id]: {
                                      ...draft,
                                      approvedQuantity: Number(event.target.value),
                                    },
                                  }))
                                }
                                className="h-9 w-20 rounded-[12px] border border-[#d7e0e7] bg-white px-3 text-right text-[13px] font-semibold text-[#12384b] outline-none transition focus:border-[#96b4c3]"
                              />
                            ) : (
                              line.approvedQuantity ?? line.requestedQuantity
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-[#4d6677]">
                            {editableLines ? (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={draft.supplierUnitCost}
                                onChange={(event) =>
                                  setLineDrafts((current) => ({
                                    ...current,
                                    [line.id]: {
                                      ...draft,
                                      supplierUnitCost: event.target.value,
                                    },
                                  }))
                                }
                                className="h-9 w-28 rounded-[12px] border border-[#d7e0e7] bg-white px-3 text-right text-[13px] font-semibold text-[#12384b] outline-none transition focus:border-[#96b4c3]"
                              />
                            ) : (
                              formatMoney(line.supplierUnitCost)
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-[#4d6677]">
                            {editableLines ? (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={draft.partnerUnitCost}
                                onChange={(event) =>
                                  setLineDrafts((current) => ({
                                    ...current,
                                    [line.id]: {
                                      ...draft,
                                      partnerUnitCost: event.target.value,
                                    },
                                  }))
                                }
                                className="h-9 w-28 rounded-[12px] border border-[#d7e0e7] bg-white px-3 text-right text-[13px] font-semibold text-[#12384b] outline-none transition focus:border-[#96b4c3]"
                              />
                            ) : (
                              formatMoney(line.partnerUnitCost)
                            )}
                          </td>
                          {editableLines ? (
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  void onUpdateLine(line.id, {
                                    approvedQuantity: Math.max(
                                      0,
                                      Math.min(line.requestedQuantity, Math.floor(draft.approvedQuantity)),
                                    ),
                                    supplierUnitCost:
                                      draft.supplierUnitCost.trim() === ''
                                        ? undefined
                                        : Number(draft.supplierUnitCost),
                                    partnerUnitCost:
                                      draft.partnerUnitCost.trim() === ''
                                        ? undefined
                                        : Number(draft.partnerUnitCost),
                                  })
                                }
                                disabled={!isDirty || isUpdatingLine}
                                className="inline-flex h-8 items-center rounded-[10px] border border-[#d7e0e7] bg-white px-3 text-[11px] font-semibold text-[#12384b] transition hover:border-[#12384b] hover:bg-[#f8fafb] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isUpdatingLine ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[20px] border border-[#dce4ea] bg-[#fbfcfc]">
              <div className="border-b border-[#e7edf2] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">
                  Timeline
                </p>
              </div>
              <div className="max-h-[220px] space-y-2 overflow-y-auto px-4 py-3">
                {batch.events.length === 0 ? (
                  <p className="text-sm text-[#7b8e9c]">No events yet.</p>
                ) : (
                  batch.events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-[14px] border border-[#e3e9ee] bg-white px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-[#12384b]">{event.eventType}</p>
                        <p className="text-[11px] text-[#7b8e9c]">{formatShortDate(event.createdAt)}</p>
                      </div>
                      <p className="mt-1 text-[12px] text-[#4d6677]">
                        {event.message || `${event.fromStatus || '—'} -> ${event.toStatus || '—'}`}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <MetricCard label="Status">
              <div className="space-y-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${getStatusClasses(batch.status)}`}
                >
                  {formatStatusLabel(batch.status)}
                </span>
                <p className="text-[12px] font-medium text-[#5f7483]">{getStatusHelper(batch.status)}</p>
              </div>
            </MetricCard>

            {canEdit && statusActions.length > 0 ? (
              <div className="rounded-[16px] border border-[#dce4ea] bg-white px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Actions</p>
                <div className="mt-2 space-y-2">
                  {statusActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => void onApplyStatus(action.status)}
                      disabled={isUpdatingStatus}
                      className={getActionClassName(action.tone)}
                    >
                      {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.label}
                      <span className="ml-auto text-[11px] font-medium opacity-75">{action.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {canCreateReceiving ? (
              <div className="rounded-[16px] border border-[#f5d0ae] bg-[#fff7ed] px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c2410c]">
                  Stock Receiving
                </p>
                <p className="mt-1.5 text-[12px] leading-5 text-[#9a3412]">
                  Post this request into warehouse intake, choose warehouse and staging, then continue label printing in Inventory.
                </p>
                <button
                  type="button"
                  onClick={onCreateReceiving}
                  disabled={isCreatingReceiving}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-[12px] bg-[#f97316] px-3 text-[12px] font-semibold text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingReceiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Post to Stock Receiving'}
                </button>
              </div>
            ) : null}

            <MetricCard label="Request Type">{formatRequestTypeLabel(batch.requestType)}</MetricCard>
            <MetricCard label="Source">{batch.sourceRequestId || 'Manual / adapter'}</MetricCard>
            <MetricCard label="Invoice">{batch.invoice.number || batch.invoiceNumber || 'Not assigned'}</MetricCard>
            <MetricCard label="Partner Amount">{formatMoney(batch.invoice.amount ?? batch.invoiceAmount)}</MetricCard>
            <MetricCard label="Payment Submitted">{formatShortDate(batch.paymentSubmittedAt)}</MetricCard>
            <MetricCard label="Payment Verified">{formatShortDate(batch.paymentVerifiedAt)}</MetricCard>
            <MetricCard label="Receiving Ready">{formatShortDate(batch.readyForReceivingAt)}</MetricCard>

            <div className="rounded-[16px] border border-[#dce4ea] bg-white px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Bank Details</p>
              <div className="mt-1.5 space-y-1 text-sm text-[#12384b]">
                <p>Bank: {batch.invoice.bankDetails?.bankName || '—'}</p>
                <p>Account Name: {batch.invoice.bankDetails?.bankAccountName || '—'}</p>
                <p>Account Number: {batch.invoice.bankDetails?.bankAccountNumber || '—'}</p>
                <p>Account Type: {batch.invoice.bankDetails?.bankAccountType || '—'}</p>
              </div>
            </div>

            <div className="rounded-[16px] border border-[#dce4ea] bg-white px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Payment Proof</p>
              {batch.paymentProofImageUrl ? (
                <div className="mt-1.5 space-y-2">
                  <a
                    href={batch.paymentProofImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full border border-[#d7e0e7] bg-[#fbfcfc] px-3 py-1 text-[11px] font-semibold text-[#12384b] transition hover:border-[#12384b]"
                  >
                    Open proof image
                  </a>
                  <p className="text-[12px] text-[#5f7483]">
                    Submitted {formatShortDate(batch.paymentProofSubmittedAt || batch.paymentSubmittedAt)}
                    {batch.paymentProofSubmittedBy ? ` · ${batch.paymentProofSubmittedBy.name}` : ''}
                  </p>
                </div>
              ) : (
                <p className="mt-1.5 text-[12px] text-[#7b8e9c]">No proof submitted yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </WmsModal>
  );
}

function HeaderCell({ children, className = '' }: { children: string; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7b8e9c] ${className}`}
    >
      {children}
    </th>
  );
}

function MetricCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[16px] border border-[#dce4ea] bg-white px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">{label}</p>
      <div className="mt-1.5 text-sm font-semibold text-[#12384b]">{children}</div>
    </div>
  );
}

function getStatusHelper(status: WmsPurchasingBatchStatus) {
  switch (status) {
    case 'UNDER_REVIEW':
      return 'Review the request, then accept it as-is or cancel it. Saving quantity or cost changes sends a revision to the partner.';
    case 'REVISION':
      return 'Updated pricing or quantity was sent back to the partner for confirmation.';
    case 'PENDING_PAYMENT':
      return 'The partner can now review the invoice and submit payment proof.';
    case 'PAYMENT_REVIEW':
      return 'A proof of payment was received and is waiting for WMS verification.';
    case 'RECEIVING_READY':
      return 'Payment is verified and the request can now move into warehouse receiving.';
    case 'RECEIVING':
      return 'Receiving is in progress and stock is being serialized into staged units.';
    case 'STOCKED':
      return 'Receiving is complete and the request has been converted into inventory units.';
    case 'REJECTED':
      return 'The request was rejected and will not proceed further.';
    case 'CANCELED':
      return 'The request was canceled and closed.';
    default:
      return 'Review the latest activity and proceed with the next operational step.';
  }
}

function getActionClassName(tone: 'primary' | 'secondary' | 'danger') {
  if (tone === 'primary') {
    return 'inline-flex h-10 w-full items-center rounded-[12px] bg-[#12384b] px-3 text-[12px] font-semibold text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-50';
  }

  if (tone === 'danger') {
    return 'inline-flex h-10 w-full items-center rounded-[12px] border border-rose-200 bg-white px-3 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50';
  }

  return 'inline-flex h-10 w-full items-center rounded-[12px] border border-[#d7e0e7] bg-white px-3 text-[12px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb] disabled:cursor-not-allowed disabled:opacity-50';
}
