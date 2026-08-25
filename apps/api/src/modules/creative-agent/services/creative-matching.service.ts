import { Injectable } from '@nestjs/common';
import { CREATIVE_CODE_REGEX } from '../creative-agent.constants';

export type CreativeMatchSource = 'CODE' | 'ALIAS' | 'UNREGISTERED' | 'UNTAGGED';

export type CreativeMatchReference = {
  creativeId: string;
  code: string;
  aliases: string[];
};

export type CreativeNameMatch = {
  source: CreativeMatchSource;
  creativeId: string | null;
  detectedCode: string | null;
};

export type CreativeMatchIndex = {
  exactAliases: Map<string, { creativeId: string; source: 'CODE' | 'ALIAS' }>;
  codeTokens: Array<{ token: string; creativeId: string; source: 'CODE' | 'ALIAS' }>;
};

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class CreativeMatchingService {
  buildIndex(references: CreativeMatchReference[]): CreativeMatchIndex {
    const exactAliases = new Map<string, { creativeId: string; source: 'CODE' | 'ALIAS' }>();
    const codeTokens: Array<{ token: string; creativeId: string; source: 'CODE' | 'ALIAS' }> = [];

    for (const reference of references) {
      const code = normalize(reference.code);
      exactAliases.set(code, { creativeId: reference.creativeId, source: 'CODE' });
      codeTokens.push({ token: code, creativeId: reference.creativeId, source: 'CODE' });
      for (const rawAlias of reference.aliases) {
        const alias = normalize(rawAlias);
        if (!alias) continue;
        exactAliases.set(alias, { creativeId: reference.creativeId, source: 'ALIAS' });
        if (/^[A-Z]{2,6}-V\d{3,6}$/.test(alias)) {
          codeTokens.push({ token: alias, creativeId: reference.creativeId, source: 'ALIAS' });
        }
      }
    }
    return { exactAliases, codeTokens };
  }

  match(adName: string, references: CreativeMatchReference[] | CreativeMatchIndex): CreativeNameMatch {
    const normalizedName = normalize(adName);
    const { exactAliases, codeTokens } = Array.isArray(references)
      ? this.buildIndex(references)
      : references;

    let earliest: { index: number; token: string; creativeId: string; source: 'CODE' | 'ALIAS' } | null = null;
    for (const token of codeTokens.filter((candidate) => candidate.source === 'CODE')) {
      const match = new RegExp(`(?<![A-Za-z])${escapeRegex(token.token)}(?!\\d)`, 'i').exec(adName);
      if (match && (!earliest || match.index < earliest.index)) {
        earliest = { ...token, index: match.index };
      }
    }
    if (earliest) {
      return {
        source: earliest.source,
        creativeId: earliest.creativeId,
        detectedCode: earliest.token,
      };
    }

    const exact = exactAliases.get(normalizedName);
    if (exact) {
      return { source: exact.source, creativeId: exact.creativeId, detectedCode: normalizedName };
    }

    earliest = null;
    for (const token of codeTokens.filter((candidate) => candidate.source === 'ALIAS')) {
      const match = new RegExp(`(?<![A-Za-z])${escapeRegex(token.token)}(?!\\d)`, 'i').exec(adName);
      if (match && (!earliest || match.index < earliest.index)) {
        earliest = { ...token, index: match.index };
      }
    }
    if (earliest) {
      return { source: 'ALIAS', creativeId: earliest.creativeId, detectedCode: earliest.token };
    }

    const generic = new RegExp(CREATIVE_CODE_REGEX.source, 'i').exec(adName);
    if (generic?.[1]) {
      return { source: 'UNREGISTERED', creativeId: null, detectedCode: generic[1].toUpperCase() };
    }
    return { source: 'UNTAGGED', creativeId: null, detectedCode: null };
  }
}
