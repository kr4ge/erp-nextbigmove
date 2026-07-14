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
      if (!val || (!val.startDate && !val.endDate)) {
        return;
      }

      const nextStart = val.startDate ?? val.endDate ?? startDate;
      const nextEnd = val.endDate ?? val.startDate ?? endDate;
      const nextStartYmd = normalizeDatepickerValue(nextStart, startDate);
      const nextEndYmd = normalizeDatepickerValue(nextEnd, endDate);

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
    [endDate, startDate],
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
