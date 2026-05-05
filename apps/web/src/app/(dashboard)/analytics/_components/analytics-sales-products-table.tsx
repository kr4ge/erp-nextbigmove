'use client';

import { type ReactNode } from 'react';
import {
  AnalyticsTableEmptyRow,
  AnalyticsTableLoadingRows,
  AnalyticsTableShell,
} from './analytics-table-shell';
import { type SalesOverviewResponse } from '../_types/sales';
import { formatMetricValue, toTitleCase } from '../_utils/metrics';

export type SalesProductsSortKey =
  | 'index'
  | 'product'
  | 'revenue'
  | 'gross_sales'
  | 'cogs'
  | 'aov'
  | 'cpp'
  | 'processed_cpp'
  | 'ad_spend'
  | 'ar_pct'
  | 'rts_pct'
  | 'profit_efficiency'
  | 'contribution_margin'
  | 'cm_rts_forecast'
  | 'net_margin';

export type SalesProductRowItem = {
  row: SalesOverviewResponse['products'][number];
  index: number;
  derived: {
    display: string;
    forecast: { revenueAfterRts: number; cmForecast: number };
    rtsPct: number;
    sf: number;
    ff: number;
    iF: number;
    codFeeDelivered: number;
    cogsAdjusted: number;
    cogsRts: number;
  };
};

type AnalyticsSalesProductsTableProps = {
  isLoading: boolean;
  productStart: number;
  productEnd: number;
  totalProducts: number;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  pageSize: number;
  productPage: number;
  totalProductPages: number;
  rtsForecastSafe: number;
  rows: SalesProductRowItem[];
  sourceCount: number;
  renderSortLabel: (label: ReactNode, key: SalesProductsSortKey) => ReactNode;
};

export function AnalyticsSalesProductsTable({
  isLoading,
  productStart,
  productEnd,
  totalProducts,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  pageSize,
  productPage,
  totalProductPages,
  rtsForecastSafe,
  rows,
  sourceCount,
  renderSortLabel,
}: AnalyticsSalesProductsTableProps) {
  return (
    <AnalyticsTableShell
      summaryLabel={`Showing ${productStart}-${productEnd} of ${totalProducts}`}
      onPrevious={onPrevious}
      onNext={onNext}
      canPrevious={canPrevious}
      canNext={canNext}
      isLoading={isLoading}
      pageIndicatorLabel={`Page ${productPage} of ${totalProductPages}`}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 z-10 w-16 bg-slate-50 px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('#', 'index')}
              </th>
              <th className="sticky left-16 z-10 bg-slate-50 px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Product', 'product')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Gross Revenue', 'revenue')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Gross Sales', 'gross_sales')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('COGS', 'cogs')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('AOV', 'aov')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('CPP', 'cpp')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Processed CPP', 'processed_cpp')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Ad Spend', 'ad_spend')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('AR %', 'ar_pct')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('RTS %', 'rts_pct')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('P.E %', 'profit_efficiency')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Contribution Margin', 'contribution_margin')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel(`CM (RTS ${rtsForecastSafe}% )`, 'cm_rts_forecast')}
              </th>
              <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                {renderSortLabel('Net Margin', 'net_margin')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <AnalyticsTableLoadingRows colCount={15} />
            ) : (
              rows.map((item, idx) => {
                const { row, derived } = item;
                const {
                  display,
                  forecast,
                  rtsPct,
                  sf,
                  ff,
                  iF,
                  codFeeDelivered,
                  cogsAdjusted,
                  cogsRts,
                } = derived;

                return (
                  <tr key={`${row.mapping || 'null'}-${idx}`} className="hover:bg-slate-50">
                    <td className="sticky left-0 z-10 w-16 bg-white px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">
                      {(productPage - 1) * pageSize + idx + 1}.
                    </td>
                    <td className="sticky left-16 z-10 bg-white px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-900 font-medium whitespace-nowrap">
                      {toTitleCase(display)}
                    </td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(row.revenue, 'currency')}</td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(row.gross_sales, 'number', 0)}</td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(row.cogs, 'currency')}</td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(row.aov, 'currency')}</td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(row.cpp, 'currency')}</td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(row.processed_cpp, 'currency')}</td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(row.ad_spend, 'currency')}</td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(row.ar_pct, 'percent', 1)}</td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(rtsPct, 'percent', 1)}</td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(row.profit_efficiency, 'percent', 1)}</td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(row.contribution_margin, 'currency')}</td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">
                      <span
                        title={`CM (RTS ${rtsForecastSafe}%): ${(formatMetricValue(forecast.revenueAfterRts,'currency'))} - ${(formatMetricValue(row.ad_spend ?? 0,'currency'))} - ${(formatMetricValue(sf,'currency'))} - ${(formatMetricValue(ff,'currency'))} - ${(formatMetricValue(iF,'currency'))} - ${(formatMetricValue(codFeeDelivered,'currency'))} - ${(formatMetricValue(cogsAdjusted,'currency'))} + ${(formatMetricValue(cogsRts,'currency'))} = ${(formatMetricValue(forecast.cmForecast,'currency'))}`}
                      >
                        {formatMetricValue(forecast.cmForecast, 'currency')}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatMetricValue(row.net_margin, 'currency')}</td>
                  </tr>
                );
              })
            )}
            {!isLoading && sourceCount === 0 ? (
              <AnalyticsTableEmptyRow colSpan={15} message="No products found for this range." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AnalyticsTableShell>
  );
}
