'use client';

import { ClipboardCheck, Clock, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import { WmsModal } from '../../_components/wms-modal';
import type {
  UpdateWmsPurchasingLineInput,
  WmsPurchasingBatchDetail,
  WmsPurchasingBatchStatus,
} from '../_types/purchasing';
import {
  formatDateTime,
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
  isEnsuringInvoice?: boolean;
  onClose: () => void;
  onApplyStatus: (status: WmsPurchasingBatchStatus, message?: string) => Promise<void>;
  onUpdateLine: (lineId: string, payload: UpdateWmsPurchasingLineInput) => Promise<void>;
  onCreateReceiving: () => void;
  onOpenLinkedInvoice?: (invoiceId: string) => void;
  onEnsureLinkedInvoice?: () => Promise<void>;
};

type LineDraft = {
  approvedQuantity: string;
  supplierUnitCost: string;
  partnerUnitCost: string;
};

type ImageSize = {
  width: number;
  height: number;
};

type ImageFocusPoint = {
  x: number;
  y: number;
};

function parseCostDraft(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PurchasingBatchModal({
  open,
  batch,
  isLoading,
  canEdit,
  canCreateReceiving,
  isUpdatingStatus,
  isUpdatingLine,
  isCreatingReceiving,
  isEnsuringInvoice = false,
  onClose,
  onApplyStatus,
  onUpdateLine,
  onCreateReceiving,
  onOpenLinkedInvoice,
  onEnsureLinkedInvoice,
}: PurchasingBatchModalProps) {
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});
  const [activeProofImageUrl, setActiveProofImageUrl] = useState<string | null>(null);
  const [isProofImageZoomed, setIsProofImageZoomed] = useState(false);
  const [proofImageBaseSize, setProofImageBaseSize] = useState<ImageSize | null>(null);
  const [proofImageFocusPoint, setProofImageFocusPoint] = useState<ImageFocusPoint | null>(null);
  const proofImageScrollRef = useRef<HTMLButtonElement | null>(null);
  const proofImageRef = useRef<HTMLImageElement | null>(null);

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
            approvedQuantity: String(line.approvedQuantity ?? line.requestedQuantity),
            supplierUnitCost: line.supplierUnitCost?.toString() ?? '',
            partnerUnitCost: line.partnerUnitCost?.toString() ?? '',
          },
        ]),
      ),
    );
  }, [batch]);

  useEffect(() => {
    setActiveProofImageUrl(null);
    setIsProofImageZoomed(false);
    setProofImageBaseSize(null);
    setProofImageFocusPoint(null);
  }, [batch?.id, open]);

  useEffect(() => {
    if (!isProofImageZoomed || !proofImageFocusPoint || !proofImageBaseSize) {
      return;
    }

    const container = proofImageScrollRef.current;
    if (!container) {
      return;
    }

    const zoomRatio = 1.6;
    const scaledWidth = proofImageBaseSize.width * zoomRatio;
    const scaledHeight = proofImageBaseSize.height * zoomRatio;
    const targetLeft = Math.max(
      0,
      proofImageFocusPoint.x * scaledWidth - container.clientWidth / 2,
    );
    const targetTop = Math.max(
      0,
      proofImageFocusPoint.y * scaledHeight - container.clientHeight / 2,
    );

    const frame = window.requestAnimationFrame(() => {
      container.scrollTo({
        left: targetLeft,
        top: targetTop,
        behavior: 'auto',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isProofImageZoomed, proofImageBaseSize, proofImageFocusPoint]);

  const handleProofImageZoomToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const image = proofImageRef.current;

    if (!image) {
      setIsProofImageZoomed((current) => !current);
      return;
    }

    if (isProofImageZoomed) {
      setIsProofImageZoomed(false);
      setProofImageFocusPoint(null);
      proofImageScrollRef.current?.scrollTo({ left: 0, top: 0, behavior: 'auto' });
      return;
    }

    const bounds = image.getBoundingClientRect();
    const relativeX = bounds.width > 0
      ? Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
      : 0.5;
    const relativeY = bounds.height > 0
      ? Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))
      : 0.5;

    setProofImageFocusPoint({ x: relativeX, y: relativeY });
    setIsProofImageZoomed(true);
  };

  const editableLines = canEdit && (batch?.status === 'UNDER_REVIEW' || batch?.status === 'REVISION');
  const isSelfBuy = batch?.requestType === 'SELF_BUY';
  const canCreateLinkedInvoice = Boolean(
    batch
    && !isSelfBuy
    && [
      'PENDING_PAYMENT',
      'PAYMENT_REVIEW',
      'RECEIVING_READY',
      'RECEIVING',
      'STOCKED',
      'REJECTED',
      'CANCELED',
    ].includes(batch.status),
  );
  const showSupplierCogs = !isSelfBuy;
  const paymentProofImageUrl = getSafeImageUrl(batch?.paymentProofImageUrl);
  const pendingLineUpdates = useMemo(() => {
    if (!batch || !editableLines) {
      return [];
    }

    return batch.lines.flatMap((line) => {
      const draft = lineDrafts[line.id];
      if (!draft) {
        return [];
      }

      const initialApprovedQuantity = line.approvedQuantity ?? line.requestedQuantity;
      const normalizedApprovedQuantity =
        draft.approvedQuantity.trim() === ''
          ? 0
          : Number.parseInt(draft.approvedQuantity, 10);
      const nextApprovedQuantity = Number.isFinite(normalizedApprovedQuantity)
        ? Math.max(0, Math.min(line.requestedQuantity, Math.floor(normalizedApprovedQuantity)))
        : initialApprovedQuantity;
      const nextSupplierUnitCost = parseCostDraft(draft.supplierUnitCost);
      const nextPartnerUnitCost = parseCostDraft(draft.partnerUnitCost);
      const supplierChanged =
        showSupplierCogs
        && nextSupplierUnitCost !== null
        && nextSupplierUnitCost !== (line.supplierUnitCost ?? null);
      const partnerChanged =
        nextPartnerUnitCost !== null && nextPartnerUnitCost !== (line.partnerUnitCost ?? null);
      const approvedChanged = nextApprovedQuantity !== initialApprovedQuantity;

      if (!approvedChanged && !supplierChanged && !partnerChanged) {
        return [];
      }

      const payload: UpdateWmsPurchasingLineInput = {};
      if (approvedChanged) {
        payload.approvedQuantity = nextApprovedQuantity;
      }
      if (supplierChanged) {
        payload.supplierUnitCost = nextSupplierUnitCost ?? undefined;
      }
      if (partnerChanged) {
        payload.partnerUnitCost = nextPartnerUnitCost ?? undefined;
      }

      return [{
        lineId: line.id,
        payload,
      }];
    });
  }, [batch, editableLines, lineDrafts, showSupplierCogs]);
  const statusActions = useMemo(() => {
    if (!batch) {
      return [];
    }

    if (batch.status === 'UNDER_REVIEW') {
      if (batch.requestType === 'SELF_BUY') {
        return [
          {
            label: 'Approve for Shipment',
            status: 'AWAITING_PRODUCTS' as WmsPurchasingBatchStatus,
            tone: 'primary' as const,
            description: 'Partner can now ship products to warehouse',
          },
          {
            label: 'Cancel',
            status: 'CANCELED' as WmsPurchasingBatchStatus,
            tone: 'danger' as const,
            description: 'Close this request',
          },
        ];
      }

      return [
        {
          label: 'Accept',
          status: 'PENDING_PAYMENT' as WmsPurchasingBatchStatus,
          tone: 'primary' as const,
          description: 'No COGS or quantity changes',
        },
        {
          label: 'Cancel',
          status: 'CANCELED' as WmsPurchasingBatchStatus,
          tone: 'danger' as const,
          description: 'Close this request',
        },
      ];
    }

    if (batch.status === 'RECEIVING_EXCEPTION' && batch.requestType === 'SELF_BUY') {
      return [
        {
          label: 'Return to Shipment Queue',
          status: 'AWAITING_PRODUCTS' as WmsPurchasingBatchStatus,
          tone: 'primary' as const,
          description: 'Ask partner to resend or correct the shipment',
        },
        {
          label: 'Cancel',
          status: 'CANCELED' as WmsPurchasingBatchStatus,
          tone: 'danger' as const,
          description: 'Close this request',
        },
      ];
    }

    if (batch.status === 'SHIPPED' && batch.requestType === 'SELF_BUY') {
      return [
        {
          label: 'Flag Shipment Issue',
          status: 'RECEIVING_EXCEPTION' as WmsPurchasingBatchStatus,
          tone: 'secondary' as const,
          description: 'Partner shipment does not match the approved request',
        },
        {
          label: 'Cancel',
          status: 'CANCELED' as WmsPurchasingBatchStatus,
          tone: 'danger' as const,
          description: 'Close this request',
        },
      ];
    }

    if (batch.status === 'RECEIVING' && batch.requestType === 'SELF_BUY') {
      return [
        {
          label: 'Flag Receiving Mismatch',
          status: 'RECEIVING_EXCEPTION' as WmsPurchasingBatchStatus,
          tone: 'secondary' as const,
          description: 'Delivered stock does not match the approved self-buy request',
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
        },
        {
          label: 'Verify Payment',
          status: 'RECEIVING_READY' as WmsPurchasingBatchStatus,
          tone: 'primary' as const,
        },
        {
          label: 'Reject',
          status: 'REJECTED' as WmsPurchasingBatchStatus,
          tone: 'danger' as const,
        },
      ];
    }

    return [];
  }, [batch]);

  const paymentProofCard = batch ? (
    <div className="rounded-2xl border border-[#dce4ea] bg-white px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">
        {isSelfBuy ? 'Partner Shipment Notice' : 'Payment Proof'}
      </p>
      {!isSelfBuy && paymentProofImageUrl ? (
        <div className="mt-1.5 space-y-2">
          <button
            type="button"
            onClick={() => {
              setActiveProofImageUrl(paymentProofImageUrl);
              setIsProofImageZoomed(false);
            }}
            className="block w-full overflow-hidden rounded-xl border border-[#dce4ea] bg-[#f8fbfd] text-left transition hover:border-[#b9c9d4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7fb0cc]/40"
            aria-label="Open payment proof image"
          >
            <img
              src={paymentProofImageUrl}
              alt="Payment proof"
              className="h-auto max-h-[260px] w-full object-contain"
            />
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveProofImageUrl(paymentProofImageUrl);
              setIsProofImageZoomed(false);
            }}
            className="btn btn-sm btn-outline"
          >
            Open proof image
          </button>
          <p className="text-[12px] text-[#5f7483]">
                    Submitted {formatDateTime(batch?.paymentProofSubmittedAt || batch?.paymentSubmittedAt)}
                    {batch?.paymentProofSubmittedBy ? ` Â· ${batch.paymentProofSubmittedBy.name}` : ''}
          </p>
        </div>
      ) : (
        <p className="mt-1.5 text-[12px] text-[#7b8e9c]">
          {isSelfBuy
            ? batch.status === 'SHIPPED'
              ? 'Partner already confirmed the self-buy shipment to warehouse.'
              : batch.status === 'RECEIVING_EXCEPTION'
                ? 'Warehouse flagged a mismatch and is waiting for partner follow-up.'
                : 'Shipment notice will appear after the partner marks the self-buy request as shipped.'
            : 'No proof submitted yet'}
        </p>
      )}
    </div>
  ) : null;

  async function handleStatusAction(status: WmsPurchasingBatchStatus) {
    if (status !== 'CANCELED' && pendingLineUpdates.length > 0) {
      for (const update of pendingLineUpdates) {
        await onUpdateLine(update.lineId, update.payload);
      }
      return;
    }

    await onApplyStatus(status);
  }

  if (!open) {
    return null;
  }

  const title = batch?.sourceRequestId || batch?.requestTitle || 'Purchasing Batch';
  const description = batch
    ? `${batch.store.name} · ${formatRequestTypeLabel(batch.requestType)}`
    : 'Loading batch details';

  return (
    <>
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
            <WmsCompactPanel title="Request Lines" icon={<ClipboardCheck className='panel-icon' />}>
              <div className="max-h-[420px] overflow-y-auto">
                <table className="min-w-full divide-y divide-[#eef2f5]">
                  <thead className="bg-white">
                    <tr>
                      <HeaderCell className="w-[56px]">Line</HeaderCell>
                      <HeaderCell>Item</HeaderCell>
                      <HeaderCell className="text-right">Requested</HeaderCell>
                      <HeaderCell className="text-right">Approved</HeaderCell>
                      {showSupplierCogs ? <HeaderCell className="text-right">Supplier COGS</HeaderCell> : null}
                      <HeaderCell className="text-right">
                        {isSelfBuy ? 'Actual Unit COGS' : 'Inhouse COGS'}
                      </HeaderCell>
                      {editableLines ? <HeaderCell className="text-right">Save</HeaderCell> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef2f5]">
                    {batch.lines.map((line) => {
                      const initialApprovedQuantity = line.approvedQuantity ?? line.requestedQuantity;
                      const draft = lineDrafts[line.id] ?? {
                        approvedQuantity: String(initialApprovedQuantity),
                        supplierUnitCost: line.supplierUnitCost?.toString() ?? '',
                        partnerUnitCost: line.partnerUnitCost?.toString() ?? '',
                      };
                      const normalizedApprovedQuantity =
                        draft.approvedQuantity.trim() === ''
                          ? 0
                          : Number.parseInt(draft.approvedQuantity, 10);
                      const nextApprovedQuantity = Number.isFinite(normalizedApprovedQuantity)
                        ? Math.max(0, Math.min(line.requestedQuantity, Math.floor(normalizedApprovedQuantity)))
                        : initialApprovedQuantity;
                      const nextSupplierUnitCost = parseCostDraft(draft.supplierUnitCost);
                      const nextPartnerUnitCost = parseCostDraft(draft.partnerUnitCost);
                      const supplierChanged =
                        showSupplierCogs
                        && nextSupplierUnitCost !== null
                        && nextSupplierUnitCost !== (line.supplierUnitCost ?? null);
                      const partnerChanged =
                        nextPartnerUnitCost !== null && nextPartnerUnitCost !== (line.partnerUnitCost ?? null);
                      const approvedChanged = nextApprovedQuantity !== initialApprovedQuantity;
                      const isDirty =
                        approvedChanged
                        || supplierChanged
                        || partnerChanged;

                      return (
                        <tr key={line.id}>
                          <td className="px-4 py-3 text-sm font-semibold tabular-nums text-primary">
                            #{line.lineNo}
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-[280px] space-y-0.5">
                              <p className="truncate text-sm font-semibold text-primary">
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
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-primary">
                            {editableLines ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={draft.approvedQuantity}
                                onChange={(event) => {
                                  const nextValue = event.target.value;

                                  if (nextValue !== '' && !/^\d+$/.test(nextValue)) {
                                    return;
                                  }

                                  setLineDrafts((current) => ({
                                    ...current,
                                    [line.id]: {
                                      ...draft,
                                      approvedQuantity: nextValue,
                                    },
                                  }));
                                }}
                                onBlur={() =>
                                  setLineDrafts((current) => ({
                                    ...current,
                                    [line.id]: {
                                      ...draft,
                                      approvedQuantity: draft.approvedQuantity.trim() === '' ? '0' : draft.approvedQuantity,
                                    },
                                  }))
                                }
                                className="h-9 w-20 rounded-[12px] border border-[#d7e0e7] bg-white px-3 text-right text-[13px] font-semibold text-primary outline-none transition focus:border-[#96b4c3]"
                              />
                            ) : (
                              line.approvedQuantity ?? line.requestedQuantity
                            )}
                          </td>
                          {showSupplierCogs ? (
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
                                  className="h-9 w-28 rounded-[12px] border border-[#d7e0e7] bg-white px-3 text-right text-[13px] font-semibold text-primary outline-none transition focus:border-[#96b4c3]"
                                />
                              ) : (
                                formatMoney(line.supplierUnitCost)
                              )}
                            </td>
                          ) : null}
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
                                className="h-9 w-28 rounded-[12px] border border-[#d7e0e7] bg-white px-3 text-right text-[13px] font-semibold text-primary outline-none transition focus:border-[#96b4c3]"
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
                                    ...(approvedChanged ? { approvedQuantity: nextApprovedQuantity } : {}),
                                    ...(supplierChanged ? { supplierUnitCost: nextSupplierUnitCost ?? undefined } : {}),
                                    ...(partnerChanged ? { partnerUnitCost: nextPartnerUnitCost ?? undefined } : {}),
                                  })
                                }
                                disabled={!isDirty || isUpdatingLine}
                                className="inline-flex h-8 items-center rounded-[10px] border border-[#d7e0e7] bg-white px-3 text-[11px] font-semibold text-primary transition hover:border-primary hover:bg-[#f8fafb] disabled:cursor-not-allowed disabled:opacity-50"
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
            </WmsCompactPanel>

            <WmsCompactPanel title="Timeline" icon={<Clock className='panel-icon' />}>
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
                        <p className="text-[12px] font-semibold text-primary">{event.eventType}</p>
                        <p className="text-[11px] text-[#7b8e9c]">{formatShortDate(event.createdAt)}</p>
                      </div>
                      <p className="mt-1 text-[12px] text-[#4d6677]">
                        {event.message || `${event.fromStatus || '—'} -> ${event.toStatus || '—'}`}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </WmsCompactPanel>

            {paymentProofCard}
          </div>

          <div className="space-y-3">
            <MetricCard label="Status">
              <div className="space-y-2">
                <span
                  className={`pill ${getStatusClasses(batch.status)}`}
                >
                  {formatStatusLabel(batch.status)}
                </span>
                {/* <p className="text-[12px] font-medium text-[#5f7483]">
                  {getStatusHelper(batch.status, batch.requestType)}
                </p> */}
              </div>
            </MetricCard>

            {canEdit && statusActions.length > 0 ? (
              <div className="card">
                <p className="card-label">Actions</p>
                {pendingLineUpdates.length > 0 ? (
                  <p className="mt-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
                    This request has edited quantity or COGS values. Send the modified request to the partner for agreement before payment.
                  </p>
                ) : null}
                <div className="mt-2 space-y-2">
                  {statusActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => void handleStatusAction(action.status)}
                      disabled={isUpdatingStatus || isUpdatingLine}
                      className={getActionClassName(action.tone)}
                    >
                      {isUpdatingStatus || isUpdatingLine
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : pendingLineUpdates.length > 0 && action.status !== 'CANCELED'
                          ? 'Send changes to partner'
                          : action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {canCreateReceiving ? (
              <div className="card">
                <p className="card-label">
                  Stock Receiving
                </p>
                <p className="mt-1.5 text-[12px] leading-5 text-[#9a3412]">
                  Post this request into warehouse intake, choose warehouse and staging, then continue label printing in Inventory.
                </p>
                <button
                  type="button"
                  onClick={onCreateReceiving}
                  disabled={isCreatingReceiving}
                  className="mt-3 w-full btn btn-md btn-primary"
                >
                  {isCreatingReceiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Post to Stock Receiving'}
                </button>
              </div>
            ) : null}

            <MetricCard label="Request Type">{formatRequestTypeLabel(batch.requestType)}</MetricCard>
            <MetricCard label="Source">{batch.sourceRequestId || 'Manual / adapter'}</MetricCard>
            <MetricCard label={isSelfBuy ? 'Shipment Status' : 'Invoice'}>
              {isSelfBuy
                ? formatStatusLabel(batch.status)
                : batch.invoice.number || batch.invoiceNumber || 'Not assigned'}
            </MetricCard>
            <MetricCard label={isSelfBuy ? 'Approved Units' : 'Invoice Amount'}>
              {isSelfBuy
                ? String(batch.approvedQuantity)
                : formatMoney(batch.invoice.amount ?? batch.invoiceAmount)}
            </MetricCard>
            <MetricCard label={isSelfBuy ? 'Shipment Notified' : 'Payment Submitted'}>
              {formatShortDate(batch.requestType === 'SELF_BUY' ? batch.readyForReceivingAt : batch.paymentSubmittedAt)}
            </MetricCard>
            <MetricCard label={isSelfBuy ? 'Warehouse Intake' : 'Payment Verified'}>
              {formatShortDate(batch.requestType === 'SELF_BUY' ? batch.updatedAt : batch.paymentVerifiedAt)}
            </MetricCard>
            <MetricCard label="Receiving Ready">{formatShortDate(batch.readyForReceivingAt)}</MetricCard>

            {!isSelfBuy ? (
              <div className="rounded-2xl border border-[#dce4ea] bg-white px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Bank Details</p>
                <div className="mt-1.5 space-y-1 text-sm text-primary">
                  <p>Bank: {batch.invoice.bankDetails?.bankName || '—'}</p>
                  <p>Account Name: {batch.invoice.bankDetails?.bankAccountName || '—'}</p>
                  <p>Account Number: {batch.invoice.bankDetails?.bankAccountNumber || '—'}</p>
                  <p>Account Type: {batch.invoice.bankDetails?.bankAccountType || '—'}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#dce4ea] bg-white px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Self-buy Flow</p>
                <div className="mt-1.5 space-y-1 text-sm text-primary">
                  <p>WMS approves shipment instead of payment.</p>
                  <p>Partner marks the request shipped from ERP.</p>
                  <p>Warehouse receives and checks actual delivered stock against this request.</p>
                </div>
              </div>
            )}

            {!isSelfBuy ? (
              <div className="rounded-2xl border border-[#dce4ea] bg-white px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">
                      Linked Invoice
                    </p>
                    <p className="mt-1 text-sm font-semibold text-primary">
                      {batch.invoice.linked?.invoiceNumber ?? batch.invoice.number ?? 'Not created'}
                    </p>
                    <p className="mt-1 text-[12px] text-[#5f7483]">
                      {batch.invoice.linked
                        ? `${formatGenericStatusLabel(batch.invoice.linked.status)} · ${formatMoney(batch.invoice.linked.amountDue)} due`
                        : 'Create the linked invoice record for this procurement batch.'}
                    </p>
                  </div>
                  {batch.invoice.linked ? (
                    <button
                      type="button"
                      onClick={() => onOpenLinkedInvoice?.(batch.invoice.linked!.id)}
                      className="btn btn-sm btn-outline shrink-0"
                    >
                      Open
                    </button>
                  ) : canCreateLinkedInvoice ? (
                    <button
                      type="button"
                      onClick={() => void onEnsureLinkedInvoice?.()}
                      disabled={isEnsuringInvoice}
                      className="btn btn-sm btn-outline shrink-0"
                    >
                      {isEnsuringInvoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create'}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

          </div>
        </div>
      )}
      </WmsModal>

      <WmsModal
        open={Boolean(activeProofImageUrl)}
        title="Payment Proof Preview"
        description={batch ? `Submitted ${formatDateTime(batch.paymentProofSubmittedAt || batch.paymentSubmittedAt)}` : undefined}
        onClose={() => {
          setActiveProofImageUrl(null);
          setIsProofImageZoomed(false);
        }}
        panelClassName="!w-[min(96vw,980px)]"
        bodyClassName="bg-surface p-3 sm:p-4"
      >
        {activeProofImageUrl ? (
          <div className="flex min-h-[60dvh] items-center justify-center">
            <button
              type="button"
              onClick={handleProofImageZoomToggle}
              ref={proofImageScrollRef}
              className={`block h-full w-full overflow-auto rounded-xl border border-white/10 bg-[#050f16] p-3 text-left ${
                isProofImageZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              aria-label={isProofImageZoomed ? 'Zoom out payment proof image' : 'Zoom in payment proof image'}
            >
              <div
                className="mx-auto flex items-center justify-center transition-[width,transform] duration-200 ease-out"
                style={{
                  width: isProofImageZoomed ? '160%' : '100%',
                  minHeight: 'calc(60dvh - 24px)',
                }}
              >
                <img
                  ref={proofImageRef}
                  src={activeProofImageUrl}
                  alt="Payment proof preview"
                  onLoad={(event) => {
                    const target = event.currentTarget;
                    setProofImageBaseSize({
                      width: target.clientWidth,
                      height: target.clientHeight,
                    });
                  }}
                  className={`block rounded-xl border border-white/10 bg-white object-contain shadow-[0_24px_80px_-36px_rgba(0,0,0,0.7)] ${
                    isProofImageZoomed
                      ? 'h-auto w-full max-w-none cursor-zoom-out'
                      : 'max-h-[calc(60dvh-24px)] h-auto w-auto max-w-full cursor-zoom-in'
                  }`}
                />
              </div>
            </button>
          </div>
        ) : null}
      </WmsModal>
    </>
  );
}

function getSafeImageUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  const normalized = url.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized, 'https://safe-preview.local');
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
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
    <div className="card">
      <p className="card-label">{label}</p>
      <div className="mt-1.5 text-sm font-semibold text-primary">{children}</div>
    </div>
  );
}

function getStatusHelper(status: WmsPurchasingBatchStatus, requestType?: 'PROCUREMENT' | 'SELF_BUY') {
  if (requestType === 'SELF_BUY') {
    switch (status) {
      case 'UNDER_REVIEW':
        return 'Review the self-buy request, confirm stockable lines, then approve it for partner shipment.';
      case 'REVISION':
        return 'Changed quantities or product terms were sent back to the partner for confirmation.';
      case 'AWAITING_PRODUCTS':
        return 'WMS approved the request and is now waiting for the partner to ship products to warehouse.';
      case 'SHIPPED':
        return 'The partner marked products as shipped. The request can now move into warehouse receiving.';
      case 'RECEIVING_EXCEPTION':
        return 'Warehouse found a mismatch between delivered stock and the approved self-buy request.';
      case 'RECEIVING':
        return 'Receiving is in progress and the delivered self-buy stock is being serialized into staged units.';
      case 'STOCKED':
        return 'Receiving is complete and the self-buy stock has been accepted into inventory.';
      case 'REJECTED':
        return 'The request was rejected and will not proceed further.';
      case 'CANCELED':
        return 'The request was canceled and closed.';
      default:
        return 'Review the latest activity and proceed with the next operational step.';
    }
  }

  switch (status) {
    case 'UNDER_REVIEW':
      return 'Review the request, then accept it as-is or cancel it. Saving quantity or COGS changes sends a revision to the partner.';
    case 'REVISION':
      return 'Updated COGS or quantity was sent back to the partner for confirmation.';
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
    return 'btn btn-md btn-primary w-full';
  }

  if (tone === 'danger') {
    return 'btn btn-md border border-rose-200 bg-white text-rose-700 w-full';
  }

  return 'btn btn-md btn-outline w-full';
}

function formatGenericStatusLabel(value: string) {
  return value
    .split('_')
    .map((token) => token.charAt(0) + token.slice(1).toLowerCase())
    .join(' ');
}
