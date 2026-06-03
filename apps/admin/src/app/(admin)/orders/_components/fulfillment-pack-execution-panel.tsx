'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowLeft, CheckCircle2, CornerDownLeft, PackageOpen, RefreshCcw, ShieldAlert, Slash } from 'lucide-react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsModal } from '../../_components/wms-modal';
import type { WmsFulfillmentQueueReservation, WmsFulfillmentQueueTask } from '../_types/fulfillment';

type FulfillmentPackExecutionPanelProps = {
  canDirectVoid: boolean;
  canExecute: boolean;
  isRefreshing: boolean;
  isSubmitting: boolean;
  task: WmsFulfillmentQueueTask | null;
  onBack: () => void;
  onRefresh: () => void;
  onStart: (task: WmsFulfillmentQueueTask) => Promise<boolean>;
  onScanUnit: (task: WmsFulfillmentQueueTask, code: string) => Promise<boolean>;
  onVerifyTracking: (task: WmsFulfillmentQueueTask, code: string) => Promise<string | null>;
  onComplete: (task: WmsFulfillmentQueueTask, trackingCode: string) => Promise<boolean>;
  onVoid: (params: {
    task: WmsFulfillmentQueueTask;
    reason: string;
    supervisorIdentifier?: string | null;
    supervisorPassword?: string | null;
  }) => Promise<boolean>;
};

