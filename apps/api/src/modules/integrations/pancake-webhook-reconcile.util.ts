export type PancakeWebhookReconcileMode = 'incremental' | 'full_reset';

export function resolveAutomaticPancakeReconcileMode(
  configuredMode: PancakeWebhookReconcileMode | undefined,
  allowAutomaticFullReset: boolean,
): PancakeWebhookReconcileMode {
  if (allowAutomaticFullReset && configuredMode === 'full_reset') {
    return 'full_reset';
  }

  return 'incremental';
}

export function buildPancakeReconcileWindow(params: {
  tenantId: string;
  dateLocal: string;
  delayMs: number;
  nowMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();
  const windowMs = Math.max(10_000, Math.floor(params.delayMs));
  const scheduledForMs = (Math.floor(nowMs / windowMs) + 1) * windowMs;

  return {
    jobId: `pancake-reconcile:${params.tenantId}:${params.dateLocal}:${scheduledForMs}`,
    delayMs: Math.max(0, scheduledForMs - nowMs),
    scheduledFor: new Date(scheduledForMs).toISOString(),
  };
}
