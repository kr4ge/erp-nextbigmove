import { describe, expect, it } from '@jest/globals';
import {
  resolveProcessRole,
  shouldRunApiBackgroundServices,
  shouldRunPancakeWorkers,
} from './process-role';

describe('process role', () => {
  it.each([
    [undefined, 'all'],
    ['', 'all'],
    ['unknown', 'all'],
    ['API', 'api'],
    [' worker ', 'worker'],
  ])('resolves %p as %s', (value, expected) => {
    expect(resolveProcessRole(value)).toBe(expected);
  });

  it('runs dedicated Pancake workers outside the api-only role', () => {
    expect(shouldRunPancakeWorkers('api')).toBe(false);
    expect(shouldRunPancakeWorkers('worker')).toBe(true);
    expect(shouldRunPancakeWorkers('all')).toBe(true);
  });

  it('keeps operational background services out of the dedicated worker', () => {
    expect(shouldRunApiBackgroundServices('worker')).toBe(false);
    expect(shouldRunApiBackgroundServices('api')).toBe(true);
    expect(shouldRunApiBackgroundServices('all')).toBe(true);
  });
});
