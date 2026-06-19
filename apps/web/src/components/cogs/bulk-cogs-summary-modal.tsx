"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type BulkCogsSummaryItem = {
  id: string;
  name: string | null;
  productId: string | null;
  customId: string | null;
  reason?: string;
};

export interface BulkCogsSummary {
  new: BulkCogsSummaryItem[];
  updated: BulkCogsSummaryItem[];
  failed: BulkCogsSummaryItem[];
}

interface BulkCogsSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: BulkCogsSummary | null;
}

function SummarySection({
  title,
  items,
  tone,
}: {
  title: string;
  items: BulkCogsSummaryItem[];
  tone: "emerald" | "blue" | "rose";
}) {
  const toneClassMap = {
    emerald: "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-100",
    blue: "border-blue-200 bg-blue-50/60 dark:bg-blue-100",
    rose: "border-rose-200 bg-rose-50/60 dark:bg-rose-100",
  } as const;

  return (
    <section className={`card ${toneClassMap[tone]}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-800">None</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="card border border-white/80 bg-white/90 px-3 py-2 dark:bg-white">
              <p className="text-sm font-medium text-slate-900">
                {item.name || item.productId || item.id}
              </p>
              <p className="text-xs text-slate-500">
                {[item.productId, item.customId].filter(Boolean).join(" • ") || item.id}
              </p>
              {item.reason ? <p className="mt-1 text-xs text-rose-700">{item.reason}</p> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function BulkCogsSummaryModal({
  isOpen,
  onClose,
  summary,
}: BulkCogsSummaryModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk COGS Summary</DialogTitle>
          <DialogDescription>
            Review which products were created, updated, or skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3"></div>

        <div className="space-y-4">
          <SummarySection title="New" items={summary?.new || []} tone="emerald" />
          <SummarySection title="Updated" items={summary?.updated || []} tone="blue" />
          <SummarySection title="Failed" items={summary?.failed || []} tone="rose" />
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
