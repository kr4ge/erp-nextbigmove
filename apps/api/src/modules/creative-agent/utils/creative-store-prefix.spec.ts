import { describe, expect, it } from '@jest/globals';
import { deriveCreativeStorePrefix, deriveCreativeStorePrefixCandidate } from './creative-store-prefix';

describe('creative store prefix', () => {
  it.each([
    ['Next Big Move', 'NBM'],
    ['Agriblast PH', 'AP'],
    ['NRO', 'NRO'],
    ['A', 'AX'],
    ['Caf\u00e9 Market', 'CM'],
  ])('derives %s as %s', (storeName, expected) => {
    expect(deriveCreativeStorePrefix(storeName)).toBe(expected);
  });

  it('creates a stable letters-only alternative after a collision', () => {
    const candidate = deriveCreativeStorePrefixCandidate('Next Big Move', 'store-1', 1);
    expect(candidate).toMatch(/^[A-Z]{2,6}$/);
    expect(candidate).not.toBe('NBM');
    expect(deriveCreativeStorePrefixCandidate('Next Big Move', 'store-1', 1)).toBe(candidate);
  });
});
