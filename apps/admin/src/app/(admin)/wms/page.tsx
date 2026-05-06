'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Boxes, PackageSearch, ScanLine, SlidersHorizontal, Warehouse } from 'lucide-react';
import { WmsCompactPanel } from '../_components/wms-compact-panel';
import { WmsReadinessCard } from '../_components/wms-readiness-card';
import { fetchWmsBootstrap, type WmsBootstrapResponse } from '@/lib/wms-service';

const readinessCards = [
  { key: 'posStores', label: 'Stores', icon: Warehouse, tone: 'teal' as const },
  { key: 'posWarehouses', label: 'Warehouses', icon: Boxes, tone: 'yellow' as const },
  { key: 'posProducts', label: 'Products', icon: PackageSearch, tone: 'lavender' as const },
] as const satisfies ReadonlyArray<{
  key: keyof WmsBootstrapResponse['readiness'];
  label: string;
  icon: typeof Warehouse;
  tone: 'teal' | 'yellow' | 'lavender';
}>;

const setupChips = ['Access', 'Warehouses', 'Products', 'Receiving', 'Inventory'];
const planModules = ['Partners', 'Purchasing', 'Warehouses', 'Products', 'Receiving', 'Inventory'];

export default function WmsHomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['wms-core-bootstrap'],
    queryFn: fetchWmsBootstrap,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3.5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="wms-page-title font-semibold tracking-tight text-[#12384b]">Dashboard</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="wms-pill-control inline-flex items-center gap-3 rounded-full border border-[#d7e0e7] bg-white px-4 font-medium text-[#1d4b61] shadow-[0_14px_35px_-30px_rgba(18,56,75,0.55)]"
          >
            <ArrowUpDown className="h-4 w-4" />
            Sort by
          </button>
          <button
            type="button"
            className="wms-pill-control inline-flex items-center gap-3 rounded-full border border-[#d7e0e7] bg-white px-4 font-medium text-[#1d4b61] shadow-[0_14px_35px_-30px_rgba(18,56,75,0.55)]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          Unable to load dashboard.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(286px,0.72fr)]">
        <WmsCompactPanel title="Foundation">
          <div className="grid gap-3.5 md:grid-cols-3">
            {readinessCards.map((card) => (
              <WmsReadinessCard
                key={card.key}
                icon={card.icon}
                label={card.label}
                tone={card.tone}
                value={isLoading ? 0 : data?.readiness?.[card.key] ?? 0}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {setupChips.map((chip) => (
              <span
                key={chip}
                className="wms-chip rounded-full border border-[#dce4ea] bg-[#fbfcfc] font-medium text-[#4d6677]"
              >
                {chip}
              </span>
            ))}
          </div>
        </WmsCompactPanel>

        <div className="space-y-4">
          <section className="wms-surface overflow-hidden border border-[#d6e0c7] bg-[linear-gradient(135deg,#eef5df_0%,#e6eed0_44%,#f7edc1_100%)] shadow-[0_24px_60px_-42px_rgba(18,56,75,0.36)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="wms-section-title mt-1 font-semibold tracking-tight text-[#12384b]">Inventory</h2>
              </div>
              <span className="wms-chip rounded-full border border-white/65 bg-white/70 font-medium text-[#1d4b61]">
                Serialized
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="wms-chip rounded-full bg-[#12384b] font-medium text-white">Unit</span>
              <span className="wms-chip rounded-full border border-white/70 bg-white/70 font-medium text-[#1d4b61]">
                Movement
              </span>
              <span className="wms-chip rounded-full border border-white/70 bg-white/70 font-medium text-[#1d4b61]">
                Receiving
              </span>
            </div>
          </section>

          <WmsCompactPanel title="Session">
            <div className="flex items-center justify-between rounded-[20px] border border-[#dce4ea] bg-[#fbfcfc] px-4 py-3.5">
              <div>
                <p className="text-[13px] font-semibold text-[#12384b]">
                  {data?.tenantReady ? 'Partner context ready' : 'Partner context pending'}
                </p>
                <p className="mt-1 text-[12px] text-[#617685]">{data?.context?.userRole ?? 'Unknown role'}</p>
              </div>
              <div className="rounded-full bg-[#12384b] p-2.5 text-white">
                <ScanLine className="h-4 w-4" />
              </div>
            </div>
          </WmsCompactPanel>

          <WmsCompactPanel title="Modules">
            <div className="flex flex-wrap gap-2">
              {planModules.map((label) => (
                <span
                  key={label}
                  className="wms-chip rounded-full border border-[#dce4ea] bg-[#fbfcfc] font-medium text-[#4d6677]"
                >
                  {label}
                </span>
              ))}
              {isLoading ? (
                <span className="wms-chip rounded-full border border-[#dce4ea] bg-[#fbfcfc] font-medium text-[#4d6677]">
                  Loading
                </span>
              ) : null}
            </div>
          </WmsCompactPanel>
        </div>
      </section>
    </div>
  );
}
