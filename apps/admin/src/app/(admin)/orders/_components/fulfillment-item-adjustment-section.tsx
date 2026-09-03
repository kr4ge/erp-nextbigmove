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
  const [action, setAction] = useState<'BYPASS' | 'SUBSTITUTION'>('SUBSTITUTION');
  const [quantity, setQuantity] = useState(1);
  const [substituteVariationId, setSubstituteVariationId] = useState('');
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
  const substitute = options.find((option) => option.variationId === substituteVariationId) ?? null;
  const eligibleOptions = options.filter((option) => option.variationId !== sourceLine?.variationId);
  const maxQuantity = Math.max(
    1,
    Math.min(
      sourceAdjustableQuantity || 1,
      action === 'SUBSTITUTION'
        ? (substitute?.availableQuantity ?? sourceAdjustableQuantity) || 1
        : sourceAdjustableQuantity || 1,
    ),
  );

  useEffect(() => {
    setSourceLineId(defaultLine?.id ?? '');
    setAction('SUBSTITUTION');
    setQuantity(1);
    setSubstituteVariationId('');
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
      setSubstituteVariationId((current) => (
        response.options.some((option) => option.variationId === current)
          ? current
          : response.options.find((option) => option.variationId !== sourceLine?.variationId)?.variationId ?? ''
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
    if (!sourceLine) return 'Select an original order item.';
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > sourceAdjustableQuantity) {
      return `Quantity must be between 1 and ${sourceAdjustableQuantity}.`;
    }
    if (action === 'SUBSTITUTION' && !substitute) return 'Select an in-stock substitute.';
    if (action === 'SUBSTITUTION' && substitute && quantity > substitute.availableQuantity) {
      return `Only ${substitute.availableQuantity} eligible substitute unit(s) are currently available.`;
    }
    if (reason.trim().length < 10) return 'Enter a clear reason using at least 10 characters.';
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
          ? `${quantity} ${sourceLine.productName} unit(s) replaced with ${substitute.productName}. Order is now ${response.order.statusLabel}.`
          : `${quantity} ${sourceLine.productName} unit(s) bypassed. Order is now ${response.order.statusLabel}.`,
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
            <h3 className="text-sm font-semibold text-foreground">Adjust fulfillment items</h3>
          </div>
          <p className="mt-1 text-sm text-muted">
            Bypass an unavailable item or replace it with eligible stock before picking starts.
          </p>
        </div>
        {!isEditing && canAdjust ? (
          <button type="button" onClick={openEditor} className="btn btn-sm btn-outline">
            Adjust items
          </button>
        ) : null}
      </div>

      {!canAdjust ? (
        <p className="rounded-xl bg-secondary/30 px-3 py-2 text-sm text-muted">
          The `wms.fulfillment.bypass` permission is required for this supervisor action.
        </p>
      ) : null}

      {activeAdjustments.length > 0 ? (
        <div className="space-y-2">
          {activeAdjustments.map((adjustment) => (
            <div key={adjustment.id} className="rounded-xl border border-warning/30 bg-warning-soft/60 px-3 py-2.5">
              <p className="text-sm font-semibold text-foreground">
                {adjustment.type === 'SUBSTITUTION'
                  ? `${adjustment.sourceProductName} ×${adjustment.quantity} → ${adjustment.substituteProductName ?? 'Substitute'}`
                  : `${adjustment.sourceProductName} ×${adjustment.quantity} bypassed`}
              </p>
              <p className="mt-1 text-xs text-muted">
                {adjustment.reason} · {adjustment.approvedBy?.name ?? 'Supervisor'}
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
              Original item
              <select
                value={sourceLineId}
                onChange={(event) => {
                  setSourceLineId(event.target.value);
                  setQuantity(1);
                  setIsConfirming(false);
                }}
                className="input w-full"
              >
                {adjustableLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.productName} · {Math.min(line.required, line.sourceRequired)} adjustable
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm font-medium text-foreground">
              Action
              <select
                value={action}
                onChange={(event) => {
                  setAction(event.target.value as 'BYPASS' | 'SUBSTITUTION');
                  setQuantity(1);
                  setIsConfirming(false);
                }}
                className="input w-full"
              >
                <option value="SUBSTITUTION">Replace with in-stock item</option>
                <option value="BYPASS">Bypass without replacement</option>
              </select>
            </label>
          </div>

          {action === 'SUBSTITUTION' ? (
            <label className="space-y-1.5 text-sm font-medium text-foreground">
              In-stock substitute
              <select
                value={substituteVariationId}
                onChange={(event) => {
                  setSubstituteVariationId(event.target.value);
                  setQuantity(1);
                  setIsConfirming(false);
                }}
                disabled={isLoadingOptions || eligibleOptions.length === 0}
                className="input w-full"
              >
                <option value="">
                  {isLoadingOptions ? 'Checking eligible stock…' : 'Select a substitute'}
                </option>
                {eligibleOptions.map((option) => (
                  <option key={option.variationId} value={option.variationId}>
                    {option.productName}{option.productDisplayId ? ` · ${option.productDisplayId}` : ''} · {option.availableQuantity} available
                  </option>
                ))}
              </select>
              {!isLoadingOptions && eligibleOptions.length === 0 ? (
                <span className="block text-xs text-warning">No eligible substitute stock is available in this order’s store and warehouse scope.</span>
              ) : null}
            </label>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-foreground">
              Quantity
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
            </label>

            <div className="rounded-xl bg-secondary/30 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase text-muted">Result</p>
              <div className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
                <span>{sourceLine?.productName ?? 'Original'} ×{quantity}</span>
                <ArrowRight className="h-4 w-4 text-muted" />
                <span>{action === 'SUBSTITUTION' ? substitute?.productName ?? 'Select stock' : 'Not shipped'}</span>
              </div>
            </div>
          </div>

          <label className="space-y-1.5 text-sm font-medium text-foreground">
            Supervisor reason
            <textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setIsConfirming(false);
              }}
              rows={3}
              maxLength={500}
              placeholder="Explain why this fulfillment adjustment is required."
              className="input h-auto w-full resize-none py-3"
            />
          </label>

          {isConfirming ? (
            <div className="rounded-xl border border-warning/40 bg-warning-soft/60 p-3">
              <div className="flex items-start gap-2">
                <PackageSearch className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Confirm fulfillment adjustment</p>
                  <p className="mt-1 text-sm text-muted">
                    {action === 'SUBSTITUTION' && substitute
                      ? `STOX will pick ${substitute.productName} ×${quantity} instead of ${sourceLine?.productName} ×${quantity}. The original POS order is not changed.`
                      : `The shipment will contain ${quantity} fewer ${sourceLine?.productName ?? 'item'} unit(s). The original POS order is not changed.`}
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
                {isSubmitting ? 'Applying…' : 'Confirm adjustment'}
              </button>
            ) : (
              <button type="button" onClick={prepareConfirmation} disabled={isLoadingOptions} className="btn btn-md btn-primary">
                Review change
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
