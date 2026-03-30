"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizePickerDate } from "../_utils/dashboard";
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
          onChange={(
            val: { startDate?: unknown; endDate?: unknown } | null,
          ) => {
            onRangeChange({
              startDate: normalizePickerDate(val?.startDate),
              endDate: normalizePickerDate(val?.endDate),
            });
          }}
          inputClassName="rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          displayFormat="MM/DD/YYYY"
          separator=" – "
          toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          containerClassName=""
          popupClassName={(defaultClass: string) => `${defaultClass} z-50`}
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
            className={`absolute right-0 mt-2 rounded-xl border border-slate-200 bg-white shadow-lg z-30 p-3 space-y-3 ${filterMenuWidthClassName}`}
          >
            {filters.map((filter) => (
              <label
                key={filter.id}
                className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-800"
              >
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-200"
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
