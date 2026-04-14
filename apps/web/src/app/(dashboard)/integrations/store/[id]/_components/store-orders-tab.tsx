'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/ui/emptystate';
import { Calendar, ClipboardList, ShoppingBag } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import type { Order } from '../order-columns';
import type { StoreOrderDateRange } from '../../../_types/store-detail';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

interface StoreOrdersTabProps {
  orders: Order[];
  ordersLoading: boolean;
  table: Table<Order>;
  dateRange: StoreOrderDateRange;
  onDateRangeChange: (value: StoreOrderDateRange) => void;
}

export function StoreOrdersTab({
  orders,
  ordersLoading,
  table,
  dateRange,
  onDateRangeChange,
}: StoreOrdersTabProps) {
  const todayYmd = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const { showRangeText, rangeLabel } = useMemo(() => {
    const toYmd = (value: string | Date | null) => {
      if (!value) return null;
      if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      if (Number.isNaN(value.getTime())) return null;
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startYmd = toYmd(dateRange.startDate);
    const endYmd = toYmd(dateRange.endDate);

    if (!startYmd || !endYmd) {
      return { showRangeText: false, rangeLabel: '' };
    }

    const isTodayRange = startYmd === todayYmd && endYmd === todayYmd;
    if (isTodayRange) {
      return { showRangeText: false, rangeLabel: '' };
    }

    const formatRangeDate = (ymd: string) => {
      const [year, month, day] = ymd.split('-');
      if (!year || !month || !day) return ymd;
      return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
    };

    const label =
      startYmd === endYmd
        ? formatRangeDate(startYmd)
        : `${formatRangeDate(startYmd)} - ${formatRangeDate(endYmd)}`;

    return { showRangeText: true, rangeLabel: label };
  }, [dateRange.endDate, dateRange.startDate, todayYmd]);

  return (
    <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Orders</h4>
        {orders.length > 0 && (
          <span className="ml-auto text-[10px] text-slate-500">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative">
            <Datepicker
              value={dateRange as never}
              useRange={false}
              asSingle={false}
              showShortcuts={false}
              showFooter={false}
              primaryColor="orange"
              readOnly
              onChange={(value: unknown) => {
                if (!value || typeof value !== 'object') {
                  onDateRangeChange({ startDate: null, endDate: null });
                  return;
                }
                onDateRangeChange(value as StoreOrderDateRange);
              }}
              inputClassName={`h-10 cursor-pointer rounded-xl border border-slate-200 bg-white p-0 text-transparent caret-transparent placeholder:text-transparent shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 transition-[width] duration-300 ease-out ${
                showRangeText ? 'w-[236px]' : 'w-10'
              }`}
              displayFormat="MM/DD/YYYY"
              separator=" – "
              toggleIcon={() => (
                <span className="flex w-full items-center gap-2 overflow-hidden">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span
                    className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out ${
                      showRangeText
                        ? 'max-w-[184px] translate-x-0 opacity-100'
                        : 'max-w-0 -translate-x-1 opacity-0'
                    }`}
                  >
                    {rangeLabel}
                  </span>
                </span>
              )}
              toggleClassName="absolute inset-0 flex items-center justify-start px-3 text-slate-600 hover:text-orange-700 cursor-pointer"
              containerClassName=""
              popupClassName={(defaultClass: string) => `${defaultClass} z-50 kpi-datepicker-light`}
              placeholder=" "
            />
          </div>
        </div>

        {ordersLoading ? (
          <div className="py-6 text-center text-xs text-slate-500">Loading orders...</div>
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders found"
            description="Adjust the date range or sync workflows to load POS orders."
            icon={<ShoppingBag className="h-8 w-8" />}
          />
        ) : (
          <DataTable table={table} />
        )}
      </div>
    </section>
  );
}

