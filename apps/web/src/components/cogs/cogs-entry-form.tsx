"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import dynamic from "next/dynamic";
import { getToday } from "@/lib/timezone";
// Client-only datepicker (ssr disabled to avoid hydration warnings)
const Datepicker = dynamic(() => import("react-tailwindcss-datepicker"), { ssr: false });

// Error Modal Component
function ErrorModal({ errors, onClose }: { errors: string[]; onClose: () => void }) {
  if (errors.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#0F172A]">Validation Error</h3>
            <p className="text-sm text-[#64748B] mt-1">Please fix the following issues:</p>
          </div>
        </div>
        <ul className="space-y-2 pl-2">
          {errors.map((error, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-[#DC2626]">
              <span className="text-red-500 mt-0.5">•</span>
              <span>{error}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="primary">
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}


interface CogsEntryFormProps {
  onSubmit: (cogs: number, startDate: Date, endDate?: Date | null, mode?: 'current' | 'backdated') => void;
  onCancel: () => void;
  initialCogs?: number;
  initialStartDate?: Date;
  initialEndDate?: Date | null;
  isEditing?: boolean;
}

export function CogsEntryForm({
  onSubmit,
  onCancel,
  initialCogs,
  initialStartDate,
  initialEndDate,
  isEditing = false,
}: CogsEntryFormProps) {
  const [cogs, setCogs] = useState<string>(initialCogs?.toString() || "");
  const [mode, setMode] = useState<'current' | 'backdated'>(initialEndDate ? 'backdated' : 'current');
  const [pickerValue, setPickerValue] = useState<{ startDate: string | Date | null; endDate: string | Date | null }>({
    startDate: initialStartDate ? format(initialStartDate, "yyyy-MM-dd") : null,
    endDate: initialEndDate ? format(initialEndDate, "yyyy-MM-dd") : null,
  });
  const [errors, setErrors] = useState<{ cogs?: string; startDate?: string; endDate?: string }>({});
  const [mounted, setMounted] = useState(false);
  const [modalErrors, setModalErrors] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const normalizedDates = useMemo(() => {
    // Parse dates and set to midnight to avoid timezone issues
    let start: Date | null = null;
    let end: Date | null = null;

    console.log('Normalizing dates from pickerValue:', pickerValue);

    if (pickerValue.startDate) {
      if (pickerValue.startDate instanceof Date) {
        // If it's already a Date object, use it
        start = new Date(pickerValue.startDate.getFullYear(), pickerValue.startDate.getMonth(), pickerValue.startDate.getDate());
        console.log('Parsed start date from Date object:', start);
      } else if (typeof pickerValue.startDate === 'string') {
        // Parse the date string in YYYY-MM-DD format
        const parts = pickerValue.startDate.split('-');
        if (parts.length === 3) {
          const [year, month, day] = parts.map(Number);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            start = new Date(year, month - 1, day); // month is 0-indexed
            console.log('Parsed start date from string:', start);
          } else {
            console.log('Invalid date parts:', { year, month, day });
          }
        }
      }
    }

    if (pickerValue.endDate) {
      if (pickerValue.endDate instanceof Date) {
        // If it's already a Date object, use it
        end = new Date(pickerValue.endDate.getFullYear(), pickerValue.endDate.getMonth(), pickerValue.endDate.getDate());
        console.log('Parsed end date from Date object:', end);
      } else if (typeof pickerValue.endDate === 'string') {
        // Parse the date string in YYYY-MM-DD format
        const parts = pickerValue.endDate.split('-');
        if (parts.length === 3) {
          const [year, month, day] = parts.map(Number);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            end = new Date(year, month - 1, day); // month is 0-indexed
            console.log('Parsed end date from string:', end);
          }
        }
      }
    }

    console.log('Normalized dates result:', { start, end });
    return { start, end };
  }, [pickerValue]);

  const handleDateChange = (value: { startDate: string | Date | null; endDate: string | Date | null } | null) => {
    console.log('Datepicker value changed:', value);
    const startDate = value?.startDate ?? null;
    const endDate = value?.endDate ?? null;

    setPickerValue({
      startDate,
      endDate: mode === "backdated" ? endDate : startDate,
    });
    setErrors((prev) => ({ ...prev, startDate: undefined, endDate: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { cogs?: string; startDate?: string; endDate?: string } = {};
    const validationErrors: string[] = [];
    const startDate = normalizedDates.start;
    const endDate = mode === "backdated" ? normalizedDates.end : null;
    const today = getToday(); // Using Manila timezone

    // COGS Validation
    if (!cogs || cogs.trim() === "") {
      newErrors.cogs = "COGS amount is required";
      validationErrors.push("COGS amount is required");
    } else {
      const cogsValue = parseFloat(cogs);

      if (isNaN(cogsValue)) {
        newErrors.cogs = "COGS must be a valid number";
        validationErrors.push("COGS must be a valid number");
      } else if (cogsValue <= 0) {
        newErrors.cogs = "COGS must be greater than 0";
        validationErrors.push("COGS must be greater than 0");
      } else if (cogsValue > 1000000000) {
        newErrors.cogs = "COGS value is too large (max: ₱1,000,000,000)";
        validationErrors.push("COGS value is too large (maximum: ₱1,000,000,000)");
      } else {
        // Check decimal precision
        const decimalPart = cogs.split('.')[1];
        if (decimalPart && decimalPart.length > 2) {
          newErrors.cogs = "COGS can only have up to 2 decimal places";
          validationErrors.push("COGS can only have up to 2 decimal places");
        }
      }
    }

    // Date Validation
    if (!startDate) {
      newErrors.startDate = "Please select a start date";
      validationErrors.push("Start date is required");
    } else {
      // Normalize dates for comparison (compare date only, not time)
      const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      // For current mode, start date should not be in the future
      if (mode === 'current' && startDateOnly > todayOnly) {
        newErrors.startDate = "Start date cannot be in the future for current entries";
        validationErrors.push("Start date cannot be in the future for current entries");
      }
    }

    if (mode === 'backdated') {
      if (!endDate) {
        newErrors.endDate = "Please select an end date";
        validationErrors.push("End date is required for backdated entries");
      } else if (startDate && endDate < startDate) {
        newErrors.endDate = "End date cannot be before start date";
        validationErrors.push("End date cannot be before start date");
      } else {
        // Normalize end date for comparison
        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        if (endDateOnly > todayOnly) {
          newErrors.endDate = "End date cannot be in the future";
          validationErrors.push("End date cannot be in the future");
        }
      }

      // Check if date range is reasonable (not more than 10 years)
      if (startDate && endDate) {
        const yearsDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (yearsDiff > 10) {
          newErrors.endDate = "Date range cannot exceed 10 years";
          validationErrors.push("Date range cannot exceed 10 years");
        }
      }
    }

    if (validationErrors.length > 0) {
      setErrors(newErrors);
      setModalErrors(validationErrors);
      return;
    }

    // Validate dates before submitting
    if (!startDate || isNaN(startDate.getTime())) {
      validationErrors.push("Invalid start date detected");
      setModalErrors(validationErrors);
      return;
    }

    if (endDate && isNaN(endDate.getTime())) {
      validationErrors.push("Invalid end date detected");
      setModalErrors(validationErrors);
      return;
    }

    console.log('Submitting COGS:', {
      cogs: parseFloat(cogs),
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString(),
      mode
    });

    onSubmit(parseFloat(cogs), startDate, endDate, mode);
  };

  return (
    <>
      <ErrorModal errors={modalErrors} onClose={() => setModalErrors([])} />
      <form onSubmit={handleSubmit} className="border border-[#E2E8F0] rounded-lg p-4 bg-[#F8FAFC] space-y-4">
        <h4 className="font-semibold text-[#0F172A]">
          {isEditing ? "Edit COGS Entry" : "Add New COGS Entry"}
        </h4>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-[#0F172A]">Entry Type</label>
        <div className="relative">
          <select
            value={mode}
            onChange={(e) => {
              const nextMode = e.target.value as 'current' | 'backdated';
              setMode(nextMode);
              setPickerValue((prev) => ({
                startDate: prev.startDate,
                endDate: nextMode === 'current' ? prev.startDate : prev.endDate,
              }));
              setErrors((prev) => ({ ...prev, endDate: undefined }));
            }}
            className="w-full h-11 appearance-none rounded-xl border border-[#E2E8F0] bg-white px-3 pr-10 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer transition-all hover:border-[#CBD5E1]"
          >
            <option value="current">New (Current)</option>
            <option value="backdated">Old (Backdated)</option>
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B] pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div>
        <label htmlFor="cogs" className="block text-sm font-medium text-[#0F172A] mb-1">
          New COGS Amount
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]">₱</span>
          <input
            id="cogs"
            type="number"
            step="0.01"
            min="0"
            value={cogs}
            onChange={(e) => {
              setCogs(e.target.value);
              setErrors((prev) => ({ ...prev, cogs: undefined }));
            }}
            placeholder="0.00"
            className={`w-full pl-8 pr-3 h-10 rounded-xl border ${
              errors.cogs ? "border-red-500" : "border-[#E2E8F0]"
            } focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white`}
          />
        </div>
        {errors.cogs && (
          <p className="text-sm text-red-600 mt-1">{errors.cogs}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#0F172A] mb-1">
          {mode === 'backdated' ? "Date Range" : "Effective From"}
        </label>
        {mounted && (
          <div className="relative">
            <Datepicker
              value={pickerValue as any}
              onChange={handleDateChange}
              useRange={false}
              asSingle={mode !== "backdated"}
              showShortcuts={false}
              showFooter={false}
              displayFormat="MMM DD, YYYY"
              primaryColor="blue"
              configs={{
                shortcuts: {},
              }}
              inputClassName={`w-full h-11 pl-3 pr-10 rounded-xl border ${
                errors.startDate || errors.endDate ? "border-red-500" : "border-[#E2E8F0]"
              } bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]`}
              containerClassName="relative"
              toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              popoverDirection="down"
            />
          </div>
        )}
        {errors.startDate && (
          <p className="text-sm text-red-600 mt-1">{errors.startDate}</p>
        )}
        {errors.endDate && (
          <p className="text-sm text-red-600 mt-1">{errors.endDate}</p>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="flex-1">
          {isEditing ? "Update COGS Entry" : "Save COGS Entry"}
        </Button>
      </div>
    </form>
    </>
  );
}
