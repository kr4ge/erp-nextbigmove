import type { WmsPurchasingBatchStatus, WmsPurchasingRequestType } from '../_types/request';

export function formatRequestTypeLabel(value: WmsPurchasingRequestType) {
  return value === 'SELF_BUY' ? 'Self-buy' : 'Procurement';
}

export function formatStatusLabel(value: WmsPurchasingBatchStatus) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function getStatusClasses(value: WmsPurchasingBatchStatus) {
  switch (value) {
    case 'UNDER_REVIEW':
      return 'border border-[#f7d8a5] bg-[#fff4dd] text-[#9c5a08]';
    case 'REVISION':
      return 'border border-[#d8def3] bg-[#f4f6fe] text-[#43538a]';
    case 'PENDING_PAYMENT':
      return 'border border-[#b8d9c8] bg-[#ebf8f1] text-[#1f6f45]';
    case 'PAYMENT_REVIEW':
      return 'border border-[#d8d2fd] bg-[#f5f2ff] text-[#5b3aa5]';
    case 'RECEIVING_READY':
      return 'border border-[#b8cad5] bg-[#eaf4fb] text-[#1d4b61]';
    case 'RECEIVING':
      return 'border border-[#c9d7df] bg-[#eef4f8] text-[#2c5468]';
    case 'STOCKED':
      return 'border border-[#1f6f45] bg-[#1f6f45] text-white';
    case 'REJECTED':
      return 'border border-[#f1c7cc] bg-[#fff1f3] text-[#9f1d35]';
    case 'CANCELED':
      return 'border border-[#e2e8ee] bg-[#f4f7f9] text-[#607381]';
    default:
      return 'border border-[#dce4ea] bg-[#fbfcfc] text-[#4d6677]';
  }
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
