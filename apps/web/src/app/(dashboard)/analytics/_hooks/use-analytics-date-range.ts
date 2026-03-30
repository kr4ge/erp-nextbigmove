import { useCallback, useMemo, useState } from 'react';
import {
  formatDateInTimezone,
  normalizeDatepickerValue,
  parseYmdToLocalDate,
} from '../_utils/date';

type AnalyticsDateRange = {
  startDate: Date | null;
  endDate: Date | null;
};

export function useAnalyticsDateRange(initialYmd?: string) {
  const today = useMemo(() => initialYmd || formatDateInTimezone(new Date()), [initialYmd]);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [range, setRange] = useState<AnalyticsDateRange>({
    startDate: parseYmdToLocalDate(today),
    endDate: parseYmdToLocalDate(today),
  });

  const handleDateRangeChange = useCallback(
    (val: { startDate?: Date | string | null; endDate?: Date | string | null } | null) => {
      const nextStart = val?.startDate || today;
      const nextEnd = val?.endDate || today;
      const nextStartYmd = normalizeDatepickerValue(nextStart, today);
      const nextEndYmd = normalizeDatepickerValue(nextEnd, today);

      setStartDate((prev) => (prev === nextStartYmd ? prev : nextStartYmd));
      setEndDate((prev) => (prev === nextEndYmd ? prev : nextEndYmd));
      setRange((prev) => {
        const prevStartYmd = prev.startDate ? formatDateInTimezone(prev.startDate) : '';
        const prevEndYmd = prev.endDate ? formatDateInTimezone(prev.endDate) : '';
        if (prevStartYmd === nextStartYmd && prevEndYmd === nextEndYmd) return prev;
        return {
          startDate: parseYmdToLocalDate(nextStartYmd),
          endDate: parseYmdToLocalDate(nextEndYmd),
        };
      });
    },
    [today],
  );

  const syncDateRangeFromApi = useCallback(
    (nextStartYmd: string, nextEndYmd: string) => {
      setStartDate((prev) => (prev === nextStartYmd ? prev : nextStartYmd));
      setEndDate((prev) => (prev === nextEndYmd ? prev : nextEndYmd));
      setRange((prev) => {
        const prevStartYmd = prev.startDate ? formatDateInTimezone(prev.startDate) : '';
        const prevEndYmd = prev.endDate ? formatDateInTimezone(prev.endDate) : '';
        if (prevStartYmd === nextStartYmd && prevEndYmd === nextEndYmd) return prev;
        return {
          startDate: parseYmdToLocalDate(nextStartYmd),
          endDate: parseYmdToLocalDate(nextEndYmd),
        };
      });
    },
    [],
  );

  return {
    today,
    range,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    handleDateRangeChange,
    syncDateRangeFromApi,
  };
}
