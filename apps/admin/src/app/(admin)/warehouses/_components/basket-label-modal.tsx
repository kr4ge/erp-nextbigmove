'use client';

import { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCcw, ShoppingBasket } from 'lucide-react';
import { WmsModal } from '../../_components/wms-modal';
import type { WmsWarehouseBasket, WmsWarehouseDetail } from '../_types/warehouse';
import { normalizeBarcodeValue, renderCode128SvgMarkup } from '../_utils/code39-barcode';
import { printBasketLabel } from '../_utils/print-basket-label';

type BasketLabelModalProps = {
  open: boolean;
  warehouse: WmsWarehouseDetail | null;
  basket: WmsWarehouseBasket | null;
  onClose: () => void;
};

export function BasketLabelModal({ open, warehouse, basket, onClose }: BasketLabelModalProps) {
  const [printError, setPrintError] = useState<string | null>(null);
  const [lastPrintAction, setLastPrintAction] = useState<'print' | 'reprint' | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPrintError(null);
    setLastPrintAction(null);
  }, [open, basket?.id]);

  const barcodeValue = normalizeBarcodeValue(basket?.barcode ?? '');
  const barcodeMarkup = useMemo(() => {
    if (!barcodeValue) {
      return '';
    }

    return renderCode128SvgMarkup(barcodeValue, {
      height: 112,
      moduleWidth: 2,
      quietZone: 24,
      textSize: 16,
    });
  }, [barcodeValue]);

  const handlePrint = (action: 'print' | 'reprint') => {
    if (!warehouse || !basket) {
      return;
    }

    try {
      setPrintError(null);
      printBasketLabel({
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        basketBarcode: basket.barcode,
        basketStatus: basket.status,
      });
      setLastPrintAction(action);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open print dialog';
      setPrintError(message);
    }
  };

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-[#637786]">
        {lastPrintAction
          ? `${lastPrintAction === 'print' ? 'Printed' : 'Reprinted'} label for ${basket?.barcode}`
          : 'Print or reprint the basket label when needed.'}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => handlePrint('print')}
          disabled={!warehouse || !basket}
          className="btn btn-md btn-outline btn-icon"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
        <button
          type="button"
          onClick={() => handlePrint('reprint')}
          disabled={!warehouse || !basket}
          className="btn btn-md btn-primary btn-icon"
        >
          <RefreshCcw className="h-4 w-4" />
          Reprint
        </button>
      </div>
    </div>
  );

  return (
    <WmsModal
      open={open && Boolean(warehouse && basket)}
      onClose={onClose}
      title={basket ? `${basket.barcode}` : 'Basket'}
      footer={footer}
      panelClassName="w-[min(96vw,760px)]"
    >
      {warehouse && basket ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
            <div className="card bg-[#fbfcfc]">
              <div className="card">
                <div
                  className="flex justify-center"
                  dangerouslySetInnerHTML={{ __html: barcodeMarkup }}
                />
              </div>

              <div className="card mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7a8f9d]">
                  Barcode Value
                </p>
                <p className="mt-1 break-all text-[12px] font-medium text-primary">{barcodeValue}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <MetaItem label="Warehouse" value={`${warehouse.name} (${warehouse.code})`} />
              <MetaItem label="Status" value={formatBasketStatus(basket.status)} />
              <MetaItem
                label="Picker"
                value={basket.assignedPicker ? `${basket.assignedPicker.name} · ${basket.assignedPicker.email}` : 'Not assigned'}
              />
              <MetaItem
                label="Order"
                value={basket.fulfillmentOrder ? `#${basket.fulfillmentOrder.posOrderId}` : 'No active order'}
              />
            </div>
          </div>

          <div className="rounded-[16px] border border-[#dce4ea] bg-white px-3 py-3">
            <div className="flex items-start gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2f7f4] text-success">
                <ShoppingBasket className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-primary">Registered warehouse basket</p>
                <p className="mt-1 text-[11px] leading-5 text-[#637786]">
                  STOX can only use baskets registered here. Print this label and attach it to the physical basket before pickers scan it.
                </p>
              </div>
            </div>
          </div>

          {printError ? (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
              {printError}
            </div>
          ) : null}
        </div>
      ) : null}
    </WmsModal>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="card-label">{label}</p>
      <p className="card-value text-base">{value}</p>
    </div>
  );
}

function formatBasketStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
