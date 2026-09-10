import { describe, expect, it } from '@jest/globals';
import { isCreativeAiEnabled } from './creative-ai-enabled';

describe('isCreativeAiEnabled', () => {
  it('is fail-closed when the setting is missing or disabled', () => {
    expect(isCreativeAiEnabled(undefined)).toBe(false);
    expect(isCreativeAiEnabled('false')).toBe(false);
    expect(isCreativeAiEnabled('1')).toBe(false);
  });

  it('accepts an explicit true value without case or whitespace sensitivity', () => {
    expect(isCreativeAiEnabled('true')).toBe(true);
    expect(isCreativeAiEnabled(' TRUE ')).toBe(true);
  });
});
