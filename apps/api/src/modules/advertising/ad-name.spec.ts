import { describe, expect, it } from '@jest/globals';
import { creativeCode, creatorFromAdName, parseAdName } from './ad-name';

describe('parseAdName — the pipe convention the ads actually use', () => {
  it('reads the code and the person from a real ad name', () => {
    expect(parseAdName('MALABO MATA l [NRO-V0052] l JOSIAH')).toEqual({
      code: 'NRO-V0052',
      associate: 'JOSIAH',
      teamCode: null,
    });
  });

  it('keeps the L inside a word', () => {
    // "Looking" must not be split by its own letter.
    expect(parseAdName('Looking Young l [NRO-V0075] l Jr')).toEqual({
      code: 'NRO-V0075',
      associate: 'Jr',
      teamCode: null,
    });
  });

  it('keeps a capital I inside a word', () => {
    expect(creatorFromAdName('INTERVIEW l [NRO-V0071] l JOSIAH')).toBe('JOSIAH');
  });

  it('survives an unbalanced bracket in the hook', () => {
    // This one is missing its closing paren in the live account.
    expect(parseAdName('DOC ALVIN (SIGNS NG KIDNEY DISEASE l [NRO-V0053] l JOSIAH')).toEqual({
      code: 'NRO-V0053',
      associate: 'JOSIAH',
      teamCode: null,
    });
  });

  it('does not treat a duplicated ad as a different person', () => {
    // Meta appends " - Copy" when an ad is duplicated.
    expect(creatorFromAdName('MALABO MATA l [NRO-V0052] l JOSIAH - Copy')).toBe('JOSIAH');
    expect(creatorFromAdName('MALABO MATA l [NRO-V0052] l JOSIAH - Copy 2')).toBe('JOSIAH');
  });

  it('reads a real pipe as well as the lowercase L', () => {
    expect(creatorFromAdName('ATAKE SA PUSO | [NRO-V0043] | JOSIAH')).toBe('JOSIAH');
  });
});

describe('parseAdName — the underscore convention the ERP documents', () => {
  it('reads team code, associate and number', () => {
    expect(parseAdName('EVIL EYE_UGC_1001_ALY_001')).toEqual({
      code: '001',
      associate: 'ALY',
      teamCode: '1001',
    });
  });

  it('prefers a bracketed code when the name carries one', () => {
    expect(creativeCode('EVIL EYE_UGC_1001_ALY_[NRO-V0099]')).toBe('NRO-V0099');
  });
});

describe('parseAdName — names that say nothing', () => {
  it('names nobody when the name has no structure', () => {
    expect(parseAdName('Vic Sotto 1')).toEqual({
      code: null,
      associate: null,
      teamCode: null,
    });
  });

  it('names nobody from two segments — a sentence is not a convention', () => {
    expect(creatorFromAdName('BATCH 2-3')).toBeNull();
  });

  it('handles an empty or missing name', () => {
    expect(parseAdName('')).toEqual({ code: null, associate: null, teamCode: null });
    expect(parseAdName(null)).toEqual({ code: null, associate: null, teamCode: null });
    expect(parseAdName(undefined)).toEqual({ code: null, associate: null, teamCode: null });
  });

  it('reads a code even when nobody is named', () => {
    expect(creativeCode('SCALE | MARICEL SORIANO')).toBeNull();
    expect(creativeCode('[NRO-V0026] retest')).toBe('NRO-V0026');
  });
});
