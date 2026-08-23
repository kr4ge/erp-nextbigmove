import { describe, expect, it } from '@jest/globals';
import { CreativeMatchingService } from './creative-matching.service';

describe('CreativeMatchingService', () => {
  const service = new CreativeMatchingService();
  const references = [
    { creativeId: 'creative-1', code: 'NRO-V0001', aliases: ['NRO-V0999', 'legacy hero ad'] },
    { creativeId: 'creative-2', code: 'NRO-V0002', aliases: [] },
  ];

  it('matches a canonical code case-insensitively', () => {
    expect(service.match('nro-v0001', references)).toEqual({
      source: 'CODE',
      creativeId: 'creative-1',
      detectedCode: 'NRO-V0001',
    });
  });

  it('chooses the earliest canonical code in an ad name', () => {
    expect(service.match('launch NRO-V0002 then NRO-V0001', references)).toMatchObject({
      source: 'CODE',
      creativeId: 'creative-2',
      detectedCode: 'NRO-V0002',
    });
  });

  it('prioritizes a canonical code over an exact legacy alias', () => {
    const indexed = [
      ...references,
      { creativeId: 'creative-3', code: 'SLV-V0001', aliases: ['launch NRO-V0002'] },
    ];
    expect(service.match('launch NRO-V0002', indexed)).toMatchObject({
      source: 'CODE',
      creativeId: 'creative-2',
    });
  });

  it('matches exact and code-shaped aliases', () => {
    expect(service.match('legacy hero ad', references)).toMatchObject({ source: 'ALIAS', creativeId: 'creative-1' });
    expect(service.match('campaign NRO-V0999 retargeting', references)).toMatchObject({
      source: 'ALIAS',
      creativeId: 'creative-1',
      detectedCode: 'NRO-V0999',
    });
  });

  it('returns a valid unknown code as unregistered', () => {
    expect(service.match('testing NRO-V0100', references)).toEqual({
      source: 'UNREGISTERED',
      creativeId: null,
      detectedCode: 'NRO-V0100',
    });
  });

  it('rejects prefixes and numeric suffixes outside the allowed lengths', () => {
    expect(service.match('ABCDEFG-V0001', references).source).toBe('UNTAGGED');
    expect(service.match('NRO-V0001234', references).source).toBe('UNTAGGED');
  });

  it('returns untagged when no registry code is present', () => {
    expect(service.match('summer sale hero', references)).toEqual({
      source: 'UNTAGGED',
      creativeId: null,
      detectedCode: null,
    });
  });
});
