'use client';

import { useEffect, useMemo, useState } from 'react';
import { MinusCircle, PlusCircle } from 'lucide-react';
import { WmsFormField } from '../../_components/wms-form-field';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsModal } from '../../_components/wms-modal';
import type {
  CreateWmsInvoiceInput,
  UpdateWmsInvoiceInput,
  WmsInvoiceDetail,
  WmsInvoiceLineInput,
  WmsInvoicePaymentProfile,
} from '../_types/purchasing';
import { fetchWmsInvoicePaymentProfiles } from '../_services/purchasing.service';
import { formatMoney } from '../_utils/purchasing-presenters';

type PurchasingInvoiceEditorModalProps = {
  open: boolean;
  invoice: WmsInvoiceDetail | null;
  tenantReady: boolean;
  isSaving: boolean;
  onClose: () => void;
  onCreate: (input: CreateWmsInvoiceInput) => Promise<void>;
  onUpdate: (invoiceId: string, input: UpdateWmsInvoiceInput) => Promise<void>;
};

type LineDraft = {
  description: string;
  itemSubtext: string;
  quantity: string;
  unitRate: string;
  vatEnabled: boolean;
};

const MANUAL_INVOICE_VAT_RATE = 12;

const EMPTY_LINE: LineDraft = {
  description: '',
  itemSubtext: '',
  quantity: '1',
  unitRate: '0',
  vatEnabled: false,
};

function toDateInputValue(value: string | null | undefined) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

