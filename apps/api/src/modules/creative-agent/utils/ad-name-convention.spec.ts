import { describe, expect, it } from '@jest/globals';
import { deriveAssociateFromAdName, deriveMappingFromAdName, parseAdName } from './ad-name-convention';

describe('parseAdName', () => {
  it('reads the new convention: customId_title_CODE_creator', () => {
    expect(parseAdName('OGM-100_Kidney Hook_NRO-V0069_Josiah Cruz')).toEqual({
      convention: 'new',
      customId: 'OGM-100',
      title: 'Kidney Hook',
      code: 'NRO-V0069',
      creator: 'Josiah Cruz',
    });
  });

  it('survives underscores inside customId and creator', () => {
    const parsed = parseAdName('OGM_100_Kidney Hook_NRO-V0069_Josiah_Cruz');
    expect(parsed).toEqual({
      convention: 'new',
      customId: 'OGM_100',
      title: 'Kidney Hook',
      code: 'NRO-V0069',
      creator: 'Josiah_Cruz',
    });
  });

  it('classifies the legacy copy format as legacy: title_creator_CODE', () => {
    expect(parseAdName('Test 1_Frage Perez_NRO-V0041')).toEqual({
      convention: 'legacy-or-bare',
      code: 'NRO-V0041',
    });
  });

  it('classifies a bare code as legacy-or-bare', () => {
    expect(parseAdName('NRO-V0041')).toEqual({ convention: 'legacy-or-bare', code: 'NRO-V0041' });
  });

  it('rejects prose mentioning a code without underscore structure', () => {
    expect(parseAdName('promo NRO-V0041 retest')).toEqual({ convention: 'unknown' });
  });

  it('rejects the pre-code pipe-style names outright', () => {
    // The July 2026 style: no underscores at all, code in brackets.
    expect(parseAdName('UGC / INATAKE SA BDAY l [NRO-V0100] l JOSIAH')).toEqual({ convention: 'unknown' });
  });
});

describe('deriveMappingFromAdName', () => {
  it('uses the declared customId, lowercased', () => {
    expect(deriveMappingFromAdName('OGM-100_Hook_NRO-V0069_Josiah')).toBe('ogm-100');
  });

  it('returns null for the legacy copy format', () => {
    expect(deriveMappingFromAdName('Test 1_Frage Perez_NRO-V0041')).toBeNull();
  });

  it('returns null for old positional campaign-style names', () => {
    // EVIL EYE_UGC_1001_ALY_001 has no code segment, so it is not ours to map.
    expect(deriveMappingFromAdName('EVIL EYE_UGC_1001_ALY_001')).toBeNull();
  });
});

describe('deriveAssociateFromAdName', () => {
  it('names the creator on the new convention', () => {
    expect(deriveAssociateFromAdName('OGM-100_Hook_NRO-V0069_Josiah Cruz')).toBe('Josiah Cruz');
  });

  it('stays null on legacy shapes so the positional parser keeps ownership', () => {
    expect(deriveAssociateFromAdName('EVIL EYE_UGC_1001_ALY_001')).toBeNull();
  });
});
