import { describe, expect, it } from '@jest/globals';
import {
  finalizeCompleteDemandAllocation,
  normalizeDemandAllocation,
} from './wms-demand-allocation.utils';

describe('finalizeCompleteDemandAllocation', () => {
  it('preserves allocations when every order line is fully covered', () => {
    const result = finalizeCompleteDemandAllocation(
      [
        { id: 'line-a', required: 2 },
        { id: 'line-b', required: 1 },
      ],
      new Map([
        ['line-a', 2],
        ['line-b', 1],
      ]),
    );

    expect(Object.fromEntries(result)).toEqual({
      'line-a': 2,
      'line-b': 1,
    });
  });

  it('releases every soft allocation when one line is short', () => {
    const result = finalizeCompleteDemandAllocation(
      [
        { id: 'line-a', required: 2 },
        { id: 'line-b', required: 3 },
      ],
      new Map([
        ['line-a', 2],
        ['line-b', 1],
      ]),
    );

    expect(Object.fromEntries(result)).toEqual({
      'line-a': 0,
      'line-b': 0,
    });
  });

  it('does not create an allocation for an order without eligible lines', () => {
    expect(finalizeCompleteDemandAllocation([], new Map()).size).toBe(0);
  });

  it('preserves partial allocations for the leftover-stock pass', () => {
    const result = normalizeDemandAllocation(
      [
        { id: 'line-a', required: 2 },
        { id: 'line-b', required: 3 },
      ],
      new Map([
        ['line-a', 2],
        ['line-b', 1],
      ]),
    );

    expect(Object.fromEntries(result)).toEqual({
      'line-a': 2,
      'line-b': 1,
    });
  });
});
