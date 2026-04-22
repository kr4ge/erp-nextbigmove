'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import type {
  RespondWmsPurchasingRevisionInput,
  SubmitWmsPurchasingPaymentProofInput,
  WmsPurchasingBatchDetail,
} from '../_types/request';
import {
  formatMoney,
  formatRequestTypeLabel,
  formatShortDate,
  formatStatusLabel,
  getStatusClasses,
} from '../_utils/request-presenters';

interface RequestDetailPanelProps {
  batch: WmsPurchasingBatchDetail | null;
  isLoading: boolean;
  error: string | null;
  canSubmitPaymentProof: boolean;
  isSubmittingPaymentProof: boolean;
  onSubmitPaymentProof: (input: SubmitWmsPurchasingPaymentProofInput) => Promise<void>;
  canRespondToRevision: boolean;
  isRespondingToRevision: boolean;
  onRespondToRevision: (input: RespondWmsPurchasingRevisionInput) => Promise<void>;
}

function formatAddress(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(', ');
}

export function RequestDetailPanel({
  batch,
  isLoading,
  error,
  canSubmitPaymentProof,
  isSubmittingPaymentProof,
  onSubmitPaymentProof,
  canRespondToRevision,
  isRespondingToRevision,
  onRespondToRevision,
}: RequestDetailPanelProps) {
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [proofMessage, setProofMessage] = useState('');

  useEffect(() => {
    setProofImageUrl(batch?.paymentProofImageUrl ?? '');
    setProofMessage('');
  }, [batch?.id, batch?.paymentProofImageUrl]);

  if (isLoading) {
    return (
      <Card className="border-[#d9e2ec]">
        <p className="text-sm text-[#5a7184]">Loading request details...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-[#f1c7cc] bg-[#fff8f8]">
        <p className="text-sm text-[#9f1d35]">{error}</p>
      </Card>
    );
  }

  if (!batch) {
    return (
      <Card className="border-[#d9e2ec]">
        <p className="text-sm text-[#5a7184]">Select a request from the queue to view status and invoice.</p>
      </Card>
    );
  }

  const billTo = batch.store.name;
  const bank = batch.invoice.bankDetails;
  const lineItemsTotal = batch.lines.reduce((sum, line) => {
    const quantity = line.approvedQuantity ?? line.requestedQuantity;
    const unitRate = line.partnerUnitCost ?? 0;
    return sum + quantity * unitRate;
  }, 0);
  const invoiceAmount = batch.invoice.amount ?? lineItemsTotal;
  const revisedLines = batch.lines
    .map((line) => {
      const sourceSnapshot =
        line.sourceSnapshot && typeof line.sourceSnapshot === 'object' && !Array.isArray(line.sourceSnapshot)
          ? line.sourceSnapshot
          : null;
      const originalPartnerUnitCost =
        typeof sourceSnapshot?.originalPartnerUnitCost === 'number'
          ? sourceSnapshot.originalPartnerUnitCost
          : line.partnerUnitCost;
      const revisedQuantity = line.approvedQuantity ?? line.requestedQuantity;
      const hasQuantityChange = revisedQuantity !== line.requestedQuantity;
      const hasRateChange = (line.partnerUnitCost ?? 0) !== (originalPartnerUnitCost ?? 0);

      if (!hasQuantityChange && !hasRateChange) {
        return null;
      }

      return {
        id: line.id,
        label: line.requestedProductName || line.variationId || line.productId || `Line ${line.lineNo}`,
        originalQuantity: line.requestedQuantity,
        revisedQuantity,
        originalRate: originalPartnerUnitCost,
        revisedRate: line.partnerUnitCost,
      };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  return (
    <div className="space-y-4">
      <Card className="border-[#d9e2ec]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b8ba1]">
                Billing Statement
              </p>
              <h2 className="text-base font-semibold text-[#12344d]">
                {batch.invoice.number || batch.sourceRequestId || batch.id.slice(0, 8)}
              </h2>
              <p className="text-xs text-[#6d8191]">{formatRequestTypeLabel(batch.requestType)}</p>
            </div>
            <span
              className={clsx(
                'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                getStatusClasses(batch.status),
              )}
            >
              {formatStatusLabel(batch.status)}
            </span>
          </div>

          <div className="grid gap-3 rounded-xl border border-[#e3e9ef] bg-[#fbfdff] p-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8ba1]">From</p>
              <p className="mt-1 font-semibold text-[#12344d]">
                {bank?.billingCompanyName || bank?.warehouseName || 'Warehouse Billing'}
              </p>
              <p className="mt-1 text-[#4d6677]">{formatAddress(bank?.billingAddress)}</p>
            </div>
            <div className="md:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8ba1]">Bill To</p>
              <p className="mt-1 font-semibold text-[#12344d]">{billTo}</p>
              <p className="mt-1 text-[#4d6677]">Invoice Date: {formatShortDate(batch.updatedAt)}</p>
              <p className="text-[#4d6677]">Requested: {formatShortDate(batch.createdAt)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e3e9ef]">
            <table className="min-w-full divide-y divide-[#edf2f7] text-sm">
              <thead className="bg-[#eff3f6] text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b8ba1]">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf2f7] bg-white">
                {batch.lines.map((line) => {
                  const quantity = line.approvedQuantity ?? line.requestedQuantity;
                  const rate = line.partnerUnitCost ?? 0;
                  return (
                    <tr key={line.id}>
                      <td className="px-3 py-2.5 text-[#4d6677]">{line.lineNo}</td>
                      <td className="px-3 py-2.5 font-medium text-[#12344d]">
                        {line.requestedProductName || line.variationId || line.productId || 'Item'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#12344d]">{quantity}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#12344d]">{formatMoney(rate)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#12344d]">
                        {formatMoney(quantity * rate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-[#e3e9ef] bg-white p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[#12344d]">Total Amount</span>
              <span className="font-semibold text-[#12344d]">{formatMoney(invoiceAmount)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#e3e9ef] bg-[#fbfdff] p-3 text-sm text-[#12344d]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8ba1]">
              Bank Details
            </p>
            <div className="mt-2 space-y-1 text-sm">
              <p>Bank: {bank?.bankName || '—'}</p>
              <p>Account Name: {bank?.bankAccountName || '—'}</p>
              <p>Account Number: {bank?.bankAccountNumber || '—'}</p>
              <p>Account Type: {bank?.bankAccountType || '—'}</p>
              <p>Branch: {bank?.bankBranch || '—'}</p>
              {bank?.paymentInstructions ? <p>Instructions: {bank.paymentInstructions}</p> : null}
            </div>
          </div>
        </div>
      </Card>

      {batch.status === 'REVISION' ? (
        <Card className="border-[#d9e2ec]">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8ba1]">
                Revision Review
              </p>
              <p className="mt-1 text-sm text-[#5a7184]">
                WMS adjusted this request. Review the updated quantity or billing rate before continuing.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-[#e3e9ef] bg-[#fbfdff] p-3">
              {revisedLines.length === 0 ? (
                <p className="text-sm text-[#5a7184]">
                  WMS requested a revision. Open the line items above to review the updated quote.
                </p>
              ) : (
                revisedLines.map((line) => (
                  <div
                    key={line.id}
                    className="rounded-lg border border-[#dce4ea] bg-white px-3 py-2.5"
                  >
                    <p className="text-sm font-semibold text-[#12344d]">{line.label}</p>
                    <div className="mt-1 grid gap-2 text-xs text-[#5a7184] sm:grid-cols-2">
                      <p>
                        Quantity: <span className="font-semibold text-[#12344d]">{line.originalQuantity}</span> to{' '}
                        <span className="font-semibold text-[#12344d]">{line.revisedQuantity}</span>
                      </p>
                      <p>
                        Rate: <span className="font-semibold text-[#12344d]">{formatMoney(line.originalRate)}</span> to{' '}
                        <span className="font-semibold text-[#12344d]">{formatMoney(line.revisedRate)}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {canRespondToRevision ? (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={isRespondingToRevision}
                  onClick={() => void onRespondToRevision({ decision: 'REJECT' })}
                  className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reject Changes
                </button>
                <button
                  type="button"
                  disabled={isRespondingToRevision}
                  onClick={() => void onRespondToRevision({ decision: 'ACCEPT' })}
                  className="inline-flex h-9 items-center rounded-lg bg-[#12384b] px-3 text-sm font-semibold text-white transition hover:bg-[#0f3040] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRespondingToRevision ? 'Submitting...' : 'Accept Changes'}
                </button>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card className="border-[#d9e2ec]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8ba1]">
            Payment Proof
          </p>

          {batch.paymentProofImageUrl ? (
            <div className="space-y-2">
              <a
                href={batch.paymentProofImageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-lg border border-[#d7e0e7] bg-white px-3 py-1.5 text-xs font-semibold text-[#12384b] transition hover:border-[#12384b]"
              >
                Open uploaded proof
              </a>
              <p className="text-xs text-[#6d8191]">
                Submitted: {formatShortDate(batch.paymentProofSubmittedAt || batch.paymentSubmittedAt)}
                {batch.paymentProofSubmittedBy ? ` · ${batch.paymentProofSubmittedBy.name}` : ''}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#5a7184]">No payment proof uploaded yet.</p>
          )}

          {canSubmitPaymentProof ? (
            <div className="space-y-2 rounded-xl border border-[#e3e9ef] bg-[#fbfdff] p-3">
              <input
                value={proofImageUrl}
                onChange={(event) => setProofImageUrl(event.target.value)}
                placeholder="Paste payment proof image URL"
                className="h-9 w-full rounded-lg border border-[#d7e0e7] bg-white px-3 text-sm text-[#12384b] outline-none focus:border-[#9ab3c0]"
              />
              <textarea
                value={proofMessage}
                onChange={(event) => setProofMessage(event.target.value)}
                placeholder="Optional message to WMS"
                rows={2}
                className="w-full rounded-lg border border-[#d7e0e7] bg-white px-3 py-2 text-sm text-[#12384b] outline-none focus:border-[#9ab3c0]"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!proofImageUrl.trim() || isSubmittingPaymentProof}
                  onClick={() =>
                    void onSubmitPaymentProof({
                      paymentProofImageUrl: proofImageUrl.trim(),
                      ...(proofMessage.trim() ? { message: proofMessage.trim() } : {}),
                    })
                  }
                  className="inline-flex h-9 items-center rounded-lg bg-[#12384b] px-3 text-sm font-semibold text-white transition hover:bg-[#0f3040] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingPaymentProof ? 'Submitting...' : 'Submit Payment Proof'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#6d8191]">
              {batch.status === 'UNDER_REVIEW'
                ? 'WMS is still reviewing this request.'
                : batch.status === 'REVISION'
                  ? 'Accept the revised request first before submitting payment proof.'
                  : batch.status === 'PAYMENT_REVIEW'
                    ? 'Your payment proof is being reviewed by WMS.'
                    : batch.status === 'RECEIVING_READY'
                      ? 'Payment has been verified. The request is queued for warehouse receiving.'
                      : batch.status === 'RECEIVING'
                        ? 'The request is being received and serialized in the warehouse.'
                        : batch.status === 'STOCKED'
                          ? 'The request has been stocked into serialized inventory.'
                          : 'Payment proof submission opens when the request status is Pending Payment.'}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
