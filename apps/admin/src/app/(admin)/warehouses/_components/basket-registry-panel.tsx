'use client';

import { useState, type FormEvent } from 'react';
import { Plus, ShoppingBasket } from 'lucide-react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import { BasketLabelModal } from './basket-label-modal';
import type {
  CreateWmsBasketInput,
  UpdateWmsBasketInput,
  WmsBasketStatus,
  WmsWarehouseBasket,
  WmsWarehouseDetail,
} from '../_types/warehouse';

const EDITABLE_STATUSES: WmsBasketStatus[] = ['AVAILABLE', 'DAMAGED', 'RETIRED'];
const BASKET_CAPACITY_OPTIONS = Array.from({ length: 20 }, (_, index) => index + 1);

type BasketRegistryPanelProps = {
  warehouse: WmsWarehouseDetail | null;
  isSaving: boolean;
  onCreate: (input: CreateWmsBasketInput) => Promise<void>;
  onUpdate: (id: string, input: UpdateWmsBasketInput) => Promise<void>;
};

export function BasketRegistryPanel({
  warehouse,
  isSaving,
  onCreate,
  onUpdate,
}: BasketRegistryPanelProps) {
  const [barcode, setBarcode] = useState('');
  const [maxFulfillmentOrders, setMaxFulfillmentOrders] = useState('1');
  const [selectedBasket, setSelectedBasket] = useState<WmsWarehouseBasket | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    await onCreate({
      barcode: barcode.trim() || undefined,
      maxFulfillmentOrders: Number(maxFulfillmentOrders) || 1,
    });
    setBarcode('');
    setMaxFulfillmentOrders('1');
  };

  const baskets = warehouse?.baskets ?? [];

  return (
    <WmsCompactPanel title="Basket Registry" icon={<ShoppingBasket className='panel-icon' />}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <BasketMetric label="Available" value={baskets.filter((basket) => basket.status === 'AVAILABLE').length} />
          <BasketMetric label="In use" value={baskets.filter((basket) => ['ASSIGNED', 'IN_PICKING'].includes(basket.status)).length} />
          <BasketMetric label="Held" value={baskets.filter((basket) => basket.status === 'FULL_HELD').length} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            placeholder="Auto or scan barcode"
            className="input"
          />
          <select
            value={maxFulfillmentOrders}
            onChange={(event) => setMaxFulfillmentOrders(event.target.value)}
            className="h-12 w-24 rounded-[14px] border border-[#d7e0e7] bg-white px-3 text-[12px] font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            aria-label="Basket order capacity"
            title="Basket order capacity"
          >
            {BASKET_CAPACITY_OPTIONS.map((capacity) => (
              <option key={capacity} value={capacity}>
                {capacity} order{capacity === 1 ? '' : 's'}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isSaving || !warehouse}
            className="inline-flex h-12 items-center justify-center rounded-[14px] bg-primary px-4 text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Register basket"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>

        <p className="text-[11px] leading-5 text-[#7b8e9c]">
          Order capacity controls how many active fulfillment orders a basket can carry at once.
        </p>

        {baskets.length ? (
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {baskets.map((basket) => (
              <BasketRow
                key={basket.id}
                basket={basket}
                isSaving={isSaving}
                onUpdate={onUpdate}
                onOpen={setSelectedBasket}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-4 py-5 text-center">
            <ShoppingBasket className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-2 text-[12px] font-semibold text-primary">No baskets registered</p>
            <p className="mt-1 text-[11px] text-[#7b8e9c]">Add baskets here before pickers can scan them in STOX.</p>
          </div>
        )}
      </div>

      <BasketLabelModal
        open={Boolean(selectedBasket)}
        warehouse={warehouse}
        basket={selectedBasket}
        onClose={() => setSelectedBasket(null)}
      />
    </WmsCompactPanel>
  );
}

function BasketMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="card-label">{label}</p>
      <p className="card-value">{value}</p>
    </div>
  );
}

function BasketRow({
  basket,
  isSaving,
  onUpdate,
  onOpen,
}: {
  basket: WmsWarehouseBasket;
  isSaving: boolean;
  onUpdate: (id: string, input: UpdateWmsBasketInput) => Promise<void>;
  onOpen: (basket: WmsWarehouseBasket) => void;
}) {
  const activeFulfillmentOrders = basket.activeFulfillmentOrders ?? (basket.fulfillmentOrder ? 1 : 0);
  const isLocked = activeFulfillmentOrders > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(basket)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(basket);
        }
      }}
      className="block w-full rounded-2xl border border-[#dce4ea] bg-white px-3 py-2.5 text-left transition hover:border-[#c7d5de] hover:bg-[#fbfcfc] focus:outline-none focus:ring-2 focus:ring-primary/15"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-primary">{basket.barcode}</p>
          <p className="mt-0.5 text-[11px] text-[#7b8e9c]">
            {basket.fulfillmentOrder
              ? `Order #${basket.fulfillmentOrder.posOrderId}`
              : basket.assignedPicker
                ? basket.assignedPicker.name
                : 'Ready for picking'}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a9aa6]">
            {activeFulfillmentOrders}/{basket.maxFulfillmentOrders} order slot{basket.maxFulfillmentOrders === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <select
            value={basket.maxFulfillmentOrders}
            disabled={isSaving || isLocked}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              void onUpdate(basket.id, { maxFulfillmentOrders: Number(event.target.value) || 1 });
            }}
            className="h-9 rounded-[12px] border border-[#d7e0e7] bg-white px-2 text-[11px] font-bold text-primary disabled:cursor-not-allowed disabled:bg-[#f3f6f8] disabled:text-[#8a9aa6]"
            aria-label={`Order capacity for ${basket.barcode}`}
            title="Order capacity"
          >
            {BASKET_CAPACITY_OPTIONS.map((capacity) => (
              <option key={capacity} value={capacity}>
                {capacity}
              </option>
            ))}
          </select>

          <select
            value={basket.status}
            disabled={isSaving || isLocked}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              void onUpdate(basket.id, { status: event.target.value as WmsBasketStatus });
            }}
            className="h-9 rounded-[12px] border border-[#d7e0e7] bg-white px-2 text-[11px] font-bold text-primary disabled:cursor-not-allowed disabled:bg-[#f3f6f8] disabled:text-[#8a9aa6]"
          >
            {isLocked ? (
              <option value={basket.status}>{formatBasketStatus(basket.status)}</option>
            ) : (
              EDITABLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatBasketStatus(status)}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
    </div>
  );
}

function formatBasketStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
