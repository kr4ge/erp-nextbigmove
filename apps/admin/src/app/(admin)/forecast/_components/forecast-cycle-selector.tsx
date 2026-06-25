'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ForecastCycleSnapshot } from '../_utils/forecast-formatters';
import {
  formatCycleWeekday,
  formatForecastShortDate,
} from '../_utils/forecast-formatters';

type ForecastCycleSelectorProps = {
  cycles: ForecastCycleSnapshot[];
  selectedCycleDate: string;
  onCycleChange: (cycleDate: string) => void;
};

export function ForecastCycleSelector({
  cycles,
  selectedCycleDate,
  onCycleChange,
}: ForecastCycleSelectorProps) {
  const selectedIndex = Math.max(
    0,
    cycles.findIndex((cycle) => cycle.cycleDate === selectedCycleDate),
  );
  const activeCycle = cycles[selectedIndex] ?? cycles[0];
  const hasMultipleCycles = cycles.length > 1;

  const handlePrevious = () => {
    if (!hasMultipleCycles) {
      return;
    }

    const previousIndex = selectedIndex === 0 ? cycles.length - 1 : selectedIndex - 1;
    onCycleChange(cycles[previousIndex].cycleDate);
  };

  const handleNext = () => {
    if (!hasMultipleCycles) {
      return;
    }

    const nextIndex = selectedIndex === cycles.length - 1 ? 0 : selectedIndex + 1;
    onCycleChange(cycles[nextIndex].cycleDate);
  };

  return (
    <div className="wms-pill-control flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-[#d7e0e7] bg-white px-2.5 text-primary shadow-sm transition hover:border-[#c6d4dd]">
      <button
        type="button"
        onClick={handlePrevious}
        disabled={!hasMultipleCycles}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-secondary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous forecast cycle"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {activeCycle ? (
        <div
          className="flex min-w-0 flex-1 items-center gap-2"
          title={`Forecast ${activeCycle.operationRangeLabel}`}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
          <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
            <span className="shrink-0 text-sm-custom font-semibold text-primary">
                {formatShortCycleWeekday(activeCycle.cycleWeekday)} · {formatForecastShortDate(activeCycle.cycleDate)}
            </span>
            <span className="min-w-0 truncate text-sm-custom text-muted">
              Forecast {activeCycle.operationRangeLabel}
            </span>
            <span className="pill pill-primary shrink-0 px-2 py-0.5">
              {activeCycle.daysForecasted}d
            </span>
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1 truncate text-sm-custom text-muted">
          No cycles
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {cycles.map((cycle, index) => (
          <button
            key={cycle.cycleDate}
            type="button"
            onClick={() => onCycleChange(cycle.cycleDate)}
            className={`h-1.5 rounded-full transition ${
              index === selectedIndex ? 'w-4 bg-primary' : 'w-1.5 bg-secondary'
            }`}
            aria-label={`Show ${formatCycleWeekday(cycle.cycleWeekday)} forecast cycle`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={handleNext}
        disabled={!hasMultipleCycles}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-secondary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next forecast cycle"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function formatShortCycleWeekday(value: ForecastCycleSnapshot['cycleWeekday']) {
  if (value === 'MONDAY') {
    return 'Mon';
  }

  if (value === 'WEDNESDAY') {
    return 'Wed';
  }

  return 'Fri';
}
