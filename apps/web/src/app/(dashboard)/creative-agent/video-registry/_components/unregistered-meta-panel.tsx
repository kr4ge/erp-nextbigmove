"use client";

import { AlertTriangle, Link2, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UnregisteredMetaCreative } from "../_types/video-registry";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../_utils/video-registry-formatters";

type Props = {
  items: UnregisteredMetaCreative[];
  onRegister: (item: UnregisteredMetaCreative) => void;
  onLink: (item: UnregisteredMetaCreative) => void;
  canRegister: boolean;
  canLink: boolean;
};

export function UnregisteredMetaPanel({
  items,
  onRegister,
  onLink,
  canRegister,
  canLink,
}: Props) {
  if (items.length === 0) return null;

  const sortedItems = [...items].sort(
    (left, right) => right.spend - left.spend,
  );

  return (
    <section
      className="overflow-hidden rounded-2xl border border-warning/30 bg-warning-soft/30"
      aria-labelledby="unregistered-creatives-title"
    >
      <div className="flex flex-col gap-3 border-b border-warning/20 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h2
              id="unregistered-creatives-title"
              className="font-semibold text-foreground"
            >
              Meta ads not linked to the registry
            </h2>
            <p className="mt-1 text-sm text-muted">
              Match these exact Meta ad names to an existing creative, or enroll
              a new one using the same code.
            </p>
          </div>
        </div>
        <span className="pill self-start border border-warning/30 bg-surface text-warning">
          {items.length} need attention
        </span>
      </div>

      <div className="divide-y divide-warning/20">
        {sortedItems.map((item) => (
          <article
            key={item.key}
            className="grid gap-4 bg-surface/70 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-background-secondary px-2 py-1 text-sm font-semibold text-foreground">
                  {item.adName}
                </code>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  Ad ID{" "}
                  <code className="font-semibold text-foreground">
                    {item.adId}
                  </code>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-warning" />{" "}
                  {formatCurrency(item.spend)} spend
                </span>
                <span>{formatNumber(item.impressions)} impressions</span>
                <span>
                  Seen {formatDate(item.firstSeenAt)} –{" "}
                  {formatDate(item.lastSeenAt)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {canLink ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  iconLeft={<Link2 className="h-4 w-4" />}
                  onClick={() => onLink(item)}
                >
                  Link existing
                </Button>
              ) : null}
              {canRegister ? (
                <Button
                  type="button"
                  size="sm"
                  iconLeft={<Plus className="h-4 w-4" />}
                  onClick={() => onRegister(item)}
                >
                  Enroll new
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
