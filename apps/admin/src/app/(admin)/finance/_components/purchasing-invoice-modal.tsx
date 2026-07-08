'use client';

import { Download, FileSpreadsheet, PencilLine } from 'lucide-react';
import { WmsModal } from '../../_components/wms-modal';
import type { WmsInvoiceDetail, WmsInvoiceStatus } from '../_types/purchasing';
import {
  formatDateTime,
  formatInvoiceSourceTypeLabel,
  formatInvoiceStatusLabel,
  formatMoney,
  formatShortDate,
  getInvoiceStatusClasses,
} from '../_utils/purchasing-presenters';

type PurchasingInvoiceModalProps = {
  open: boolean;
  invoice: WmsInvoiceDetail | null;
  isLoading: boolean;
  canEdit: boolean;
  isUpdatingStatus: boolean;
  isPrinting?: boolean;
  onClose: () => void;
  onEditDraft: (invoiceId: string) => void;
  onApplyStatus: (invoiceId: string, status: WmsInvoiceStatus) => Promise<void>;
  onPrint?: (invoiceId: string) => Promise<void> | void;
};

const STATUS_ACTIONS: Record<WmsInvoiceStatus, WmsInvoiceStatus[]> = {
  DRAFT: ['ISSUED', 'CANCELED'],
  ISSUED: ['PAID_PENDING_VERIFY', 'PAID_VERIFIED', 'CANCELED'],
  PAID_PENDING_VERIFY: ['ISSUED', 'PAID_VERIFIED', 'CANCELED'],
  PAID_VERIFIED: [],
  CANCELED: [],
};

