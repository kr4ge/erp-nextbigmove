import { describe, expect, it } from '@jest/globals';
import {
  buildFulfillmentDemandHash,
  diffFulfillmentDemand,
  summarizeFulfillmentDemandDiff,
} from './wms-fulfillment-amendment.utils';

const item = (variationId: string, quantityRequired: number) => ({
  variationId,
  productId: variationId,
  productName: variationId,
  productDisplayId: null,
  quantityRequired,
});

describe('fulfillment amendment demand utilities', () => {
  it('builds the same hash regardless of line order', () => {
    expect(buildFulfillmentDemandHash([item('B', 1), item('A', 2)]))
      .toBe(buildFulfillmentDemandHash([item('A', 2), item('B', 1)]));
  });

  it('treats duplicate lines as one variation demand', () => {
    expect(buildFulfillmentDemandHash([item('A', 1), item('A', 2)]))
      .toBe(buildFulfillmentDemandHash([item('A', 3)]));
  });

  it('classifies replacement and quantity changes', () => {
    const diff = diffFulfillmentDemand(
      [item('A', 3), item('B', 1)],
      [item('A', 1), item('C', 2)],
    );
    expect(diff.decreased).toEqual([expect.objectContaining({ variationId: 'A', delta: -2 })]);
    expect(diff.removed).toEqual([expect.objectContaining({ variationId: 'B', delta: -1 })]);
    expect(diff.added).toEqual([expect.objectContaining({ variationId: 'C', delta: 2 })]);
    expect(summarizeFulfillmentDemandDiff(diff)).toEqual(expect.objectContaining({
      addedUnits: 2,
      removedUnits: 3,
    }));
  });
});
