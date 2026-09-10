import { describe, expect, it } from '@jest/globals';
import {
  isManualMetaAccountId,
  preferCanonicalMetaAdIdentity,
} from './meta-ad-identity';

describe('Meta ad identity', () => {
  it('recognizes temporary manual CSV account identities', () => {
    expect(isManualMetaAccountId('manual:legacy-upload')).toBe(true);
    expect(isManualMetaAccountId('  MANUAL:legacy-upload ')).toBe(true);
    expect(isManualMetaAccountId('1889518721645704')).toBe(false);
  });

  it('prefers a provider account for the same Ad ID', () => {
    const manual = { accountId: 'manual:legacy-upload', adId: 'ad-1', adName: 'Legacy' };
    const provider = { accountId: '1889518721645704', adId: 'ad-1', adName: 'Provider' };

    expect(preferCanonicalMetaAdIdentity(manual, provider)).toBe(provider);
    expect(preferCanonicalMetaAdIdentity(provider, manual)).toBe(provider);
  });
});
