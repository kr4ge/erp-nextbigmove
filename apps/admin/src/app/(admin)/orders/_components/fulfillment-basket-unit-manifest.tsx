'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Barcode, Search } from 'lucide-react';
import type { WmsFulfillmentBasketPackPlan } from '../_types/fulfillment';

type BasketUnit = WmsFulfillmentBasketPackPlan['units'][number];

export function FulfillmentBasketUnitManifest({
  units,
}: {
  units: BasketUnit[];
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUnits = useMemo(() => {
    if (!normalizedQuery) {
      return units;
    }

    return units.filter((unit) => [
      unit.productName,
      unit.productDisplayId,
      unit.barcode,
      unit.code,
      unit.assignedOrder?.posOrderId,
    ].some((value) => value?.toLowerCase().includes(normalizedQuery)));
  }, [normalizedQuery, units]);
  const packedCount = units.filter((unit) => unit.status === 'PACKED').length;

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-border/20 bg-secondary/20 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Barcode className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Basket item barcodes</h3>
            <p className="mt-1 text-sm text-muted">
              {units.length} item{units.length === 1 ? '' : 's'} in this basket · {packedCount} packed
            </p>
          </div>
        </div>

        <label className="relative block w-full lg:max-w-sm">
          <span className="sr-only">Search basket items</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search barcode, item, or order"
            className="input py-2.5 pl-10"
          />
        </label>
      </div>

      {filteredUnits.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-secondary/20">
              <tr className="border-b border-border/20">
                <HeaderCell>#</HeaderCell>
                <HeaderCell>Item</HeaderCell>
                <HeaderCell>Scannable barcode</HeaderCell>
                <HeaderCell>Inventory code</HeaderCell>
                <HeaderCell>Order</HeaderCell>
                <HeaderCell>Status</HeaderCell>
              </tr>
            </thead>
            <tbody className="bg-surface">
              {filteredUnits.map((unit, index) => (
                <tr key={unit.id} className="border-b border-border/10 last:border-b-0 hover:bg-secondary/10">
                  <BodyCell className="text-muted tabular-nums">{index + 1}</BodyCell>
                  <BodyCell>
                    <p className="max-w-xs truncate font-semibold text-foreground" title={unit.productName}>
                      {unit.productName}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {unit.productDisplayId ?? unit.variationId}
                    </p>
                  </BodyCell>
                  <BodyCell>
                    <code className="whitespace-nowrap rounded-lg bg-primary-soft px-2.5 py-1.5 text-sm font-semibold text-primary">
                      {unit.scannableCode ?? 'No barcode'}
                    </code>
                  </BodyCell>
                  <BodyCell>
                    <span className="whitespace-nowrap font-mono text-sm text-foreground">
                      {unit.code ?? '—'}
                    </span>
                  </BodyCell>
                  <BodyCell>
                    <span className="whitespace-nowrap font-semibold text-foreground">
                      {unit.assignedOrder ? `#${unit.assignedOrder.posOrderId}` : 'Basket pool'}
                    </span>
                  </BodyCell>
                  <BodyCell>
                    <span className={`pill ${unit.status === 'PACKED' ? 'pill-success' : 'pill-info'}`}>
                      {unit.status === 'PACKED' ? 'Packed' : 'Ready'}
                    </span>
                  </BodyCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">No matching basket items</p>
          <p className="mt-1 text-sm text-muted">Try a different barcode, item name, or order number.</p>
        </div>
      )}
    </section>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return (
    <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </th>
  );
}

function BodyCell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-5 py-3.5 text-sm ${className}`}>
      {children}
    </td>
  );
}
