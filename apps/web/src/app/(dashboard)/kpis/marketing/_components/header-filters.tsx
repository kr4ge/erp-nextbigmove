'use client';

import dynamic from 'next/dynamic';
import { CalendarDays, ChevronDown } from 'lucide-react';
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

const formatYmdToDisplay = (ymd: string) => {
  const [year, month, day] = ymd.split('-');
  if (!year || !month || !day) return ymd;
  return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
};

type HeaderFiltersProps = {
  selectedTeamCode: string;
  filterStartDate: string;
  filterEndDate: string;
  teamOptions: TeamOption[];
  showTeamSelector?: boolean;
  fixedTeamLabel?: string;
  onTeamCodeChange: (value: string) => void;
  onFilterStartDateChange: (value: string) => void;
  onFilterEndDateChange: (value: string) => void;
};

export function HeaderFilters({
  selectedTeamCode,
  filterStartDate,
  filterEndDate,
  teamOptions,
  showTeamSelector = true,
  fixedTeamLabel,
  onTeamCodeChange,
  onFilterStartDateChange,
  onFilterEndDateChange,
}: HeaderFiltersProps) {
  const today = toYmd(new Date());
  const isTodayRange = filterStartDate === today && filterEndDate === today;
  const dateRangeLabel =
    filterStartDate === filterEndDate
      ? formatYmdToDisplay(filterStartDate)
      : `${formatYmdToDisplay(filterStartDate)} - ${formatYmdToDisplay(filterEndDate)}`;

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
      {showTeamSelector ? (
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
      ) : fixedTeamLabel ? (
        <div className="inline-flex h-10 items-center rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-medium text-orange-700">
          {fixedTeamLabel}
        </div>
      ) : null}

      <div className="relative">
        <Datepicker
          value={range}
          onChange={handleDateRangeChange}
          useRange={false}
          asSingle={false}
          showShortcuts={false}
          showFooter={false}
          primaryColor="orange"
          readOnly
          inputClassName={`h-10 cursor-pointer rounded-xl border border-slate-200 bg-white p-0 text-transparent caret-transparent placeholder:text-transparent shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 dark:!border-slate-200 dark:!bg-white dark:!text-transparent transition-[width] duration-300 ease-out ${
            isTodayRange ? 'w-10' : 'w-[200px] sm:w-[236px]'
          }`}
          containerClassName=""
          popupClassName={(defaultClass: string) => `${defaultClass} z-50 kpi-datepicker-light`}
          displayFormat="MM/DD/YYYY"
          separator=" - "
          toggleIcon={() => (
            <span className="flex w-full items-center gap-2 overflow-hidden">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span
                className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out ${
                  isTodayRange
                    ? 'max-w-0 -translate-x-1 opacity-0'
                    : 'max-w-[148px] sm:max-w-[184px] translate-x-0 opacity-100'
                }`}
              >
                {dateRangeLabel}
              </span>
            </span>
          )}
          toggleClassName="absolute inset-0 flex items-center justify-start px-3 text-slate-600 hover:text-orange-700 cursor-pointer"
          placeholder=" "
        />
      </div>
    </div>
  );
}
