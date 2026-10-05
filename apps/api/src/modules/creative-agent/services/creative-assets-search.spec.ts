import { describe, expect, it } from '@jest/globals';
import { buildAssetSearchWhere, codeSpellings, enrolledWithinWhere, manilaDayStart } from './creative-assets.service';

/**
 * People type codes the way they read them, not the way they are stored.
 * Every spelling here is one that used to return nothing.
 */
describe('codeSpellings', () => {
  it('keeps the typed form and adds the compact and dashed forms', () => {
    expect(codeSpellings('SE-I0342')).toEqual(['SE-I0342', 'SEI0342']);
    expect(codeSpellings('sei0342')).toEqual(['sei0342', 'se-i0342']);
    expect(codeSpellings('PICKZMI0143')).toEqual(['PICKZMI0143', 'PICKZM-I0143']);
  });

  it('leaves a plain word or a bare number alone', () => {
    expect(codeSpellings('PROMO')).toEqual(['PROMO']);
    expect(codeSpellings('0342')).toEqual(['0342']);
    expect(codeSpellings('  ')).toEqual([]);
  });
});

describe('buildAssetSearchWhere', () => {
  it('requires every word to match somewhere, so two words narrow the result', () => {
    const clauses = buildAssetSearchWhere('SE I0342');
    expect(clauses).toHaveLength(2);
    expect(JSON.stringify(clauses[0])).toContain('"contains":"SE"');
    expect(JSON.stringify(clauses[1])).toContain('"contains":"I0342"');
  });

  it('searches the code, title, product, store, creator and linked ad for each word', () => {
    const [clause] = buildAssetSearchWhere('promo');
    const json = JSON.stringify(clause);
    for (const field of ['"code"', '"title"', '"posProductName"', '"storeNameSnapshot"', '"firstName"', '"metaAdId"', '"adNameSnapshot"']) {
      expect(json).toContain(field);
    }
  });

  it('caps the number of words so a pasted paragraph cannot build a giant query', () => {
    expect(buildAssetSearchWhere('a b c d e f g h i j k')).toHaveLength(8);
  });
});

describe('enrolledWithinWhere', () => {
  it('reads the window as Manila calendar days, inclusive of both ends', () => {
    const where = enrolledWithinWhere('2026-10-01', '2026-10-01') as { OR: Array<Record<string, { gte?: Date; lt?: Date } | null>> };
    const submitted = where.OR[0].submittedAt!;
    // Midnight Manila on 1 Oct is 16:00 UTC on 30 Sep; the day ends where 2 Oct begins.
    expect(submitted.gte?.toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(submitted.lt?.toISOString()).toBe('2026-10-01T16:00:00.000Z');
  });

  it('falls back to creation for rows that were never submitted', () => {
    const where = enrolledWithinWhere('2026-09-06', '2026-10-05') as { OR: Array<Record<string, unknown>> };
    expect(where.OR[1]).toMatchObject({ submittedAt: null });
    expect(where.OR[1].createdAt).toEqual(where.OR[0].submittedAt);
  });

  it('builds a Manila day start without depending on the server timezone', () => {
    expect(manilaDayStart('2026-01-01').toISOString()).toBe('2025-12-31T16:00:00.000Z');
  });
});
