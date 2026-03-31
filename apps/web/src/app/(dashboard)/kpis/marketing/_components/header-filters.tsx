'use client';

import dynamic from 'next/dynamic';
import { ChevronDown } from 'lucide-react';
import type { TeamOption } from '../types';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

const toYmd = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseYmdToLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

type HeaderFiltersProps = {
  selectedTeamCode: string;
  filterStartDate: string;
  filterEndDate: string;
  teamOptions: TeamOption[];
  onTeamCodeChange: (value: string) => void;
  onFilterStartDateChange: (value: string) => void;
  onFilterEndDateChange: (value: string) => void;
};

export function HeaderFilters({
  selectedTeamCode,
  filterStartDate,
  filterEndDate,
  teamOptions,
  onTeamCodeChange,
  onFilterStartDateChange,
  onFilterEndDateChange,
}: HeaderFiltersProps) {
  const range = {
    startDate: parseYmdToLocalDate(filterStartDate),
    endDate: parseYmdToLocalDate(filterEndDate),
  };

  const handleDateRangeChange = (
    value: { startDate?: Date | string | null; endDate?: Date | string | null } | null,
  ) => {
    const startRaw = value?.startDate;
    const endRaw = value?.endDate;

    const nextStart =
      startRaw instanceof Date
        ? toYmd(startRaw)
        : typeof startRaw === 'string'
          ? startRaw.slice(0, 10)
          : filterStartDate;

    const nextEnd =
      endRaw instanceof Date
        ? toYmd(endRaw)
        : typeof endRaw === 'string'
          ? endRaw.slice(0, 10)
          : filterEndDate;

    onFilterStartDateChange(nextStart);
    onFilterEndDateChange(nextEnd);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="relative min-w-[220px]">
        <label htmlFor="kpi-team-filter" className="sr-only">
          Team filter
        </label>
        <select
          id="kpi-team-filter"
          value={selectedTeamCode}
          onChange={(event) => onTeamCodeChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-900 shadow-sm transition hover:border-slate-300 focus:border-slate-300 focus:outline-none"
        >
          <option value="">Select team</option>
          {teamOptions.map((team) => (
            <option key={team.id} value={team.teamCode}>
              {team.name} ({team.teamCode})
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      <div className="relative min-w-[250px]">
        <Datepicker
          value={range}
          onChange={handleDateRangeChange}
          inputClassName="rounded-lg border border-slate-200 pl-3 pr-10 py-2 text-sm text-slate-900 bg-white shadow-sm focus:outline-none focus:border-slate-300"
          containerClassName=""
          popupClassName={(defaultClass: string) => `${defaultClass} z-50`}
          displayFormat="MM/DD/YYYY"
          separator=" – "
          toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          placeholder=""
        />
      </div>
    </div>
  );
}
