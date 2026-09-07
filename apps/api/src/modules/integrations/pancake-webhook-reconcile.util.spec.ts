import { describe, expect, it } from '@jest/globals';
import {
  buildPancakeReconcileWindow,
  resolveAutomaticPancakeReconcileMode,
} from './pancake-webhook-reconcile.util';

describe('Pancake webhook reconciliation', () => {
  it('uses incremental mode by default and unless automatic full resets are explicitly enabled', () => {
    expect(resolveAutomaticPancakeReconcileMode(undefined, false)).toBe('incremental');
    expect(resolveAutomaticPancakeReconcileMode('full_reset', false)).toBe('incremental');
    expect(resolveAutomaticPancakeReconcileMode('full_reset', true)).toBe('full_reset');
  });

  it('coalesces tenant/date work into a fixed reconciliation window', () => {
    const first = buildPancakeReconcileWindow({
      tenantId: 'tenant-1',
      dateLocal: '2026-08-17',
      delayMs: 300_000,
      nowMs: 1_000_000,
    });
    const second = buildPancakeReconcileWindow({
      tenantId: 'tenant-1',
      dateLocal: '2026-08-17',
      delayMs: 300_000,
      nowMs: 1_100_000,
    });

    expect(first.jobId).toBe(second.jobId);
    expect(first.scheduledFor).toBe(second.scheduledFor);
    expect(second.delayMs).toBeLessThan(first.delayMs);
  });

  it('creates a trailing window for an event arriving after the boundary', () => {
    const beforeBoundary = buildPancakeReconcileWindow({
      tenantId: 'tenant-1',
      dateLocal: '2026-08-17',
      delayMs: 300_000,
      nowMs: 1_199_999,
    });
    const afterBoundary = buildPancakeReconcileWindow({
      tenantId: 'tenant-1',
      dateLocal: '2026-08-17',
      delayMs: 300_000,
      nowMs: 1_200_001,
    });

    expect(afterBoundary.jobId).not.toBe(beforeBoundary.jobId);
  });

  it('keeps destructive corrections separate from the normal debounce window', () => {
    const standard = buildPancakeReconcileWindow({
      tenantId: 'tenant-1',
      dateLocal: '2026-08-17',
      delayMs: 300_000,
      nowMs: 1_000_000,
    });
    const destructive = buildPancakeReconcileWindow({
      tenantId: 'tenant-1',
      dateLocal: '2026-08-17',
      delayMs: 15_000,
      trigger: 'destructive_order_change',
      nowMs: 1_000_000,
    });

    expect(destructive.jobId).toContain('pancake-reconcile:destructive:');
    expect(destructive.jobId).not.toBe(standard.jobId);
    expect(destructive.delayMs).toBeLessThan(standard.delayMs);
  });
});
