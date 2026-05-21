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
  const [selectedBasket, setSelectedBasket] = useState<WmsWarehouseBasket | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    await onCreate({ barcode: barcode.trim() || undefined });
    setBarcode('');
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
          <button
            type="submit"
            disabled={isSaving || !warehouse}
            className="inline-flex h-12 items-center justify-center rounded-[14px] bg-primary px-4 text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Register basket"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>

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
  const isLocked = Boolean(basket.fulfillmentOrder);

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
        </div>

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
  );
}

function formatBasketStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
