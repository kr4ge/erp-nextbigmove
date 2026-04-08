"use client";

import Link from "next/link";
import {
  Barcode,
  BookCopy,
  PenSquare,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { WmsPageHeader } from "../../_components/wms-page-header";
import { WmsSectionCard } from "../../_components/wms-section-card";

const STOCK_LINKS = [
  {
    href: "/inventory/balances",
    label: "Balances",
    description: "Current on-hand, reserved, and available stock.",
    icon: ShieldCheck,
  },
  {
    href: "/inventory/units",
    label: "Units",
    description: "Serialized pieces and printable batch labels.",
    icon: Barcode,
  },
  {
    href: "/inventory/lots",
    label: "Lots & COGS",
    description: "Receipt batches and inbound cost layers.",
    icon: BookCopy,
  },
  {
    href: "/inventory/ledger",
    label: "Ledger",
    description: "Immutable movement history across stock events.",
    icon: ScrollText,
  },
  {
    href: "/inventory/adjustments",
    label: "Manual Inbound / Corrections",
    description: "Exceptional inbound fallback and stock corrections.",
    icon: PenSquare,
  },
];

export default function InventoryStockPage() {
  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Stock"
        description="Serialized units, balances, lots, ledger, and exceptional manual corrections."
        eyebrow="Inventory Core"
      />

      <WmsSectionCard title="Stock Workspace" metadata={`${STOCK_LINKS.length} areas`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STOCK_LINKS.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-orange-200 hover:bg-orange-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.description}
                    </p>
                  </div>
                  <Icon className="h-5 w-5 text-orange-500" />
                </div>
              </Link>
            );
          })}
        </div>
      </WmsSectionCard>
    </div>
  );
}