export function FulfillmentPackExecutionPanel({
  canDirectVoid,
  canExecute,
  isRefreshing,
  isSubmitting,
  task,
  onBack,
  onRefresh,
  onStart,
  onScanUnit,
  onVerifyTracking,
  onComplete,
  onVoid,
}: FulfillmentPackExecutionPanelProps) {
  const [unitCode, setUnitCode] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [verifiedTracking, setVerifiedTracking] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [supervisorIdentifier, setSupervisorIdentifier] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [voidOpen, setVoidOpen] = useState(false);
  const unitInputRef = useRef<HTMLInputElement>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUnitCode('');
    setTrackingCode('');
    setVerifiedTracking(null);
    setVoidReason('');
    setSupervisorIdentifier('');
    setSupervisorPassword('');
    setVoidOpen(false);
  }, [task?.id]);

  useEffect(() => {
    if (!task || task.status !== 'PACKING') {
      return;
    }

    const timer = window.setTimeout(() => {
      const packedAll = task.totals.packed >= task.totals.required && task.totals.required > 0;
      if (!packedAll) {
        unitInputRef.current?.focus();
      } else {
        trackingInputRef.current?.focus();
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [task]);

  const tracking = task?.tracking?.trim() || null;
  const packedAll = Boolean(task && task.totals.packed >= task.totals.required && task.totals.required > 0);
  const nextUnit = task ? getNextPackReservation(task) : null;
  const canStart = Boolean(task && task.status === 'PICKED' && tracking && canExecute);
  const isPacking = task?.status === 'PACKING';
  const isAwaitingTracking = Boolean(task && !tracking);
  const isPacked = task?.status === 'PACKED';

  const items = useMemo(() => (task ? getVisiblePackLines(task.lines) : []), [task]);

  if (!task) {
    return (
      <WmsCompactPanel title="Pack Execution" icon={<PackageOpen className='panel-icon'/>}>
        <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-8 py-10 text-center">
          <div className="max-w-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">Pack window</p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-primary">Select a pack order</h3>
            <p className="mt-3 text-sm leading-6 text-[#607482]">
              This execution window will let packers start packing, scan units, verify waybills, complete packing, and void orders when permitted.
            </p>
          </div>
        </div>
      </WmsCompactPanel>
    );
  }

  return (
    <>
      <WmsCompactPanel title="Pack Execution" icon={<PackageOpen className='panel-icon'/>}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
              
            <h3 className="truncate text-[18px] font-semibold tracking-tight text-primary">{task.store?.tenantName ?? 'Tenant'} · {task.store?.name ?? 'Store'} &middot; #{task.posOrderId}</h3>
          </div>

          <span className={`inline-flex rounded-full px-3 py-1.5 text-[12px] font-semibold ${getStatusTone(resolvePackStateLabel(task, tracking))}`}>
            {resolvePackStateLabel(task, tracking)}
         </span>
        </div>

        <div className="mt-5 space-y-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="md:flex-1">
              <MetricTile label="Packed" value={`${task.totals.packed}/${task.totals.required}`} note="Units verified" />
            </div>
            <div className="md:flex-1">
              <MetricTile label="Basket" value={task.basket?.barcode ?? 'None'} note={task.basket?.statusLabel ?? 'No basket'} />
            </div>
            <div className="md:flex-1">
              <MetricTile label="Tracking" value={tracking ?? 'Missing'} note={tracking ? 'Waybill ready' : 'Awaiting print'} />
            </div>
          </div>

          <div className="flex flex-col gap-5 xl:flex-row">
            <div className="xl:min-w-0 xl:flex-1">
              <div className="card">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Handoff</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <KeyValue label="Picker" value={task.claimedBy?.name ?? task.claimedBy?.email ?? 'Unknown'} />
                  <KeyValue label="Packer" value={task.basket?.assignedPacker?.name ?? task.packedBy?.name ?? 'Assigned queue'} />
                  <KeyValue label="Customer" value={task.customer.name ?? 'Unavailable'} />
                  <KeyValue label="Order date" value={task.orderDateLocal ?? task.orderDate} />
                </div>
              </div>
            </div>

            <div className="xl:min-w-0 xl:flex-1">
              <div className="card h-full">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Items</p>
                <div className="mt-3 space-y-3">
                  {items.map((line) => (
                    <div key={line.id} className="rounded-[18px] border border-[#e8eef2] bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-primary">{line.productName}</p>
                          <p className="mt-1 text-[12px] text-[#6f8290]">
                            {line.packed >= line.required ? 'Verified' : `${line.required - line.packed} left to verify`}
                          </p>
                        </div>
                        <span className="text-[13px] font-semibold text-primary">{line.packed}/{line.required}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {(canStart || ((task.status === 'PICKED' || task.status === 'PACKING' || task.status === 'PACKED') && canExecute) || (!isPacking && canExecute)) ? (
            <div className="flex flex-wrap gap-2">
              {canStart ? (
                <ActionButton
                  disabled={isSubmitting}
                  icon={<RefreshCcw className={`h-4 w-4 ${isSubmitting ? 'animate-spin' : ''}`} />}
                  label="Start packing"
                  onClick={() => void onStart(task)}
                  tone="primary"
                />
              ) : null}

              {(task.status === 'PICKED' || task.status === 'PACKING' || task.status === 'PACKED') && canExecute ? (
                <ActionButton
                  disabled={isSubmitting}
                  icon={<Slash className="h-4 w-4" />}
                  label="Void order"
                  onClick={() => setVoidOpen(true)}
                  tone="danger"
                />
              ) : null}

              {!isPacking && canExecute ? (
                <ActionButton
                  disabled={isRefreshing || isSubmitting}
                  icon={<RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
                  label="Refresh order"
                  onClick={onRefresh}
                  tone="secondary"
                />
              ) : null}
            </div>
          ) : null}

          {isPacked ? (
            <div className="card border-emerald-200 bg-emerald-50">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">{task.delivery?.label ?? 'Packed'}</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-700">{resolvePackedStateCopy(task)}</p>
                </div>
              </div>
            </div>
          ) : null}

          {isPacking ? (
            <div className="card space-y-3">
              {nextUnit ? (
                <div className="card border-[#ebe3ff] bg-[#f6f2ff]">
                  <p className="card-label text-[#8b7bd0]">Next unit</p>
                  <p className="mt-1 text-base font-semibold text-[#2a1f57]">{nextUnit.unit.code}</p>
                  <p className="mt-1 text-sm text-[#61548c]">{nextUnit.unit.name}</p>
                </div>
              ) : (
                <div className="card border-emerald-200 bg-emerald-50">
                  <p className="text-sm font-semibold text-emerald-800">All units verified</p>
                  <p className="mt-1 text-sm text-emerald-700">Scan the tracking barcode, then mark this order packed.</p>
                </div>
              )}

              {!packedAll ? (
                <ScannerInput
                  autoSubmit
                  disabled={isSubmitting}
                  helper="Each scanned unit is verified against the handed-off order."
                  inputRef={unitInputRef}
                  label="Scannable unit"
                  onChange={setUnitCode}
                  onSubmit={() => void (unitCode.trim() ? onScanUnit(task, unitCode.trim()).then((ok) => {
                    if (ok) {
                      setUnitCode('');
                      window.setTimeout(() => unitInputRef.current?.focus(), 80);
                    }
                  }) : Promise.resolve())}
                  placeholder="Scan picked unit"
                  value={unitCode}
                />
              ) : null}

              <ScannerInput
                autoSubmit
                disabled={isSubmitting}
                helper={verifiedTracking ? `Verified ${verifiedTracking}` : 'Scan the waybill barcode to confirm the order tracking number.'}
                inputRef={trackingInputRef}
                label="Waybill"
                onChange={(value) => {
                  setTrackingCode(value);
                  setVerifiedTracking(null);
                }}
                onSubmit={() => void (trackingCode.trim() ? onVerifyTracking(task, trackingCode.trim()).then((verified) => {
                  if (verified) {
                    setTrackingCode(verified);
                    setVerifiedTracking(verified);
                  }
                }) : Promise.resolve())}
                placeholder={tracking ?? 'Scan tracking barcode'}
                value={trackingCode}
              />

              <ActionButton
                disabled={!packedAll || !verifiedTracking || isSubmitting}
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Mark packed"
                onClick={() => void onComplete(task, verifiedTracking ?? trackingCode)}
                tone="primary"
              />
            </div>
          ) : null}

        </div>
      </WmsCompactPanel>

      <WmsModal
        open={voidOpen}
        title="Void pack order"
        onClose={() => setVoidOpen(false)}
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setVoidOpen(false)}
              className="btn btn-md btn-outline"
            >
              Keep order
            </button>
            <button
              type="button"
              disabled={!voidReason.trim() || (!canDirectVoid && (!supervisorIdentifier.trim() || !supervisorPassword.trim())) || isSubmitting}
              onClick={() => {
                void onVoid({
                  task,
                  reason: voidReason.trim(),
                  supervisorIdentifier: canDirectVoid ? null : supervisorIdentifier.trim(),
                  supervisorPassword: canDirectVoid ? null : supervisorPassword,
                }).then((ok) => {
                  if (ok) {
                    setVoidOpen(false);
                  }
                });
              }}
              className="btn btn-md btn-destructive"
            >
              {canDirectVoid ? 'Void now' : 'Request void'}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="form-label">Reason</span>
            <textarea
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              rows={3}
              placeholder="Order canceled, discontinued, customer changed item, etc."
              className='input'
            />
          </label>

          {!canDirectVoid ? (
            <div className="rounded-xl border border-[#efe4b9] bg-[#fff9e9] p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-[#b58100]" />
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-[#805b00]">Supervisor approval required</p>
                    <p className="mt-1 text-sm text-[#8a6a1b]">
                      Enter the supervisor email or employee ID, then the supervisor password to acknowledge the void.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a6a1b]">Supervisor</span>
                      <input
                        value={supervisorIdentifier}
                        onChange={(event) => setSupervisorIdentifier(event.target.value)}
                        placeholder="manager@company.com or EMP-001"
                        className="h-11 w-full rounded-[16px] border border-[#e2d7ae] bg-white px-3.5 text-[13px] text-primary outline-none transition focus:border-[#caa93c] focus:shadow-[0_0_0_4px_rgba(202,169,60,0.14)]"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a6a1b]">Password</span>
                      <input
                        type="password"
                        value={supervisorPassword}
                        onChange={(event) => setSupervisorPassword(event.target.value)}
                        placeholder="Enter supervisor password"
                        className="h-11 w-full rounded-[16px] border border-[#e2d7ae] bg-white px-3.5 text-[13px] text-primary outline-none transition focus:border-[#caa93c] focus:shadow-[0_0_0_4px_rgba(202,169,60,0.14)]"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </WmsModal>
    </>
  );
}

function ScannerInput({
  autoSubmit = false,
  autoSubmitDelayMs = 120,
  autoSubmitMinLength = 3,
  disabled,
  helper,
  inputRef,
  label,
  onChange,
  onSubmit,
  placeholder,
  value,
}: {
  autoSubmit?: boolean;
  autoSubmitDelayMs?: number;
  autoSubmitMinLength?: number;
  disabled?: boolean;
  helper?: string;
  inputRef: RefObject<HTMLInputElement>;
  label: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  placeholder: string;
  value: string;
}) {
  const submitRef = useRef(onSubmit);
  const lastSubmittedRef = useRef<string | null>(null);

  useEffect(() => {
    submitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    const cleaned = value.trim();
    if (!cleaned) {
      lastSubmittedRef.current = null;
      return;
    }

    if (!autoSubmit || disabled || cleaned.length < autoSubmitMinLength || lastSubmittedRef.current === cleaned) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastSubmittedRef.current = cleaned;
      void submitRef.current();
    }, autoSubmitDelayMs);

    return () => window.clearTimeout(timer);
  }, [autoSubmit, autoSubmitDelayMs, autoSubmitMinLength, disabled, value]);

  return (
    <label className={`card block ${disabled ? 'border-[#e5eaee] bg-[#f8fafb]' : 'border-[#d7e0e7] bg-white'}`}>
      <span className="card-label">{label}</span>
      <div className="mt-2 flex items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void onSubmit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoCapitalize="characters"
          autoCorrect="off"
          className="input"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            void onSubmit();
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-primary text-white transition hover:bg-[#0f3141] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <CornerDownLeft className="h-4 w-4" />
        </button>
      </div>
      {helper ? <p className="mt-2 text-[12px] text-[#6f8290]">{helper}</p> : null}
    </label>
  );
}

function MetricTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="card">
      <p className="card-label">{label}</p>
      <p className="card-value text-[20px]">{value}</p>
      <p className="mt-1 text-[12px] text-[#6f8290]">{note}</p>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="card-label">{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-primary">{value}</p>
    </div>
  );
}

function ActionButton({
  disabled,
  icon,
  label,
  onClick,
  tone,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone: 'primary' | 'secondary' | 'danger';
}) {
  const toneClassName = tone === 'primary'
    ? 'btn-primary'
    : tone === 'danger'
      ? 'btn-destructive'
      : 'btn-outline';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`btn btn-lg btn-icon ${toneClassName}`}
    >
      {icon}
      {label}
    </button>
  );
}

function getVisiblePackLines(lines: WmsFulfillmentQueueTask['lines']) {
  return lines.filter((line) => line.status !== 'CANCELED' && line.required > 0);
}

function getNextPackReservation(task: WmsFulfillmentQueueTask): WmsFulfillmentQueueReservation | null {
  for (const line of getVisiblePackLines(task.lines)) {
    const next = line.reservations.find((reservation) => (
      reservation.status === 'PICKED'
      && reservation.unit.status !== 'PACKED'
      && reservation.unit.status !== 'DISPATCHED'
    ));

    if (next) {
      return next;
    }
  }

  return null;
}

function resolvePackStateLabel(task: WmsFulfillmentQueueTask, tracking: string | null) {
  if (task.status === 'PACKED' && task.delivery?.label) {
    return task.delivery.label;
  }

  if (!tracking && task.status !== 'PACKED') {
    return 'No tracking';
  }

  if (task.status === 'PICKED') {
    return 'Awaiting pack';
  }

  if (task.status === 'PACKING') {
    return 'Packing';
  }

  if (task.status === 'PACKED') {
    return 'Packed';
  }

  return task.statusLabel;
}

function resolvePackedStateCopy(task: WmsFulfillmentQueueTask) {
  if (task.delivery?.status === 'DELIVERED') {
    return 'This order was delivered. The packed activity remains traceable in WMS and STOX history.';
  }

  if (task.delivery?.status === 'SHIPPED') {
    return 'This order already left the warehouse and its units were moved to dispatched inventory.';
  }

  return 'This order is packed and the basket has already been released back to available.';
}

function getStatusTone(statusLabel: string) {
  const normalized = statusLabel.toLowerCase();

  if (normalized.includes('delivered')) {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (normalized.includes('shipped')) {
    return 'bg-sky-50 text-sky-700';
  }

  if (normalized.includes('tracking')) {
    return 'bg-rose-50 text-rose-700';
  }

  if (normalized.includes('pack')) {
    return 'bg-violet-50 text-violet-700';
  }

  return 'bg-slate-100 text-slate-700';
}
