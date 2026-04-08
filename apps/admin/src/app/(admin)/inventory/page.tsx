"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Layers3,
  Link2,
  Move3D,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import { WmsPageHeader } from "../_components/wms-page-header";
import { WmsSectionCard } from "../_components/wms-section-card";
import { WmsStatCard } from "../_components/wms-stat-card";
import { fetchInventoryOverview } from "./_services/inventory.service";

export default function InventoryPage() {
  const overviewQuery = useQuery({
    queryKey: ["wms-inventory-overview"],
    queryFn: fetchInventoryOverview,
  });

  const overview = overviewQuery.data;
  const defaultWarehouse = overview?.defaultWarehouse || null;

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Inventory"
        description="Stock, sites, and movement."
        eyebrow="Inventory Core"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard
          label="Warehouses"
          value={overview?.warehousesCount || 0}
          description="Mapped operating sites"
          icon={Warehouse}
        />
        <WmsStatCard
          label="Locations"
          value={overview?.locationsCount || 0}
          description="Bins and task points"
          icon={Layers3}
          accent="emerald"
        />
        <WmsStatCard
          label="Lots"
          value={overview?.lotsCount || 0}
          description="Inbound stock lots"
          icon={Move3D}
          accent="amber"
        />
        <WmsStatCard
          label="Balances"
          value={overview?.balancesCount || 0}
          description="Tracked stock balances"
          icon={Building2}
          accent="orange"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
      <WmsSectionCard
        title="Inventory Navigation"
        icon={<Warehouse className="h-3.5 w-3.5" />}
      >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
            <Link
              href="/products"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-orange-200 hover:bg-orange-50"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">Products</p>
                <Link2 className="h-4 w-4 text-orange-500" />
              </div>
            </Link>
            <Link
              href="/inventory/stock"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-orange-200 hover:bg-orange-50"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">Stock</p>
                <ShieldCheck className="h-4 w-4 text-orange-500" />
              </div>
            </Link>
            <Link
              href="/inventory/transfers"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-orange-200 hover:bg-orange-50"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">Transfers</p>
                <Move3D className="h-4 w-4 text-orange-500" />
              </div>
            </Link>
            <Link
              href="/inventory/warehouses"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-orange-200 hover:bg-orange-50"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">Warehouses</p>
                <Warehouse className="h-4 w-4 text-orange-500" />
              </div>
            </Link>
          </div>
        </WmsSectionCard>

        <WmsSectionCard
          title="Default Site"
          icon={<Building2 className="h-3.5 w-3.5" />}
        >
          {overviewQuery.isLoading ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
              Loading site...
            </div>
          ) : defaultWarehouse ? (
            <div className="space-y-3">
              <div>
                <p className="text-base font-semibold text-slate-950">
                  {defaultWarehouse.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{defaultWarehouse.code}</p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Locations
                  </p>
                  <p className="mt-1.5 text-lg font-semibold text-slate-950 tabular-nums">
                    {defaultWarehouse.locationsCount}
                  </p>
                </div>
                <Link
                  href="/inventory/warehouses"
                  className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100"
                >
                  Open Warehouses
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
              No site yet.
            </div>
          )}
        </WmsSectionCard>
      </div>
    </div>
  );
}
