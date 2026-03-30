'use client';

import {
  AnalyticsTableEmptyRow,
  AnalyticsTableLoadingRows,
  AnalyticsTableShell,
} from './analytics-table-shell';

type RiskConfirmationRow = {
  riskTag: string;
  confirmedCount: number;
  restockingCount: number;
  waitingForPickupCount: number;
  shippedCount: number;
  deliveredCount: number;
  rtsCount: number;
};

const formatCount = (val?: number) => new Intl.NumberFormat('en-US').format(val ?? 0);

type AnalyticsRiskConfirmationTableProps = {
  isLoading: boolean;
  rows: RiskConfirmationRow[];
  riskStart: number;
  riskEnd: number;
  totalRiskRows: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export function AnalyticsRiskConfirmationTable({
  isLoading,
  rows,
  riskStart,
  riskEnd,
  totalRiskRows,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: AnalyticsRiskConfirmationTableProps) {
  return (
    <AnalyticsTableShell
      summaryLabel={`Showing ${riskStart}-${riskEnd} of ${totalRiskRows}`}
      onPrevious={onPrevious}
      onNext={onNext}
      canPrevious={canPrevious}
      canNext={canNext}
      isLoading={isLoading}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Risk Confirmation
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Restocking
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Confirmed
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Waiting For Pickup
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Shipped
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                Delivered
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500 sm:px-4 lg:px-6">
                RTS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <AnalyticsTableLoadingRows colCount={7} />
            ) : (
              rows.map((row) => (
                <tr key={row.riskTag} className="bg-white">
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-700 sm:px-4 lg:px-6">
                    {row.riskTag}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatCount(row.restockingCount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatCount(row.confirmedCount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatCount(row.waitingForPickupCount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatCount(row.shippedCount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatCount(row.deliveredCount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-slate-900 sm:px-4 lg:px-6">
                    {formatCount(row.rtsCount)}
                  </td>
                </tr>
              ))
            )}
            {!isLoading && rows.length === 0 ? (
              <AnalyticsTableEmptyRow colSpan={7} message="No risk confirmation data for the selected scope." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AnalyticsTableShell>
  );
}