export function PurchasingInvoiceModal({
  open,
  invoice,
  isLoading,
  canEdit,
  isUpdatingStatus,
  isPrinting = false,
  onClose,
  onEditDraft,
  onApplyStatus,
  onPrint,
}: PurchasingInvoiceModalProps) {
  const issuer = (invoice?.issuer ?? {}) as Record<string, string | null | undefined>;
  const billTo = (invoice?.billTo ?? {}) as Record<string, string | null | undefined>;
  const actions = invoice ? STATUS_ACTIONS[invoice.status] : [];

  return (
    <WmsModal
      open={open}
      onClose={onClose}
      title={invoice ? invoice.invoiceNumber : 'Invoice'}
      description={invoice ? `${formatInvoiceSourceTypeLabel(invoice.sourceType)} invoice` : 'Invoice detail'}
      panelClassName="w-[min(96vw,1180px)]"
      footer={invoice ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {invoice ? (
              <button
                type="button"
                onClick={() => void onPrint?.(invoice.id)}
                disabled={isPrinting}
                className="btn btn-sm btn-outline"
              >
                <Download className="h-4 w-4" />
                {isPrinting ? 'Preparing...' : 'Print / Save PDF'}
              </button>
            ) : null}

            {canEdit && invoice.status === 'DRAFT' ? (
              <button
                type="button"
                onClick={() => onEditDraft(invoice.id)}
                className="btn btn-sm btn-outline"
              >
                <PencilLine className="h-4 w-4" />
                Edit draft
              </button>
            ) : null}

            {canEdit
              ? actions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => void onApplyStatus(invoice.id, status)}
                    className={status === 'CANCELED' ? 'btn btn-sm btn-destructive' : 'btn btn-sm btn-primary-soft'}
                  >
                    {formatInvoiceStatusLabel(status)}
                  </button>
                ))
              : null}
          </div>

          <button type="button" onClick={onClose} className="btn btn-sm btn-ghost">
            Close
          </button>
        </div>
      ) : undefined}
    >
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <div className="h-28 animate-pulse rounded-xl bg-[#eef2f5]" />
            <div className="h-80 animate-pulse rounded-xl bg-[#eef2f5]" />
          </div>
          <div className="space-y-4">
            <div className="h-28 animate-pulse rounded-xl bg-[#eef2f5]" />
            <div className="h-40 animate-pulse rounded-xl bg-[#eef2f5]" />
          </div>
        </div>
      ) : !invoice ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#dce4ea] bg-[#fbfcfc] text-primary">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold text-primary">Invoice unavailable</p>
          <p className="text-[12.5px] text-[#7b8e9c]">Choose another invoice from the list.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="panel panel-content overflow-hidden">
            <div className="panel-header">
              <FileSpreadsheet className="panel-icon" />
              <h3 className="panel-title">Invoice lines</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#eef2f5]">
                <thead className="bg-[#eff3f6]">
                  <tr>
                    <HeaderCell>#</HeaderCell>
                    <HeaderCell>Item</HeaderCell>
                    <HeaderCell className="text-right">Qty</HeaderCell>
                    <HeaderCell className="text-right">Rate</HeaderCell>
                    <HeaderCell className="text-right">Amount</HeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f5]">
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-[#4d6677]">
                        {line.lineNo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-primary">{line.description}</p>
                          <p className="text-[12px] text-[#7b8e9c]">
                            {line.store?.name ?? 'Tenant-wide'}
                            {line.rateSource ? ` · ${line.rateSource}` : ''}
                          </p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-primary">
                        {line.quantity.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-primary">
                        {formatMoney(line.unitRate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-primary">
                        {formatMoney(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-4">
            <section className="panel panel-content">
              <div className="panel-header">
                <FileSpreadsheet className="panel-icon" />
                <h3 className="panel-title">Overview</h3>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <DetailCard label="Status" value={formatInvoiceStatusLabel(invoice.status)} pillClass={getInvoiceStatusClasses(invoice.status)} />
                <DetailCard label="Source" value={formatInvoiceSourceTypeLabel(invoice.sourceType)} />
                <DetailCard label="Issue date" value={formatShortDate(invoice.issueDate)} />
                <DetailCard label="Due date" value={formatShortDate(invoice.dueDate)} />
                <DetailCard label="Updated" value={formatDateTime(invoice.updatedAt)} />
                <DetailCard label="Amount due" value={formatMoney(invoice.totals.amountDue ?? invoice.amountDue)} />
              </div>
            </section>

            <section className="panel panel-content">
              <div className="panel-header">
                <FileSpreadsheet className="panel-icon" />
                <h3 className="panel-title">Billing</h3>
              </div>
              <div className="grid gap-4 p-4">
                <AddressBlock
                  title="Issuer"
                  name={issuer.companyName ?? issuer.tenantName ?? 'Not set'}
                  address={issuer.companyAddress ?? null}
                  secondary={[
                    issuer.bankName ? `Bank: ${issuer.bankName}` : null,
                    issuer.bankAccountName ? `Account: ${issuer.bankAccountName}` : null,
                    issuer.bankAccountNumber ? `No.: ${issuer.bankAccountNumber}` : null,
                    issuer.bankAccountType ? `Type: ${issuer.bankAccountType}` : null,
                  ]}
                />
                <AddressBlock
                  title="Bill to"
                  name={billTo.companyName ?? billTo.tenantName ?? 'Not set'}
                  address={billTo.billingAddress ?? null}
                />
                {invoice.notes ? (
                  <div className="rounded-xl border border-[#e1e8ed] bg-[#fbfcfc] p-3">
                    <p className="form-label">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[#4d6677]">{invoice.notes}</p>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="panel panel-content">
              <div className="panel-header">
                <FileSpreadsheet className="panel-icon" />
                <h3 className="panel-title">Activity</h3>
              </div>
              <div className="space-y-3 p-4">
                {invoice.activities.length ? (
                  invoice.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="rounded-xl border border-[#e1e8ed] bg-[#fbfcfc] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-primary">
                            {formatActivityLabel(activity.actionType)}
                          </p>
                          <p className="text-[12px] text-[#7b8e9c]">
                            {activity.actor?.name ?? activity.actor?.email ?? 'System'}
                          </p>
                        </div>
                        <p className="text-[12px] text-[#7b8e9c]">
                          {formatDateTime(activity.createdAt)}
                        </p>
                      </div>
                      {activity.fromStatus || activity.toStatus ? (
                        <p className="mt-2 text-[12px] text-[#4d6677]">
                          {activity.fromStatus ?? 'null'} {'->'} {activity.toStatus ?? 'null'}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[#dce4ea] bg-[#fbfcfc] p-4 text-sm text-[#7b8e9c]">
                    No invoice activity recorded yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </WmsModal>
  );
}

function formatActivityLabel(actionType: string) {
  return actionType
    .replace(/^WMS_INVOICE_/, '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function HeaderCell({
  children,
  className = '',
}: {
  children: string;
  className?: string;
}) {
  return (
    <th className={`whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-muted ${className}`}>
      {children}
    </th>
  );
}

function DetailCard({
  label,
  value,
  pillClass,
}: {
  label: string;
  value: string;
  pillClass?: string;
}) {
  return (
    <div className="rounded-xl border border-[#e1e8ed] bg-[#fbfcfc] p-3">
      <p className="form-label">{label}</p>
      {pillClass ? (
        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${pillClass}`}>
          {value}
        </span>
      ) : (
        <p className="mt-2 text-sm font-semibold text-primary">{value}</p>
      )}
    </div>
  );
}

function AddressBlock({
  title,
  name,
  address,
  secondary = [],
}: {
  title: string;
  name: string;
  address: string | null;
  secondary?: Array<string | null | undefined>;
}) {
  const extraLines = secondary.filter(Boolean) as string[];

  return (
    <div className="rounded-xl border border-[#e1e8ed] bg-[#fbfcfc] p-3">
      <p className="form-label">{title}</p>
      <p className="mt-2 text-sm font-semibold text-primary">{name}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[#4d6677]">{address || 'Not set'}</p>
      {extraLines.length ? (
        <div className="mt-2 space-y-1 text-[12px] text-[#7b8e9c]">
          {extraLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