export function PurchasingInvoiceEditorModal({
  open,
  invoice,
  tenantReady,
  isSaving,
  onClose,
  onCreate,
  onUpdate,
}: PurchasingInvoiceEditorModalProps) {
  const isEdit = Boolean(invoice);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [paymentProfileId, setPaymentProfileId] = useState('');
  const [paymentProfiles, setPaymentProfiles] = useState<WmsInvoicePaymentProfile[]>([]);
  const [isLoadingPaymentProfiles, setIsLoadingPaymentProfiles] = useState(false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([EMPTY_LINE]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (invoice) {
      setInvoiceNumber(invoice.invoiceNumber);
      setIssueDate(toDateInputValue(invoice.issueDate));
      setDueDate(toDateInputValue(invoice.dueDate));
      setCurrency(invoice.currency || 'PHP');
      setPaymentProfileId(
        typeof invoice.paymentProfile?.id === 'string' ? invoice.paymentProfile.id : '',
      );
      setNotes(invoice.notes || '');
      setLines(
        invoice.lines.length
          ? invoice.lines.map((line) => ({
              description: line.description,
              itemSubtext: line.itemSubtext || '',
              quantity: String(line.quantity),
              unitRate: String(line.unitRate),
              vatEnabled: line.vatEnabled,
            }))
          : [EMPTY_LINE],
      );
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setInvoiceNumber('');
      setIssueDate(today);
      setDueDate(today);
      setCurrency('PHP');
      setPaymentProfileId('');
      setNotes('');
      setLines([EMPTY_LINE]);
    }

    setError(null);
  }, [invoice, open]);

  useEffect(() => {
    if (!open || (invoice && invoice.sourceType !== 'MANUAL')) {
      return;
    }

    let isMounted = true;
    setIsLoadingPaymentProfiles(true);

    fetchWmsInvoicePaymentProfiles()
      .then((profiles) => {
        if (!isMounted) {
          return;
        }

        setPaymentProfiles(profiles);
        setPaymentProfileId((current) => {
          if (invoice) {
            return current;
          }
          return profiles.find((profile) => profile.isDefault)?.id
            ?? profiles[0]?.id
            ?? '';
        });
      })
      .catch(() => {
        if (isMounted) {
          setPaymentProfiles([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingPaymentProfiles(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [invoice, open]);

  const computedTotals = useMemo(() => {
    const totalQuantity = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0);
    const subtotal = lines.reduce((sum, line) => {
      const quantity = Math.max(0, Number(line.quantity) || 0);
      const unitRate = Math.max(0, Number(line.unitRate) || 0);
      return sum + (quantity * unitRate);
    }, 0);
    const vatTotal = lines.reduce((sum, line) => {
      if (!line.vatEnabled) {
        return sum;
      }
      const quantity = Math.max(0, Number(line.quantity) || 0);
      const unitRate = Math.max(0, Number(line.unitRate) || 0);
      return sum + (quantity * unitRate * (MANUAL_INVOICE_VAT_RATE / 100));
    }, 0);

    return {
      totalQuantity,
      subtotal,
      vatTotal,
      total: subtotal + vatTotal,
    };
  }, [lines]);

  const paymentProfileOptions = useMemo(() => {
    if (!invoice || invoice.sourceType !== 'MANUAL') {
      return paymentProfiles;
    }

    const savedProfileId =
      typeof invoice.paymentProfile?.id === 'string' ? invoice.paymentProfile.id : '';
    const savedProfileIsAvailable = paymentProfiles.some(
      (profile) => (profile.id ?? '') === savedProfileId,
    );

    if (savedProfileIsAvailable) {
      return paymentProfiles;
    }

    return [
      {
        id: savedProfileId || null,
        name:
          typeof invoice.paymentProfile?.name === 'string'
            ? `${invoice.paymentProfile.name} (Saved on invoice)`
            : 'Saved invoice payment',
        bankName: null,
        bankAccountName: null,
        bankAccountNumber: null,
        bankAccountType: null,
        bankBranch: null,
        paymentInstructions: null,
        isDefault: false,
        sortOrder: -1,
      },
      ...paymentProfiles,
    ];
  }, [invoice, paymentProfiles]);

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  };

  const handleSubmit = async () => {
    if (!tenantReady) {
      setError('Select a tenant first before creating an invoice.');
      return;
    }

    const normalizedLines: WmsInvoiceLineInput[] = [];
    for (const [index, line] of lines.entries()) {
      const description = line.description.trim();
      const quantity = Number(line.quantity);
      const unitRate = Number(line.unitRate);

      if (!description) {
        setError(`Line ${index + 1} needs a description.`);
        return;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError(`Line ${index + 1} needs a valid quantity.`);
        return;
      }

      if (!Number.isFinite(unitRate) || unitRate < 0) {
        setError(`Line ${index + 1} needs a valid rate.`);
        return;
      }

      normalizedLines.push({
        lineNo: index + 1,
        description,
        itemSubtext: line.itemSubtext.trim() || undefined,
        quantity,
        unitRate,
        vatEnabled: line.vatEnabled,
      });
    }

    try {
      setError(null);

      if (invoice) {
        const savedPaymentProfileId =
          typeof invoice.paymentProfile?.id === 'string' ? invoice.paymentProfile.id : '';
        await onUpdate(invoice.id, {
          ...(invoice.sourceType === 'MANUAL' && paymentProfileId !== savedPaymentProfileId
            ? { paymentProfileId: paymentProfileId || null }
            : {}),
          issueDate: issueDate || null,
          dueDate: dueDate || null,
          currency: currency.trim() || 'PHP',
          notes: notes.trim() || null,
          lines: normalizedLines,
        });
      } else {
        await onCreate({
          paymentProfileId: paymentProfileId || undefined,
          invoiceNumber: invoiceNumber.trim() || undefined,
          issueDate: issueDate || undefined,
          dueDate: dueDate || undefined,
          currency: currency.trim() || 'PHP',
          notes: notes.trim() || undefined,
          lines: normalizedLines,
        });
      }
    } catch {
      // mutation banner handles server message
    }
  };

  return (
    <WmsModal
      open={open}
      onClose={onClose}
      title={invoice ? `Edit ${invoice.invoiceNumber}` : 'New manual invoice'}
      description={invoice ? 'Update the draft invoice lines and billing notes.' : 'Create a tenant-scoped invoice with manual line items.'}
      panelClassName="w-[min(96vw,1120px)]"
      footer={(
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-sm btn-ghost" disabled={isSaving}>
            Cancel
          </button>
          <button type="button" onClick={() => void handleSubmit()} className="btn btn-sm btn-primary" disabled={isSaving}>
            {isSaving ? (invoice ? 'Saving...' : 'Creating...') : invoice ? 'Save draft' : 'Create invoice'}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        {error ? <WmsInlineNotice tone="error">{error}</WmsInlineNotice> : null}

        <div className="grid gap-4 rounded-xl border border-[#e1e8ed] bg-[#fbfcfc] p-4 lg:grid-cols-4">
          {!isEdit ? (
            <WmsFormField label="Invoice number" hint="Leave blank to auto-generate from invoice settings.">
              <input
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
                className="input"
                placeholder="INV-000001"
              />
            </WmsFormField>
          ) : null}

          <WmsFormField label="Issue date">
            <input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className="input" />
          </WmsFormField>

          <WmsFormField label="Due date">
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="input" />
          </WmsFormField>

          <WmsFormField label="Currency">
            <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="input" maxLength={10} />
          </WmsFormField>

          {!invoice || invoice.sourceType === 'MANUAL' ? (
            <WmsFormField
              label="Payment information"
              hint={paymentProfileOptions.length ? 'The selected details are saved with this invoice.' : 'Configure payment options in Settings > Invoice.'}
            >
              <select
                value={paymentProfileId}
                onChange={(event) => setPaymentProfileId(event.target.value)}
                className="input"
                disabled={isLoadingPaymentProfiles || paymentProfileOptions.length === 0}
              >
                {paymentProfileOptions.length === 0 ? (
                  <option value="">No payment option configured</option>
                ) : null}
                {paymentProfileOptions.map((profile) => (
                  <option key={profile.id ?? profile.name ?? 'legacy-payment'} value={profile.id ?? ''}>
                    {profile.name ?? 'Payment option'}
                    {profile.isDefault ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
            </WmsFormField>
          ) : null}

          <div className="lg:col-span-4">
            <WmsFormField label="Notes">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="input min-h-[104px] resize-y py-3"
                placeholder="Optional notes, payment context, or invoice remarks"
              />
            </WmsFormField>
          </div>
        </div>

        <section className="panel panel-content overflow-hidden">
          <div className="panel-header flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="panel-title">Invoice lines</h3>
            </div>
            <button
              type="button"
              onClick={() => setLines((current) => [...current, { ...EMPTY_LINE, quantity: '1' }])}
              className="btn btn-sm btn-outline"
            >
              <PlusCircle className="h-4 w-4" />
              Add line
            </button>
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
                  <HeaderCell className="text-center">
                    {`VAT ${MANUAL_INVOICE_VAT_RATE}%`}
                  </HeaderCell>
                  <HeaderCell className="text-right">Remove</HeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f5]">
                {lines.map((line, index) => {
                  const amount = (Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitRate) || 0));

                  return (
                    <tr key={`draft-line-${index}`}>
                      <td className="px-4 py-3 text-sm tabular-nums text-[#4d6677]">{index + 1}</td>
                      <td className="min-w-[320px] px-4 py-3">
                        <div className="space-y-2">
                          <input
                            value={line.description}
                            onChange={(event) => updateLine(index, { description: event.target.value })}
                            className="input"
                            placeholder="Item name"
                          />
                          <input
                            value={line.itemSubtext}
                            onChange={(event) => updateLine(index, { itemSubtext: event.target.value })}
                            className="input"
                            placeholder="Optional text below item, e.g. May 13-31, 2026"
                          />
                        </div>
                      </td>
                      <td className="min-w-[120px] px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={line.quantity}
                          onChange={(event) => updateLine(index, { quantity: event.target.value })}
                          className="input text-right"
                        />
                      </td>
                      <td className="min-w-[140px] px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unitRate}
                          onChange={(event) => updateLine(index, { unitRate: event.target.value })}
                          className="input text-right"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-primary">
                        {formatMoney(amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                          <input
                            type="checkbox"
                            checked={line.vatEnabled}
                            onChange={(event) => updateLine(index, { vatEnabled: event.target.checked })}
                          />
                          Enable
                        </label>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)))}
                          className="btn btn-sm btn-ghost"
                          disabled={lines.length === 1}
                        >
                          <MinusCircle className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#e6edf1] bg-[#fbfcfc] px-4 py-3">
            <div className="ml-auto flex w-full max-w-[320px] items-center justify-between text-sm">
              <span className="font-medium text-[#4d6677]">Total quantity</span>
              <span className="font-semibold tabular-nums text-primary">{computedTotals.totalQuantity.toLocaleString()}</span>
            </div>
            <div className="ml-auto mt-2 flex w-full max-w-[320px] items-center justify-between text-sm">
              <span className="font-medium text-[#4d6677]">Subtotal</span>
              <span className="font-semibold tabular-nums text-primary">{formatMoney(computedTotals.subtotal)}</span>
            </div>
            {computedTotals.vatTotal > 0 ? (
              <div className="ml-auto mt-2 flex w-full max-w-[320px] items-center justify-between text-sm">
                <span className="font-medium text-[#4d6677]">
                  + VAT ({MANUAL_INVOICE_VAT_RATE}%)
                </span>
                <span className="font-semibold tabular-nums text-primary">{formatMoney(computedTotals.vatTotal)}</span>
              </div>
            ) : null}
            <div className="ml-auto mt-2 flex w-full max-w-[320px] items-center justify-between border-t border-border pt-2 text-sm">
              <span className="font-semibold text-foreground">Total</span>
              <span className="font-semibold tabular-nums text-primary">{formatMoney(computedTotals.total)}</span>
            </div>
          </div>
        </section>
      </div>
    </WmsModal>
  );
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
