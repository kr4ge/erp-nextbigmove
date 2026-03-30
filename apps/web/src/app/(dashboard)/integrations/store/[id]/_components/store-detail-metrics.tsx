'use client';

import { MetricCard } from '@/components/ui/card';
import { BarChart3, ClipboardList, DollarSign, Package } from 'lucide-react';
import type { PosStore } from '../../../_types/store-detail';

interface StoreDetailMetricsProps {
  store: PosStore;
  productsCount: number;
  ordersCount: number;
  createdAtLabel: string;
}

function formatInitialOffer(value: number | null | undefined) {
  if (value === undefined || value === null) return '—';
  return `₱${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function StoreDetailMetrics({
  store,
  productsCount,
  ordersCount,
  createdAtLabel,
}: StoreDetailMetricsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <MetricCard
        label="Products"
        value={productsCount}
        helper="Synced variations"
        icon={<Package className="h-5 w-5" />}
        tone="default"
      />
      <MetricCard
        label="Orders"
        value={ordersCount}
        helper="In date range"
        icon={<ClipboardList className="h-5 w-5" />}
        tone="default"
      />
      <MetricCard
        label="Initial Offer"
        value={formatInitialOffer(store.initialValueOffer)}
        helper="Per order"
        icon={<DollarSign className="h-5 w-5" />}
        tone="success"
      />
      <MetricCard
        label="Status"
        value={store.status || 'ACTIVE'}
        helper={`Created ${createdAtLabel}`}
        icon={<BarChart3 className="h-5 w-5" />}
        tone="default"
      />
    </div>
  );
}

