"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "react-day-picker/dist/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className = "",
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={className}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium text-[#0F172A]",
        nav: "space-x-1 flex items-center",
        nav_button:
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md",
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-[#64748B] rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-[#F1F5F9]/50 [&:has([aria-selected])]:bg-[#F1F5F9] first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-[#F8FAFC] hover:text-[#0F172A] rounded-md inline-flex items-center justify-center",
        day_range_end: "day-range-end",
        day_selected:
          "bg-[#2563EB] text-white hover:bg-[#1d4fd8] hover:text-white focus:bg-[#2563EB] focus:text-white",
        day_today: "bg-[#F1F5F9] text-[#0F172A] font-semibold",
        day_outside:
          "day-outside text-[#94A3B8] opacity-50 aria-selected:bg-[#F1F5F9]/50 aria-selected:text-[#64748B] aria-selected:opacity-30",
        day_disabled: "text-[#CBD5E1] opacity-50",
        day_range_middle:
          "aria-selected:bg-[#F1F5F9] aria-selected:text-[#0F172A]",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }: { orientation?: 'left' | 'right' | 'up' | 'down' }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
