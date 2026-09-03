'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, PackageSearch, ShieldCheck } from 'lucide-react';
import {
  adjustWmsFulfillmentItems,
  fetchWmsFulfillmentAdjustmentOptions,
} from '../_services/fulfillment.service';
import type {
  WmsFulfillmentAdjustmentOption,
  WmsFulfillmentQueueTask,
} from '../_types/fulfillment';

type FulfillmentItemAdjustmentSectionProps = {
  task: WmsFulfillmentQueueTask;
  canAdjust: boolean;
  onApplied?: () => Promise<unknown> | unknown;
};

const REMOVE_FROM_SHIPMENT_VALUE = '__REMOVE_FROM_SHIPMENT__';

export function FulfillmentItemAdjustmentSection({
  task,
  canAdjust,
  onApplied,
}: FulfillmentItemAdjustmentSectionProps) {
  const activeAdjustments = useMemo(
    () => task.fulfillmentAdjustment?.items ?? [],
    [task.fulfillmentAdjustment?.items],
  );
  const adjustableLines = useMemo(
    () => task.lines.filter((line) => {
      const alreadyAdjusted = activeAdjustments
        .filter((adjustment) => adjustment.sourceVariationId === line.variationId)
        .reduce((sum, adjustment) => sum + adjustment.quantity, 0);
      return Math.min(line.required, Math.max(line.sourceRequired - alreadyAdjusted, 0)) > 0;
    }),
    [activeAdjustments, task.lines],
  );
  const defaultLine = adjustableLines.find((line) => line.shortage > 0) ?? adjustableLines[0] ?? null;
  const [isEditing, setIsEditing] = useState(false);
  const [sourceLineId, setSourceLineId] = useState(defaultLine?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [replacementChoice, setReplacementChoice] = useState('');
  const [reason, setReason] = useState('');
  const [options, setOptions] = useState<WmsFulfillmentAdjustmentOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sourceLine = adjustableLines.find((line) => line.id === sourceLineId) ?? defaultLine;
  const sourceAdjustedQuantity = activeAdjustments
    .filter((adjustment) => adjustment.sourceVariationId === sourceLine?.variationId)
    .reduce((sum, adjustment) => sum + adjustment.quantity, 0);
  const sourceAdjustableQuantity = Math.min(
    sourceLine?.required ?? 0,
    Math.max((sourceLine?.sourceRequired ?? 0) - sourceAdjustedQuantity, 0),
  );
  const action: 'BYPASS' | 'SUBSTITUTION' = replacementChoice === REMOVE_FROM_SHIPMENT_VALUE
    ? 'BYPASS'
    : 'SUBSTITUTION';
  const substitute = options.find((option) => option.variationId === replacementChoice) ?? null;
  const eligibleOptions = options.filter((option) => option.variationId !== sourceLine?.variationId);
  const maxQuantity = Math.max(
    1,
    Math.min(
      sourceAdjustableQuantity || 1,
      action === 'SUBSTITUTION'
        ? (substitute?.availableQuantity ?? sourceAdjustableQuantity) || 1
        : Math.min(sourceAdjustableQuantity || 1, Math.max(task.totals.required - 1, 1)),
    ),
  );
  const updatedShipmentQuantity = action === 'BYPASS'
    ? Math.max(task.totals.required - quantity, 0)
    : task.totals.required;
  const canRemoveFromShipment = task.totals.required > 1;

  useEffect(() => {
    setSourceLineId(defaultLine?.id ?? '');
    setQuantity(1);
    setReplacementChoice('');
    setReason('');
    setOptions([]);
    setIsEditing(false);
    setIsConfirming(false);
    setError(null);
    setNotice(null);
  }, [defaultLine?.id, task.id]);

  useEffect(() => {
    if (quantity > maxQuantity) {
      setQuantity(maxQuantity);
    }
  }, [maxQuantity, quantity]);

  const loadOptions = async () => {
    setIsLoadingOptions(true);
    setError(null);
    try {
      const response = await fetchWmsFulfillmentAdjustmentOptions({
        orderId: task.id,
        tenantId: task.store?.tenantId,
      });
      setOptions(response.options);
      setReplacementChoice((current) => (
        current === REMOVE_FROM_SHIPMENT_VALUE
          || response.options.some((option) => option.variationId === current)
          ? current
          : ''
      ));
    } catch (loadError) {
      setError(resolveAdjustmentError(loadError));
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const openEditor = () => {
    setIsEditing(true);
    setNotice(null);
    void loadOptions();
  };

  const validate = () => {
    if (!sourceLine) return 'Select the order item you want to change.';
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > sourceAdjustableQuantity) {
      return `Enter a whole number between 1 and ${sourceAdjustableQuantity}.`;
    }
    if (!replacementChoice) return 'Choose what the picker should scan instead.';
    if (action === 'BYPASS' && updatedShipmentQuantity < 1) {
      return 'This is the order’s only remaining unit. Cancel the order instead of removing it.';
    }
    if (action === 'SUBSTITUTION' && !substitute) return 'Choose an in-stock replacement item.';
    if (action === 'SUBSTITUTION' && substitute && quantity > substitute.availableQuantity) {
      return `Only ${substitute.availableQuantity} replacement unit(s) are available right now.`;
    }
    if (reason.trim().length < 10) return 'Explain the reason for this change using at least 10 characters.';
    return null;
  };

  const prepareConfirmation = () => {
    const validationError = validate();
    setError(validationError);
    if (!validationError) setIsConfirming(true);
  };

  const submit = async () => {
    if (!sourceLine) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setIsConfirming(false);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await adjustWmsFulfillmentItems({
        orderId: task.id,
        tenantId: task.store?.tenantId,
        sourceLineId: sourceLine.id,
        action,
        quantity,
        ...(action === 'SUBSTITUTION' && substitute ? { substituteVariationId: substitute.variationId } : {}),
        expectedSourceRevision: task.sourceRevision,
        reason: reason.trim(),
      });
      setNotice(
        action === 'SUBSTITUTION' && substitute
          ? `Pick list updated: ${quantity} ${sourceLine.productName} unit(s) replaced with ${substitute.productName}. Order is now ${response.order.statusLabel}.`
          : `Pick list updated: ${quantity} ${sourceLine.productName} unit(s) removed from the shipment. Order is now ${response.order.statusLabel}.`,
      );
      setIsEditing(false);
      setIsConfirming(false);
      await onApplied?.();
    } catch (submitError) {
      setError(resolveAdjustmentError(submitError));
      setIsConfirming(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-border/30 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Change the pick list</h3>
          </div>
          <p className="mt-1 text-sm text-muted">
            Replace an order item with available stock, or remove it from this shipment. The POS order will not be edited.
          </p>
        </div>
        {!isEditing && canAdjust ? (
          <button type="button" onClick={openEditor} className="btn btn-sm btn-outline">
            Change pick list
          </button>
        ) : null}
      </div>

      {!canAdjust ? (
        <p className="rounded-xl bg-secondary/30 px-3 py-2 text-sm text-muted">
          Only a supervisor with permission to change fulfillment items can use this action.
        </p>
      ) : null}

      {activeAdjustments.length > 0 ? (
        <div className="space-y-2">
          {activeAdjustments.map((adjustment) => (
            <div key={adjustment.id} className="rounded-xl border border-warning/30 bg-warning-soft/60 px-3 py-2.5">
              <p className="text-sm font-semibold text-foreground">
                {adjustment.type === 'SUBSTITUTION'
                  ? `Replaced ${adjustment.sourceProductName} ×${adjustment.quantity} with ${adjustment.substituteProductName ?? 'replacement item'} ×${adjustment.quantity}`
                  : `Removed ${adjustment.sourceProductName} ×${adjustment.quantity} from the shipment`}
              </p>
              <p className="mt-1 text-xs text-muted">
                Reason: {adjustment.reason} · Approved by {adjustment.approvedBy?.name ?? 'Supervisor'}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {notice ? <p className="rounded-xl bg-success-soft/60 px-3 py-2 text-sm text-success">{notice}</p> : null}
      {error ? <p className="rounded-xl bg-destructive-soft/60 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {isEditing ? (
        <div className="space-y-4 border-t border-border/20 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-foreground">
              Order item to change
              <select
                value={sourceLineId}
                onChange={(event) => {
                  setSourceLineId(event.target.value);
                  setQuantity(1);
                  setReplacementChoice('');
                  setIsConfirming(false);
                }}
                className="input w-full"
              >
                {adjustableLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.productName} · up to {Math.min(line.required, line.sourceRequired)} unit(s)
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm font-medium text-foreground">
              Units to change
              <input
                type="number"
                min={1}
                max={maxQuantity}
                value={quantity}
                onChange={(event) => {
                  setQuantity(Number(event.target.value));
                  setIsConfirming(false);
                }}
                className="input w-full"
              />
              <span className="block text-xs text-muted">
                You can {action === 'BYPASS' ? 'remove' : 'change'} up to {maxQuantity} unit(s) of this item.
              </span>
            </label>
          </div>

          <label className="space-y-1.5 text-sm font-medium text-foreground">
            Picker should scan instead
            <select
              value={replacementChoice}
              onChange={(event) => {
                setReplacementChoice(event.target.value);
                setIsConfirming(false);
              }}
              disabled={isLoadingOptions}
              className="input w-full"
            >
              <option value="">
                {isLoadingOptions ? 'Checking available stock…' : 'Choose a replacement or remove the units'}
              </option>
              {eligibleOptions.map((option) => (
                <option key={option.variationId} value={option.variationId}>
                  {option.productName}{option.productDisplayId ? ` · ${option.productDisplayId}` : ''} · {option.availableQuantity} available
                </option>
              ))}
              <option value={REMOVE_FROM_SHIPMENT_VALUE} disabled={!canRemoveFromShipment}>
                {canRemoveFromShipment
                  ? 'No replacement — remove these units from the shipment'
                  : 'No replacement unavailable — cancel single-unit order instead'}
              </option>
            </select>
            <span className={`block text-xs ${action === 'BYPASS' ? 'text-warning' : 'text-muted'}`}>
              {!replacementChoice
                ? 'Choose an available item to replace it, or explicitly remove the units from the shipment.'
                : action === 'SUBSTITUTION'
                  ? 'The picker will scan this replacement item. The shipment quantity stays the same.'
                  : 'No replacement will be picked. The customer will receive fewer units.'}
            </span>
            {!isLoadingOptions && eligibleOptions.length === 0 ? (
              <span className="block text-xs text-warning">
                {canRemoveFromShipment
                  ? 'No replacement stock is available. You can only remove the units from the shipment.'
                  : 'No replacement stock is available. This single-unit order must be canceled instead.'}
              </span>
            ) : null}
          </label>

          <div>
            <div className="rounded-xl border border-border/20 bg-secondary/30 px-3 py-3">
              <p className="text-xs font-semibold uppercase text-muted">Updated pick list preview</p>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div>
                  <p className="text-xs text-muted">Remove from pick list</p>
                  <p className="font-semibold text-foreground">{sourceLine?.productName ?? 'Order item'} ×{quantity}</p>
                </div>
                <ArrowRight className="hidden h-4 w-4 text-muted sm:block" />
                <div>
                  <p className="text-xs text-muted">
                    {action === 'SUBSTITUTION' ? 'Add to pick list' : 'Replacement'}
                  </p>
                  <p className={`font-semibold ${action === 'BYPASS' ? 'text-warning' : 'text-foreground'}`}>
                    {action === 'SUBSTITUTION'
                      ? `${substitute?.productName ?? 'Choose a replacement'} ×${quantity}`
                      : 'None — ship fewer units'}
                  </p>
                </div>
              </div>
              <p className="mt-3 border-t border-border/20 pt-2 text-sm text-muted">
                Shipment units: <span className="font-semibold text-foreground">{task.totals.required}</span>
                {' → '}
                <span className={`font-semibold ${action === 'BYPASS' ? 'text-warning' : 'text-foreground'}`}>
                  {updatedShipmentQuantity}
                </span>
                {action === 'SUBSTITUTION' ? ' (no change)' : ` (${quantity} fewer)`}
              </p>
            </div>
          </div>

          <label className="space-y-1.5 text-sm font-medium text-foreground">
            Reason for this change
            <textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setIsConfirming(false);
              }}
              rows={3}
              maxLength={500}
              placeholder={action === 'SUBSTITUTION'
                ? 'Example: Ordered item is unavailable; customer approved this replacement.'
                : 'Example: Customer approved shipping the order without this unavailable item.'}
              className="input h-auto w-full resize-none py-3"
            />
            <span className="block text-xs text-muted">Required for the audit history (at least 10 characters).</span>
          </label>

          {isConfirming ? (
            <div className="rounded-xl border border-warning/40 bg-warning-soft/60 p-3">
              <div className="flex items-start gap-2">
                <PackageSearch className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {action === 'SUBSTITUTION' ? 'Apply this replacement to the pick list?' : 'Ship this order with fewer items?'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {action === 'SUBSTITUTION' && substitute
                      ? `STOX will tell the picker to scan ${substitute.productName} ×${quantity} instead of ${sourceLine?.productName} ×${quantity}. The POS order will stay unchanged.`
                      : `STOX will remove ${sourceLine?.productName ?? 'this item'} ×${quantity} from the pick list. The customer will receive ${quantity} fewer unit(s), and the POS order will stay unchanged.`}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setIsConfirming(false);
                setError(null);
              }}
              disabled={isSubmitting}
              className="btn btn-md btn-ghost"
            >
              Cancel
            </button>
            {isConfirming ? (
              <button type="button" onClick={() => void submit()} disabled={isSubmitting} className="btn btn-md btn-warning">
                {isSubmitting
                  ? 'Updating pick list…'
                  : action === 'SUBSTITUTION'
                    ? 'Apply replacement'
                    : 'Remove from shipment'}
              </button>
            ) : (
              <button type="button" onClick={prepareConfirmation} disabled={isLoadingOptions} className="btn btn-md btn-primary">
                Preview pick-list change
              </button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function resolveAdjustmentError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Unable to adjust this order.'
    : 'Unable to adjust this order. Refresh and try again.';
}
