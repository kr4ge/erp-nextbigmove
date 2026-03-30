'use client';

import dynamic from 'next/dynamic';
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Calendar className="h-3 w-3" />
            <span>Filter by date range</span>
          </div>
          <div className="relative w-full max-w-sm">
            <Datepicker
              value={dateRange as never}
              onChange={(value: unknown) => {
                if (!value || typeof value !== 'object') {
                  onDateRangeChange({ startDate: null, endDate: null });
                  return;
                }
                onDateRangeChange(value as StoreOrderDateRange);
              }}
              inputClassName="w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-10 py-1.5 text-xs focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              containerClassName="w-full"
              displayFormat="YYYY-MM-DD"
              toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer"
              placeholder=""
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

