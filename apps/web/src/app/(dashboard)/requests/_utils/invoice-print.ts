import { printHtmlDocument } from '@/lib/print-html';
import type { WmsInvoiceDocumentResponse } from '../_types/request';
import { formatMoney, formatShortDate } from './request-presenters';

export function printInvoiceDocument(payload: WmsInvoiceDocumentResponse) {
  const { invoice, document } = payload;
  const issuer = (document.issuer ?? {}) as Record<string, unknown>;
  const billTo = (document.billTo ?? {}) as Record<string, unknown>;
  const issuerName = readString(issuer, 'companyName') ?? document.tenant.name;
  const billToName = readString(billTo, 'companyName') ?? readString(billTo, 'tenantName') ?? 'Not set';
  const invoiceStatusClass = invoice.status.toLowerCase().replaceAll('_', '-');

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
          <td class="num-cell">${escapeHtml(formatMoney(line.amount))}</td>
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
            ? `<img src="${escapeAttribute(issuer.logoUrl)}" alt="${escapeAttribute(issuerName)} logo" class="issuer-logo" />`
            : `<div class="issuer-fallback">${escapeHtml(issuerName)}</div>`}
        </div>
        <div class="invoice-meta">
          <div class="invoice-title">${escapeHtml(document.title)}</div>
          <div class="invoice-number"># ${escapeHtml(invoice.invoiceNumber)}</div>
          <div class="invoice-status ${invoiceStatusClass}">${escapeHtml(formatInvoiceStatusLabel(invoice.status))}</div>
        </div>
      </header>

      <section class="details-grid">
        <div class="issuer-block">
          <div class="party-name">${escapeHtml(issuerName)}</div>
          ${renderMultiline(readString(issuer, 'companyAddress'))}
        </div>
        <div class="billto-block">
          <div class="billto-label">Bill To:</div>
          <div class="party-name">${escapeHtml(billToName)}</div>
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
        <tbody>
          ${lines}
        </tbody>
      </table>

      <section class="totals-wrap">
        <div class="totals-card">
          <div class="total-row">
            <span>Sub Total</span>
            <strong>${escapeHtml(formatMoney(invoice.totals.subtotal ?? invoice.totalAmount))}</strong>
          </div>
          <div class="total-row total-strip">
            <span>Total</span>
            <strong>${escapeHtml(formatMoney(invoice.totals.totalAmount ?? invoice.totalAmount))}</strong>
          </div>
          <div class="total-row total-strip">
            <span>Amount Due</span>
            <strong>${escapeHtml(formatMoney(invoice.totals.amountDue ?? invoice.amountDue))}</strong>
          </div>
        </div>
      </section>

      ${paymentRows || document.payment.paymentInstructions || document.payment.footerNotes || invoice.notes
        ? `
        <section class="payment-block">
          <div class="payment-heading">Offline Payment:</div>
          <div class="payment-copy">
            ${paymentRows}
            ${document.payment.paymentInstructions ? `<div class="payment-note">${renderMultiline(document.payment.paymentInstructions)}</div>` : ''}
          </div>
          ${invoice.notes ? `<div class="notes-block"><div class="notes-heading">Invoice Notes</div>${renderMultiline(invoice.notes)}</div>` : ''}
          ${document.payment.footerNotes ? `<div class="footer-note">${renderMultiline(document.payment.footerNotes)}</div>` : ''}
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
  @page {
    size: A4;
    margin: 14mm 12mm 18mm;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    color: #111111;
    font-family: Arial, Helvetica, sans-serif;
    background: #ffffff;
  }

  .invoice-page {
    width: 100%;
    padding: 8mm 10mm 0;
  }

  .invoice-header,
  .details-grid {
    display: flex;
    justify-content: space-between;
    gap: 32px;
  }

  .invoice-header {
    align-items: flex-start;
    margin-bottom: 54px;
  }

  .issuer-brand {
    min-height: 150px;
    display: flex;
    align-items: flex-start;
  }

  .issuer-logo {
    max-width: 220px;
    max-height: 170px;
    object-fit: contain;
  }

  .issuer-fallback {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.1;
  }

  .invoice-meta {
    min-width: 260px;
    text-align: right;
  }

  .invoice-title {
    font-size: 34px;
    font-weight: 700;
    line-height: 1.04;
    color: #000000;
  }

  .invoice-number {
    margin-top: 4px;
    font-size: 18px;
    font-weight: 700;
    color: #4e4e4e;
  }

  .invoice-status {
    margin-top: 4px;
    font-size: 14px;
    font-weight: 400;
    color: #ff3b30;
    text-transform: uppercase;
  }

  .invoice-status.paid-verified {
    color: #177245;
  }

  .invoice-status.issued,
  .invoice-status.draft,
  .invoice-status.paid-pending-verify {
    color: #ff3b30;
  }

  .details-grid {
    align-items: flex-start;
    margin-bottom: 40px;
  }

  .issuer-block,
  .billto-block,
  .payment-copy,
  .notes-block,
  .footer-note {
    font-size: 11px;
    line-height: 1.28;
  }

  .issuer-block {
    width: 44%;
  }

  .billto-block {
    width: 40%;
    text-align: right;
  }

  .billto-label {
    margin-bottom: 4px;
    font-size: 11px;
    font-weight: 700;
  }

  .party-name {
    margin-bottom: 4px;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
  }

  .multiline + .multiline {
    margin-top: 1px;
  }

  .dates {
    margin-top: 16px;
    font-size: 11px;
    line-height: 1.3;
  }

  .invoice-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 90px;
  }

  .invoice-table thead th {
    background: #39424e;
    color: #ffffff;
    padding: 10px 14px;
    font-size: 11px;
    font-weight: 700;
    text-align: left;
  }

  .invoice-table tbody td {
    padding: 12px 14px;
    border-bottom: 0;
    font-size: 11px;
    color: #111111;
    vertical-align: top;
  }

  .index-cell {
    width: 42px;
    text-align: center;
  }

  .item-cell {
    width: 100%;
  }

  .item-title {
    font-weight: 700;
  }

  .item-meta {
    margin-top: 4px;
    color: #555555;
    font-size: 10px;
  }

  .num-cell {
    width: 138px;
    text-align: right;
    white-space: nowrap;
  }

  .totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 48px;
  }

  .totals-card {
    width: 360px;
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 7px 12px;
    font-size: 11px;
  }

  .total-row span,
  .total-row strong {
    font-weight: 700;
  }

  .total-strip {
    background: #efefef;
  }

  .payment-block {
    width: 58%;
  }

  .payment-heading,
  .notes-heading {
    margin-bottom: 10px;
    font-size: 11px;
    font-weight: 700;
  }

  .payment-note,
  .notes-block,
  .footer-note {
    margin-top: 10px;
  }
`;

function formatInvoiceStatusLabel(value: string) {
  return value
    .split('_')
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(' ');
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function renderMultiline(value: string | null) {
  if (!value) {
    return '';
  }

  return value
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => `<div class="multiline">${escapeHtml(line.trim())}</div>`)
    .join('');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
