'use client';

import dynamic from 'next/dynamic';
import type { InsightsDateRange, MetaAdAccount, MetaAdInsight } from '../types';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

interface MetaInsightsSectionProps {
  adAccounts: MetaAdAccount[];
  insightsAccount: string;
  insightsDateRange: InsightsDateRange;
  insightsLoading: boolean;
  insightsError: string;
  insights: MetaAdInsight[];
  paginatedInsights: MetaAdInsight[];
  insightsPage: number;
  insightsPageSize: number;
  totalInsights: number;
  insightsCanPrev: boolean;
  insightsCanNext: boolean;
  onInsightsAccountChange: (value: string) => void;
  onInsightsDateRangeChange: (value: InsightsDateRange) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function MetaInsightsSection({
  adAccounts,
  insightsAccount,
  insightsDateRange,
  insightsLoading,
  insightsError,
  insights,
  paginatedInsights,
  insightsPage,
  insightsPageSize,
  totalInsights,
  insightsCanPrev,
  insightsCanNext,
  onInsightsAccountChange,
  onInsightsDateRangeChange,
  onPrevPage,
  onNextPage,
}: MetaInsightsSectionProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Ad Insights</h2>
              <p className="text-sm text-slate-600">Data from meta_ad_insights</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={insightsAccount}
                onChange={(e) => onInsightsAccountChange(e.target.value)}
                className="w-full sm:w-auto rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All accounts</option>
                {adAccounts.map((acct) => (
                  <option key={acct.accountId} value={acct.accountId}>
                    {acct.name || acct.accountId}
                  </option>
                ))}
              </select>
              <div className="relative w-full sm:w-64">
                <Datepicker
                  value={insightsDateRange as never}
                  onChange={(value: unknown) => {
                    if (!value || typeof value !== 'object') {
                      onInsightsDateRangeChange({ startDate: null, endDate: null });
                      return;
                    }
                    onInsightsDateRangeChange(value as InsightsDateRange);
                  }}
                  inputClassName="w-full rounded-lg border border-slate-200 pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  containerClassName="w-full"
                  displayFormat="YYYY-MM-DD"
                  toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer"
                  placeholder="Select date range"
                />
              </div>
            </div>
          </div>
        </div>

        {insightsLoading ? (
          <div className="p-6 text-slate-500 flex-1 flex items-center justify-center">Loading insights…</div>
        ) : insightsError ? (
          <div className="p-6 text-rose-600 flex-1 flex items-center justify-center">
            Failed to load insights: {insightsError}
          </div>
        ) : insights.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex-1 flex items-center justify-center">
            No insights found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Date</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Account</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Campaign</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ad Set</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ad</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Spend</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Clicks</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Impr.</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Leads</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedInsights.map((row) => (
                    <tr key={`${row.accountId}-${row.adId}-${row.date}-${row.campaignId}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.date?.slice(0, 10) || '—'}</td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                        <div className="max-w-[120px] truncate" title={row.accountId}>{row.accountId}</div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                        <div className="min-w-[150px] max-w-[250px]">
                          <div className="font-medium text-slate-900 truncate" title={row.campaignName || row.campaignId || '—'}>
                            {row.campaignName || row.campaignId || '—'}
                          </div>
                          <div className="text-xs text-slate-500 truncate" title={row.campaignId}>ID: {row.campaignId || '—'}</div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                        <div className="max-w-[120px] truncate" title={row.adsetId}>{row.adsetId || '—'}</div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                        <div className="min-w-[150px] max-w-[250px]">
                          <div className="font-medium text-slate-900 truncate" title={row.adName || row.adId || '—'}>
                            {row.adName || row.adId || '—'}
                          </div>
                          <div className="text-xs text-slate-500 truncate" title={row.adId}>ID: {row.adId || '—'}</div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap font-medium">
                        {row.spend != null
                          ? Number(row.spend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '0.00'}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.clicks ?? 0}</td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.impressions ?? 0}</td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.leads ?? 0}</td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
              <p className="text-sm text-slate-600">
                Showing {(insightsPage - 1) * insightsPageSize + 1}-{Math.min(insightsPage * insightsPageSize, totalInsights)} of {totalInsights}
              </p>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={onPrevPage}
                  disabled={!insightsCanPrev}
                >
                  Previous
                </button>
                <button
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={onNextPage}
                  disabled={!insightsCanNext}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

