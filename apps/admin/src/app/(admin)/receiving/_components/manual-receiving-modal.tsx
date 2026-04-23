'use client';

import { Loader2, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { WmsModal } from '../../_components/wms-modal';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';

type ManualReceivingLine = {
  id: string;
  profileId: string;
  quantity: number;
};

type ManualReceivingProductOption = {
  id: string;
  label: string;
  variationLabel: string;
  customId: string | number | null;
  hint: string | number | null;
};

type SelectedManualReceivingLine = ManualReceivingLine & {
  product: ManualReceivingProductOption;
};

type ManualReceivingModalProps = {
  open: boolean;
  storeName: string | null;
  warehouseOptions: Array<{
    id: string;
    code: string;
    label: string;
    stagingLocations: Array<{
      id: string;
      code: string;
      label: string;
    }>;
  }>;
  warehouseId: string;
  stagingLocationId: string;
  notes: string;
  lines: ManualReceivingLine[];
  productOptions: ManualReceivingProductOption[];
  isLoadingProducts: boolean;
  isSubmitting: boolean;
  totalUnits: number;
  onClose: () => void;
  onWarehouseChange: (value: string) => void;
  onStagingLocationChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onAddProduct: (profileId: string) => void;
  onRemoveLine: (id: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onSubmit: () => Promise<void>;
};

export function ManualReceivingModal({
  open,
  storeName,
  warehouseOptions,
  warehouseId,
  stagingLocationId,
  notes,
  lines,
  productOptions,
  isLoadingProducts,
  isSubmitting,
  totalUnits,
  onClose,
  onWarehouseChange,
  onStagingLocationChange,
  onNotesChange,
  onAddProduct,
  onRemoveLine,
  onQuantityChange,
  onSubmit,
}: ManualReceivingModalProps) {
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productSearchText, setProductSearchText] = useState('');

  useEffect(() => {
    if (!open) {
      setProductSearchText('');
      setIsProductPickerOpen(false);
      return;
    }

    setProductSearchText('');
    setIsProductPickerOpen(false);
  }, [open]);

  const activeWarehouse = useMemo(
    () => warehouseOptions.find((option) => option.id === warehouseId) ?? null,
    [warehouseId, warehouseOptions],
  );

  const selectedProducts = useMemo(
    () =>
      lines
        .map((line) => ({
          ...line,
          product: productOptions.find((option) => option.id === line.profileId) ?? null,
        }))
        .filter((line): line is SelectedManualReceivingLine => line.product !== null),
    [lines, productOptions],
  );

  const filteredProductOptions = useMemo(() => {
    const needle = productSearchText.trim().toLowerCase();
    if (!needle) {
      return productOptions;
    }

    return productOptions.filter((product) =>
      [
        product.label,
        product.variationLabel,
        product.customId ? String(product.customId) : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [productOptions, productSearchText]);

  function handleOpenPicker() {
    setIsProductPickerOpen(true);
  }

  function handleClosePicker() {
    setProductSearchText('');
    setIsProductPickerOpen(false);
  }

  function handleAddProduct(profileId: string) {
    onAddProduct(profileId);
    setProductSearchText('');
    setIsProductPickerOpen(false);
  }

  if (!open) {
    return null;
  }

  return (
    <WmsModal
      open={open}
      title="Manual Stock Input"
      description={storeName ? `${storeName} · Create staged serialized units without a purchasing batch` : 'Create staged serialized units without a purchasing batch'}
      onClose={onClose}
      panelClassName="w-[min(94vw,1080px)] min-h-[620px] max-h-[calc(100dvh-3.5rem)] sm:min-h-[660px] sm:max-h-[calc(100dvh-4.5rem)]"
      bodyClassName="py-4"
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-[#5f7483]">{totalUnits} units will be created in staging.</p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-[12px] border border-[#d7e0e7] bg-white px-3.5 text-[12px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!warehouseId || !stagingLocationId || totalUnits <= 0 || isSubmitting}
              className="inline-flex h-9 items-center justify-center rounded-[12px] bg-[#12384b] px-4 text-[12px] font-semibold text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create stock batch'}
            </button>
          </div>
        </div>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="overflow-hidden rounded-[18px] border border-[#dce4ea] bg-white">
            <div className="border-b border-[#e7edf2] px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">
                  Products
                </p>
                <p className="mt-1 text-[12px] text-[#637786]">
                  {selectedProducts.length} lines · {totalUnits} units
                </p>
              </div>
            </div>

            {selectedProducts.length > 0 ? (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-[#edf2f6] text-[13px]">
                  <thead className="bg-[#f8fafb] text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a8f9d]">
                    <tr>
                      <th className="px-4 py-2.5">Product</th>
                      <th className="px-4 py-2.5">Reference</th>
                      <th className="px-4 py-2.5 text-right">Qty</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf2f6] bg-white">
                    {selectedProducts.map((line) => (
                      <tr key={line.id} className="align-top">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#12384b]">{line.product.label}</p>
                          <p className="mt-0.5 text-[12px] text-[#708492]">{line.product.variationLabel}</p>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#5f7483]">
                          {line.product.customId || line.product.hint || 'No reference'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(event) => onQuantityChange(line.id, Number(event.target.value))}
                            className="h-9 w-20 rounded-[12px] border border-[#d7e0e7] bg-white px-3 text-right text-[13px] font-semibold text-[#12384b] outline-none transition focus:border-[#96b4c3]"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onRemoveLine(line.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#f2d8d8] bg-white text-[#b44b4b] transition hover:bg-[#fff4f4]"
                            aria-label={`Remove ${line.product.label}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !isProductPickerOpen ? (
              <div className="px-4 pt-4">
                <AddProductCallout
                  label="Build this stock batch by selecting products"
                  actionLabel="Add product"
                  onClick={handleOpenPicker}
                />
              </div>
            ) : null}

            {isProductPickerOpen ? (
              <div className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <label className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8193a0]" />
                    <input
                      value={productSearchText}
                      onChange={(event) => setProductSearchText(event.target.value)}
                      placeholder="Search products in the selected store"
                      className="h-10 w-full rounded-[12px] border border-[#d7e0e7] bg-white pl-9 pr-3 text-[13px] text-[#12384b] outline-none transition placeholder:text-[#94a3b8] focus:border-[#96b4c3]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleClosePicker}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#d7e0e7] bg-white text-[#567383] transition hover:border-[#c8d6df] hover:bg-[#f8fafb]"
                    aria-label="Close product picker"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 max-h-[260px] overflow-y-auto rounded-[14px] border border-[#dce4ea] bg-white">
                  {isLoadingProducts ? (
                    <div className="px-4 py-10 text-center text-[13px] text-[#708492]">Loading products…</div>
                  ) : filteredProductOptions.length === 0 ? (
                    <div className="px-4 py-10 text-center text-[13px] text-[#708492]">No products found</div>
                  ) : (
                    <ul className="divide-y divide-[#edf2f6]">
                      {filteredProductOptions.map((product) => (
                        <li key={product.id}>
                          <button
                            type="button"
                            onClick={() => handleAddProduct(product.id)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#f8fafb]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-[#12384b]">{product.label}</p>
                              <p className="mt-0.5 truncate text-[12px] text-[#708492]">
                                {product.variationLabel}
                                {product.customId ? ` · ${product.customId}` : ''}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-2.5 py-1 text-[11px] font-semibold text-[#4d6677]">
                              Add
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}

            {selectedProducts.length > 0 && !isProductPickerOpen ? (
              <div className="border-t border-[#e7edf2] px-4 py-4">
                <AddProductCallout
                  label="Add another product to this stock batch"
                  actionLabel="Add product"
                  onClick={handleOpenPicker}
                />
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-3">
          <div className="rounded-[18px] border border-[#dce4ea] bg-white px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Intake Settings</p>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8193a0]">Warehouse</p>
                <WmsSearchableSelect
                  label="Warehouse"
                  value={warehouseId}
                  onChange={onWarehouseChange}
                  options={warehouseOptions.map((option) => ({
                    value: option.id,
                    label: `${option.code} · ${option.label}`,
                    hint: option.stagingLocations.length,
                  }))}
                  allLabel="Select warehouse"
                  clearable={false}
                  hideInlineLabel
                  triggerClassName="h-11 w-full justify-between rounded-[14px] pl-4 pr-3"
                  valueClassName="max-w-none flex-1 text-left"
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8193a0]">Staging</p>
                <WmsSearchableSelect
                  label="Staging"
                  value={stagingLocationId}
                  onChange={onStagingLocationChange}
                  options={(activeWarehouse?.stagingLocations ?? []).map((location) => ({
                    value: location.id,
                    label: `${location.code} · ${location.label}`,
                  }))}
                  allLabel="Select staging"
                  clearable={false}
                  hideInlineLabel
                  triggerClassName="h-11 w-full justify-between rounded-[14px] pl-4 pr-3"
                  valueClassName="max-w-none flex-1 text-left"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-[#dce4ea] bg-white px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Notes</p>
            <textarea
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              rows={5}
              placeholder="Optional intake notes or audit context"
              className="mt-3 w-full rounded-[14px] border border-[#d7e0e7] bg-[#fbfcfc] px-3 py-2.5 text-[13px] text-[#12384b] outline-none transition placeholder:text-[#94a3b8] focus:border-[#96b4c3]"
            />
          </div>
        </aside>
      </div>
    </WmsModal>
  );
}

function AddProductCallout({
  label,
  actionLabel,
  onClick,
}: {
  label: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-[16px] border border-dashed border-[#ced9e1] bg-[#f8fafb] px-4 py-5 text-center transition hover:border-[#b8c8d4] hover:bg-[#f4f8fa]"
    >
      <span className="text-[13px] font-medium text-[#5f7483]">{label}</span>
      <span className="px-1.5 text-[13px] text-[#8193a0]">or</span>
      <span className="text-[13px] font-semibold text-[#12384b] group-hover:text-[#0f3242]">{actionLabel}</span>
    </button>
  );
}
