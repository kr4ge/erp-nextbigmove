'use client';

import { ClipboardList, Package } from 'lucide-react';

export type StoreDetailTab = 'products' | 'orders';

interface StoreDetailTabSwitcherProps {
  activeTab: StoreDetailTab;
  productsCount: number;
  ordersCount: number;
  onTabChange: (tab: StoreDetailTab) => void;
}

export function StoreDetailTabSwitcher({
  activeTab,
  productsCount,
  ordersCount,
  onTabChange,
}: StoreDetailTabSwitcherProps) {
  return (
    <div className="border-b border-slate-200">
      <div className="flex gap-1">
        <button
          onClick={() => onTabChange('products')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'products'
              ? 'border-b-2 border-indigo-500 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          Products
          {productsCount > 0 && (
            <span
              className={`rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums ${
                activeTab === 'products'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {productsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onTabChange('orders')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'orders'
              ? 'border-b-2 border-indigo-500 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Orders
          {ordersCount > 0 && (
            <span
              className={`rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums ${
                activeTab === 'orders'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {ordersCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

