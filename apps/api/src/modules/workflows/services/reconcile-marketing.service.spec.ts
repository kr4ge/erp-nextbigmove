import { describe, expect, it } from '@jest/globals';
import { excludesPosOrderFromSalesTotals } from './reconcile-marketing.service';

describe('reconcile marketing POS eligibility', () => {
  it('keeps deleted and void order tombstones out of sales totals', () => {
    expect(excludesPosOrderFromSalesTotals({ status: 7, isVoid: true })).toBe(true);
    expect(excludesPosOrderFromSalesTotals({ status: 13, isVoid: true })).toBe(true);
    expect(excludesPosOrderFromSalesTotals({ status: 6, isVoid: true })).toBe(true);
  });

  it('continues counting ordinary order statuses', () => {
    expect(excludesPosOrderFromSalesTotals({ status: 1, isVoid: false })).toBe(false);
    expect(excludesPosOrderFromSalesTotals({ status: 5, isVoid: false })).toBe(false);
    expect(excludesPosOrderFromSalesTotals({ status: null, isVoid: false })).toBe(false);
  });
});
