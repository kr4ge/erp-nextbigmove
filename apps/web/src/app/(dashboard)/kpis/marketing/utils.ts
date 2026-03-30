import { formatKpiValue } from '@/lib/kpi/format';
import type { KpiTargetRow } from './types';

export const formatMarketingMetricValue = (value: number, format: KpiTargetRow['format']) =>
  formatKpiValue(value, format, '0');

export const parseErrorMessage = (error: unknown): string => {
  const maybe = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };

  return (
    maybe?.response?.data?.message ||
    maybe?.message ||
    'Request failed'
  );
};

export const formatDateRangeLabel = (startDate: string, endDate: string) =>
  startDate === endDate ? startDate : `${startDate} to ${endDate}`;
