export type KpiValueFormat = 'currency' | 'percent' | 'number';

export const formatKpiValue = (
  value: number | null | undefined,
  format: KpiValueFormat,
  fallback = '—',
): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  if (format === 'currency') {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (format === 'percent') {
    return `${value.toFixed(2)}%`;
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
};
