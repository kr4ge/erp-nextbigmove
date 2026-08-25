'use client';

import dynamic from 'next/dynamic';
import { CalendarDays } from 'lucide-react';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

type DatepickerValue = {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
} | null;

type Props = {
  startDate: string;
  endDate: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
  /** Denser variant matching h-9 / rounded-lg filter rails. */
  compact?: boolean;
};

function parseYmd(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toYmd(value: Date | string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(parseYmd(value));
}

export function VideoRegistryDateRangePicker({ startDate, endDate, onChange, compact = false }: Props) {
  const label = startDate === endDate
    ? formatLabel(startDate)
    : `${formatLabel(startDate)} – ${formatLabel(endDate)}`;

  return (
    <div className="relative w-full sm:w-56">
      <Datepicker
        value={{ startDate: parseYmd(startDate), endDate: parseYmd(endDate) }}
        onChange={(value: DatepickerValue) => {
          if (!value?.startDate && !value?.endDate) return;
          const nextStart = toYmd(value.startDate ?? value.endDate, startDate);
          const nextEnd = toYmd(value.endDate ?? value.startDate, endDate);
          onChange({ startDate: nextStart, endDate: nextEnd });
        }}
        useRange={false}
        asSingle={false}
        showShortcuts={false}
        showFooter={false}
        primaryColor="orange"
        readOnly
        maxDate={new Date()}
        inputClassName={`${compact ? 'h-9 rounded-lg border-border/60' : 'h-10 rounded-xl border-border'} w-full cursor-pointer border bg-surface p-0 text-transparent caret-transparent placeholder:text-transparent focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10`}
        containerClassName="relative"
        popupClassName={(defaultClassName: string) => `${defaultClassName} z-50 kpi-datepicker-light`}
        displayFormat="MM/DD/YYYY"
        separator=" – "
        toggleIcon={() => (
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className={`truncate ${compact ? 'text-xs font-medium' : 'text-sm-custom font-semibold'}`}>{label}</span>
          </span>
        )}
        toggleClassName={`absolute inset-0 flex cursor-pointer items-center justify-start border px-3 text-foreground transition hover:border-primary/40 ${compact ? 'rounded-lg border-border/60' : 'rounded-xl border-border'}`}
        placeholder=" "
      />
    </div>
  );
}
