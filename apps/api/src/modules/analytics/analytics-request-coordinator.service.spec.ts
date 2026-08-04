import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { AnalyticsRequestCoordinatorService } from './analytics-request-coordinator.service';

describe('AnalyticsRequestCoordinatorService', () => {
  beforeEach(() => {
    process.env.ANALYTICS_MAX_CONCURRENT_PER_TENANT = '1';
  });

  afterEach(() => {
    delete process.env.ANALYTICS_MAX_CONCURRENT_PER_TENANT;
  });

  it('coalesces identical in-flight requests', async () => {
    const service = new AnalyticsRequestCoordinatorService();
    let executions = 0;
    let release: (value: string) => void = () => undefined;
    const pending = new Promise<string>((resolve) => {
      release = resolve;
    });
    const operation = async () => {
      executions += 1;
      return pending;
    };

    const first = service.run('tenant-a', 'same-key', operation);
    const second = service.run('tenant-a', 'same-key', operation);
    release('done');

    await expect(Promise.all([first, second])).resolves.toEqual(['done', 'done']);
    expect(executions).toBe(1);
  });

  it('limits different requests for the same tenant', async () => {
    const service = new AnalyticsRequestCoordinatorService();
    let active = 0;
    let maximumActive = 0;
    const releases: Array<() => void> = [];
    const startedResolvers: Array<() => void> = [];
    const firstStarted = new Promise<void>((resolve) => startedResolvers.push(resolve));
    const secondStarted = new Promise<void>((resolve) => startedResolvers.push(resolve));
    const operation = async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      startedResolvers.shift()?.();
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      return 'done';
    };

    const first = service.run('tenant-a', 'key-1', operation);
    await firstStarted;
    const second = service.run('tenant-a', 'key-2', operation);
    await Promise.resolve();
    expect(active).toBe(1);
    releases.shift()?.();
    await secondStarted;
    releases.shift()?.();

    await expect(Promise.all([first, second])).resolves.toEqual(['done', 'done']);
    expect(maximumActive).toBe(1);
  });
});
