import { printHtmlDocument } from '@/lib/print-html';
import type { WmsInvoiceDocumentResponse } from '../_types/request';
import { formatMoney, formatShortDate } from './request-presenters';

export function printInvoiceDocument(payload: WmsInvoiceDocumentResponse) {
  const { invoice, document } = payload;
  const issuer = (document.issuer ?? {}) as Record<string, unknown>;
  const billTo = (document.billTo ?? {}) as Record<string, unknown>;

  const lines = invoice.lines
    .map((line) => {
      const storeLabel = line.store?.name
        ? `<div class="item-meta">${escapeHtml(line.store.name)}</div>`
        : '';

      return `
        <tr>
          <td class="index-cell">${line.lineNo}</td>
          <td class="item-cell">
            <div class="item-title">${escapeHtml(line.description)}</div>
            ${storeLabel}
          </td>
          <td class="num-cell">${line.quantity.toLocaleString()}</td>
          <td class="num-cell">${escapeHtml(formatMoney(line.unitRate))}</td>
          <td class="num-cell amount-cell">${escapeHtml(formatMoney(line.amount))}</td>
        </tr>
      `;
    })
    .join('');

  const paymentRows = [
    document.payment.bankName ? `Bank: ${escapeHtml(document.payment.bankName)}` : null,
    document.payment.bankAccountName
      ? `Account Name: ${escapeHtml(document.payment.bankAccountName)}`
      : null,
    document.payment.bankAccountNumber
      ? `Account Number: ${escapeHtml(document.payment.bankAccountNumber)}`
      : null,
    document.payment.bankAccountType
      ? `Account Type: ${escapeHtml(document.payment.bankAccountType)}`
      : null,
    document.payment.bankBranch ? `Branch: ${escapeHtml(document.payment.bankBranch)}` : null,
  ]
    .filter(Boolean)
    .map((line) => `<div>${line}</div>`)
    .join('');

  const bodyHtml = `
    <div class="invoice-page">
      <header class="invoice-header">
        <div class="issuer-brand">
          ${typeof issuer.logoUrl === 'string' && issuer.logoUrl
            ? `<img src="${escapeAttribute(issuer.logoUrl)}" alt="${escapeAttribute(readString(issuer, 'companyName') ?? document.tenant.name)} logo" class="issuer-logo" />`
            : ''}
          <div class="issuer-copy">
            <div class="issuer-name">${escapeHtml(readString(issuer, 'companyName') ?? document.tenant.name)}</div>
            ${renderMultiline(readString(issuer, 'companyAddress'))}
          </div>
        </div>
        <div class="invoice-meta">
          <div class="invoice-title">${escapeHtml(document.title)}</div>
          <div class="invoice-number"># ${escapeHtml(invoice.invoiceNumber)}</div>
          <div class="invoice-status">${escapeHtml(invoice.status.replaceAll('_', ' '))}</div>
        </div>
      </header>

      <section class="party-grid">
        <div class="party-block">
          <div class="section-label">Issuer</div>
          <div class="party-name">${escapeHtml(readString(issuer, 'companyName') ?? document.tenant.name)}</div>
          ${renderMultiline(readString(issuer, 'companyAddress'))}
        </div>
        <div class="party-block right">
          <div class="section-label">Bill To</div>
          <div class="party-name">${escapeHtml(readString(billTo, 'companyName') ?? readString(billTo, 'tenantName') ?? 'Not set')}</div>
          ${renderMultiline(readString(billTo, 'billingAddress'))}
          <div class="dates">
            <div>Invoice Date: ${escapeHtml(formatShortDate(invoice.issueDate))}</div>
            <div>Due Date: ${escapeHtml(formatShortDate(invoice.dueDate))}</div>
          </div>
        </div>
      </section>

      <table class="invoice-table">
        <thead>
          <tr>
            <th class="index-cell">#</th>
            <th>Item</th>
            <th class="num-cell">Qty</th>
            <th class="num-cell">Rate</th>
            <th class="num-cell">Amount</th>
          </tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>

      <section class="totals-wrap">
        <div class="totals-card">
          <div class="total-row">
            <span>Sub Total</span>
            <strong>${escapeHtml(formatMoney(invoice.totals.subtotal ?? invoice.totalAmount))}</strong>
          </div>
          <div class="total-row emphasis">
            <span>Total</span>
            <strong>${escapeHtml(formatMoney(invoice.totals.totalAmount ?? invoice.totalAmount))}</strong>
          </div>
          <div class="total-row emphasis">
            <span>Amount Due</span>
            <strong>${escapeHtml(formatMoney(invoice.totals.amountDue ?? invoice.amountDue))}</strong>
          </div>
        </div>
      </section>

      ${paymentRows || document.payment.paymentInstructions || document.payment.footerNotes || invoice.notes
        ? `
        <section class="footer-grid">
          <div class="payment-block">
            <div class="section-label">Payment Information</div>
            ${paymentRows}
            ${document.payment.paymentInstructions ? `<div class="payment-note">${renderMultiline(document.payment.paymentInstructions)}</div>` : ''}
          </div>
          <div class="notes-block">
            ${invoice.notes ? `<div><div class="section-label">Invoice Notes</div>${renderMultiline(invoice.notes)}</div>` : ''}
            ${document.payment.footerNotes ? `<div class="footer-note">${renderMultiline(document.payment.footerNotes)}</div>` : ''}
          </div>
        </section>
      `
        : ''}
    </div>
  `;

  printHtmlDocument({
    title: `${invoice.invoiceNumber} Billing Statement`,
    bodyHtml,
    styles: INVOICE_PRINT_STYLES,
  });
}

