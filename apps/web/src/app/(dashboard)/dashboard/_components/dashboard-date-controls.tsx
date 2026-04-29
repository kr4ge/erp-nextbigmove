"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateInTimezone, normalizePickerDate } from "../_utils/dashboard";
import type { DateRangeValue } from "../_types/dashboard";

const Datepicker = dynamic(() => import("react-tailwindcss-datepicker"), {
  ssr: false,
});

type DashboardFilterToggle = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

interface DashboardDateControlsProps {
  range: DateRangeValue;
  onRangeChange: (next: DateRangeValue) => void;
  filters: DashboardFilterToggle[];
  filterMenuWidthClassName?: string;
  extraAction?: ReactNode;
}

export function DashboardDateControls({
  range,
  onRangeChange,
  filters,
  filterMenuWidthClassName = "w-56",
  extraAction,
}: DashboardDateControlsProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRef = useRef<HTMLDivElement | null>(null);
  const todayYmd = useMemo(() => formatDateInTimezone(new Date()), []);

  const { showRangeText, rangeLabel } = useMemo(() => {
    const startYmd = range.startDate ? formatDateInTimezone(range.startDate) : null;
    const endYmd = range.endDate ? formatDateInTimezone(range.endDate) : null;
    if (!startYmd || !endYmd) {
      return { showRangeText: false, rangeLabel: "" };
    }

    const isTodayRange = startYmd === todayYmd && endYmd === todayYmd;
    if (isTodayRange) {
      return { showRangeText: false, rangeLabel: "" };
    }

    const formatRangeDate = (ymd: string) => {
      const [year, month, day] = ymd.split("-");
      if (!year || !month || !day) return ymd;
      return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year}`;
    };

    const label =
      startYmd === endYmd
        ? formatRangeDate(startYmd)
        : `${formatRangeDate(startYmd)} - ${formatRangeDate(endYmd)}`;

    return { showRangeText: true, rangeLabel: label };
  }, [range.endDate, range.startDate, todayYmd]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        isFilterOpen &&
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target as Node) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };

    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [isFilterOpen]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Datepicker
          value={range}
          useRange={false}
          asSingle={false}
          showShortcuts={false}
          showFooter={false}
          primaryColor="orange"
          readOnly
          onChange={(
            val: { startDate?: unknown; endDate?: unknown } | null,
          ) => {
            onRangeChange({
              startDate: normalizePickerDate(val?.startDate),
              endDate: normalizePickerDate(val?.endDate),
            });
          }}
          inputClassName={`h-10 cursor-pointer rounded-xl border border-slate-200 bg-white p-0 text-transparent caret-transparent placeholder:text-transparent shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 dark:!border-slate-200 dark:!bg-white dark:!text-transparent transition-[width] duration-300 ease-out ${
            showRangeText ? "w-[236px]" : "w-10"
          }`}
          displayFormat="MM/DD/YYYY"
          separator=" – "
          toggleIcon={() => (
            <span className="flex w-full items-center gap-2 overflow-hidden">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span
                className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out ${
                  showRangeText
                    ? "max-w-[184px] translate-x-0 opacity-100"
                    : "max-w-0 -translate-x-1 opacity-0"
                }`}
              >
                {rangeLabel}
              </span>
            </span>
          )}
          toggleClassName="absolute inset-0 flex items-center justify-start px-3 text-slate-600 hover:text-orange-700 cursor-pointer"
          containerClassName=""
          popupClassName={(defaultClass: string) =>
            `${defaultClass} z-50 kpi-datepicker-light`
          }
          placeholder=" "
        />
      </div>

      <div className="relative" ref={filterButtonRef}>
        <Button
          variant="secondary"
          size="sm"
          className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700"
          onClick={(event) => {
            event.stopPropagation();
            setIsFilterOpen((prev) => !prev);
          }}
        >
          <Filter className="h-4 w-4" />
        </Button>
        {isFilterOpen ? (
          <div
            ref={filterMenuRef}
            className={`absolute left-0 right-auto mt-2 max-w-[calc(100vw-1rem)] rounded-xl border border-slate-200 bg-white shadow-lg z-30 p-3 space-y-3 sm:left-auto sm:right-0 ${filterMenuWidthClassName}`}
          >
            {filters.map((filter) => (
              <label
                key={filter.id}
                className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-800"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-primary checked:border-primary checked:bg-primary focus:ring-2 focus:ring-orange-200"
                  checked={filter.checked}
                  onChange={(event) => filter.onChange(event.target.checked)}
                />
                {filter.label}
              </label>
            ))}
          </div>
        ) : null}
      </div>
      {extraAction}
    </div>
  );
}
