import { describe, expect, it } from '@jest/globals';
import { buildAssetSearchWhere, codeSpellings } from './creative-assets.service';

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