const INVOICE_PRINT_STYLES = `
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #102b3f; font-family: Arial, Helvetica, sans-serif; background: #ffffff; }
  .invoice-page { width: 100%; }
  .invoice-header, .party-grid, .footer-grid { display: flex; justify-content: space-between; gap: 24px; }
  .invoice-header { align-items: flex-start; margin-bottom: 32px; }
  .issuer-brand { display: flex; align-items: flex-start; gap: 18px; min-width: 0; max-width: 58%; }
  .issuer-logo { max-width: 132px; max-height: 88px; object-fit: contain; }
  .issuer-name, .party-name { font-size: 18px; font-weight: 700; line-height: 1.25; margin-bottom: 6px; }
  .issuer-copy, .party-block, .notes-block, .payment-block { font-size: 13px; line-height: 1.45; }
  .invoice-meta { text-align: right; min-width: 220px; }
  .invoice-title { font-size: 28px; font-weight: 700; line-height: 1.1; }
  .invoice-number { margin-top: 4px; font-size: 16px; font-weight: 700; }
  .invoice-status { margin-top: 4px; font-size: 13px; font-weight: 700; color: #e5484d; text-transform: uppercase; letter-spacing: 0.08em; }
  .party-grid { margin-bottom: 26px; }
  .party-block { flex: 1 1 0; min-width: 0; }
  .party-block.right { text-align: right; }
  .section-label { margin-bottom: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7f92; }
  .dates { margin-top: 18px; }
  .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  .invoice-table thead th { background: #24314d; color: #ffffff; font-size: 12px; font-weight: 700; padding: 11px 12px; text-align: left; }
  .invoice-table tbody td { border-bottom: 1px solid #e8edf2; padding: 12px; font-size: 13px; vertical-align: top; }
  .index-cell { width: 48px; text-align: center; }
  .item-cell { width: 100%; }
  .item-title { font-weight: 700; }
  .item-meta { margin-top: 4px; font-size: 11px; color: #708398; }
  .num-cell { width: 120px; text-align: right; white-space: nowrap; }
  .amount-cell { font-weight: 700; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 28px; }
  .totals-card { min-width: 280px; background: #f3f5f7; padding: 14px 16px; }
  .total-row { display: flex; justify-content: space-between; gap: 16px; padding: 6px 0; font-size: 13px; }
  .total-row.emphasis { font-size: 18px; font-weight: 700; }
  .footer-grid { align-items: flex-start; }
  .payment-note, .footer-note { margin-top: 10px; }
`;

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function renderMultiline(value: string | null) {
  if (!value) {
    return '';
  }

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
