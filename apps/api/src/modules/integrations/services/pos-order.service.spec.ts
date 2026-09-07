import { describe, expect, it } from '@jest/globals';
import { shouldTreatNoProductSnapshotAsVoid } from './pos-order.service';

describe('shouldTreatNoProductSnapshotAsVoid', () => {
  it.each([1, 12])(
    'keeps an explicitly empty snapshot fulfillable while POS status is %s',
    (status) => {
      expect(shouldTreatNoProductSnapshotAsVoid(true, status)).toBe(false);
    },
  );

  it('still treats an explicitly empty snapshot as void for a canceled POS order', () => {
    expect(shouldTreatNoProductSnapshotAsVoid(true, 6)).toBe(true);
  });

  it('never changes void state when the snapshot contains a product', () => {
    expect(shouldTreatNoProductSnapshotAsVoid(false, 6)).toBe(false);
  });
});
