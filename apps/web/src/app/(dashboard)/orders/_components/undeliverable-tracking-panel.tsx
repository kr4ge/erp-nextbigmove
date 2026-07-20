'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Bike, Clock3, MapPin, Package, PackageSearch, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchUndeliverableTrackingUpdates } from '../_services/undeliverables-api';
import type {
  UndeliverableRow,
  UndeliverableTrackingResponse,
  UndeliverableTrackingUpdate,
} from '../_types/undeliverables';

type UndeliverableTrackingPanelProps = {
  row: UndeliverableRow | null;
  onClose: () => void;
};

function formatTrackingDate(value: string | null) {
  if (!value) return 'Time unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(parsed);
}

function TimelineItem({ item, isLast }: { item: UndeliverableTrackingUpdate; isLast: boolean }) {
  const isProblematic = item.kind === 'problematic';

  return (
    <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0">
      {!isLast ? (
        <span
          aria-hidden="true"
          className="absolute left-[0.94rem] top-8 h-[calc(100%-1rem)] w-px bg-slate-200 dark:bg-border"
        />
      ) : null}
      <span
        className={`relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border ${
          isProblematic
            ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300'
            : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300'
        }`}
      >
        {isProblematic ? <AlertTriangle className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
      </span>

      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-border dark:bg-background-secondary">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Clock3 className="h-3.5 w-3.5" />
              <span>{formatTrackingDate(item.updated_at_local ?? item.updated_at)}</span>
            </div>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
              isProblematic
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
            }`}
          >
            {isProblematic ? 'Problematic' : 'Rider'}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{item.detail}</p>
        {item.location ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="h-3.5 w-3.5" />
            <span>{item.location}</span>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function OrderItemsSummary({ items }: { items: UndeliverableTrackingResponse['order']['order_items'] }) {
  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-surface">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-semibold text-foreground">Order items</h3>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {items.reduce((total, item) => total + item.quantity, 0)} units
        </span>
      </div>

      {items.length > 0 ? (
        <div className="mt-3 divide-y divide-slate-100 dark:divide-border">
          {items.map((item, index) => (
            <div
              key={`${item.product_display_id ?? item.name}-${index}`}
              className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                {item.product_display_id ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {item.product_display_id}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-background-secondary dark:text-slate-200">
                Qty {item.quantity}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No item snapshot is available.</p>
      )}
    </section>
  );
}

export function UndeliverableTrackingPanel({ row, onClose }: UndeliverableTrackingPanelProps) {
  const attemptId = row?.id ?? null;
  const [data, setData] = useState<UndeliverableTrackingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!attemptId) {
      setData(null);
      setError(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    void fetchUndeliverableTrackingUpdates(attemptId)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load delivery activity.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attemptId, reloadKey]);

  const order = data?.order;
  const statusName = order?.status_name ?? row?.status_name;

  return (
    <Dialog open={Boolean(row)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="!left-auto !right-0 !top-0 !h-dvh !w-full !max-w-[32rem] !translate-x-0 !translate-y-0 overflow-hidden !rounded-none border-y-0 border-r-0 !p-0 data-[state=closed]:!slide-out-to-right data-[state=open]:!slide-in-from-right sm:!rounded-l-2xl"
        overlayClassName="bg-[#0d2431]/45"
        closeButtonClassName="right-5 top-5"
      >
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="border-b border-slate-200 px-5 py-5 pr-14 text-left dark:border-border sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Delivery activity</p>
            <DialogTitle className="!mb-0 mt-2 text-xl">
              {row?.tracking || `Order #${row?.pos_order_id ?? ''}`}
            </DialogTitle>
            <DialogDescription className="mt-1">
              Order #{order?.pos_order_id ?? row?.pos_order_id}
              {' · '}
              {order?.store_name ?? row?.store_name}
            </DialogDescription>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {statusName ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-background-secondary dark:text-slate-200">
                  {statusName}
                </span>
              ) : null}
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                Attempt {data?.attempt.attempt_number ?? row?.attempt_number ?? row?.attempt_failed}
              </span>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5 dark:bg-background sm:px-6">
            {isLoading ? (
              <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading delivery activity...
              </div>
            ) : null}

            {!isLoading && error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/70 dark:bg-rose-950/30">
                <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  iconLeft={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={() => setReloadKey((current) => current + 1)}
                >
                  Try again
                </Button>
              </div>
            ) : null}

            {!isLoading && !error && data ? (
              <OrderItemsSummary items={data.order.order_items} />
            ) : null}

            {!isLoading && !error && data?.items.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center dark:border-border dark:bg-surface">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-background-secondary dark:text-slate-300">
                  <PackageSearch className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-foreground">No delivery activity to show</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">
                  No carrier problem notes or rider updates were recorded for this order.
                </p>
              </div>
            ) : null}

            {!isLoading && !error && data && data.items.length > 0 ? (
              <ol>
                {data.items.map((item, index) => (
                  <TimelineItem
                    key={item.key ?? `${item.updated_at ?? 'update'}-${index}`}
                    item={item}
                    isLast={index === data.items.length - 1}
                  />
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
