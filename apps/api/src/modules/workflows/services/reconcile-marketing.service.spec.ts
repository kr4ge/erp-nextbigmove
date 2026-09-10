import { describe, expect, it } from '@jest/globals';
import {
  excludesPosOrderFromSalesTotals,
  resolveInsightMappingForReconcile,
} from './reconcile-marketing.service';

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

describe('reconcile marketing insight mapping precedence', () => {
  const canonicalize = (value: string | null | undefined) => value?.trim().toLowerCase() || null;

  it('uses an explicit creative link before every inferred mapping', () => {
    expect(resolveInsightMappingForReconcile(
      { adName: 'ITEM_Static_SENTRA-I0065_Lyca', mapping: '0910' },
      'pv::store::variation',
      canonicalize,
    )).toBe('pv::store::variation');
  });

  it('uses the current static naming convention before an imported date suffix', () => {
    expect(resolveInsightMappingForReconcile(
      { adName: 'ITEM_Static_SENTRA-I0065_Lyca', mapping: '0910' },
      null,
      canonicalize,
    )).toBe('item');
  });

  it('preserves imported mappings for old naming conventions', () => {
    expect(resolveInsightMappingForReconcile(
      { adName: 'TaiSui_ThisCNY|Broad|BOF_Team2_1177_0124', mapping: 'tai sui' },
      null,
      canonicalize,
    )).toBe('tai sui');
  });
});
