import { describe, expect, it } from '@jest/globals';
import {
  MIN_SPEND_TO_COUNT_AS_RUNNING,
  PROMPT_KINDS,
  buildAnalysisPrompt,
  describeAnalysisMode,
  resolveAnalysisMode,
  systemAppendix,
} from './creative-prompt-router';
import { ensureBlock, extractTokens, renderTemplate, unknownTokens } from './creative-prompt-template';

/**
 * The routing decision is the thing the user asked to be automatic, so it is
 * the thing most worth pinning down.
 */
describe('resolveAnalysisMode', () => {
  it('judges a creative with real delivery on its performance', () => {
    expect(resolveAnalysisMode({ linkedAdCount: 1, spend: 16594, impressions: 11686 })).toBe('RUNNING_ANALYST');
  });

  it('reviews a creative with no linked ads as new', () => {
    expect(resolveAnalysisMode({ linkedAdCount: 0, spend: 0, impressions: 0 })).toBe('NEW_REVIEWER');
  });

  it('reviews a linked creative that never delivered as new', () => {
    // An ad can be linked and never actually run. Handing that to the
    // performance analyst would ask it to read an empty funnel.
    expect(resolveAnalysisMode({ linkedAdCount: 2, spend: 0, impressions: 0 })).toBe('NEW_REVIEWER');
  });

  it('reviews a barely-spent creative as new rather than judging noise', () => {
    expect(resolveAnalysisMode({ linkedAdCount: 1, spend: 40, impressions: 800 })).toBe('NEW_REVIEWER');
  });

  it('switches to performance exactly at the spend floor', () => {
    expect(resolveAnalysisMode({ linkedAdCount: 1, spend: MIN_SPEND_TO_COUNT_AS_RUNNING, impressions: 500 })).toBe('RUNNING_ANALYST');
  });

  it('reviews as new when spend exists but nothing was seen', () => {
    expect(resolveAnalysisMode({ linkedAdCount: 1, spend: 5000, impressions: 0 })).toBe('NEW_REVIEWER');
  });
});

describe('describeAnalysisMode', () => {
  it('says why a creative was treated as new, so a reader can audit it', () => {
    expect(describeAnalysisMode('NEW_REVIEWER', { linkedAdCount: 0, spend: 0, impressions: 0 })).toMatch(/no Meta ads are linked/i);
    expect(describeAnalysisMode('NEW_REVIEWER', { linkedAdCount: 1, spend: 5000, impressions: 0 })).toMatch(/nothing has been delivered/i);
  });
});

describe('prompt templates', () => {
  it('fills known variables and leaves unknown ones visible', () => {
    // A typo must show up in the rendered prompt, not silently become "".
    expect(renderTemplate('Hi {{STORE_NAME}}, {{TYPO}}', { STORE_NAME: 'Ogimi' })).toBe('Hi Ogimi, {{TYPO}}');
  });

  it('tolerates spaces inside the braces', () => {
    expect(renderTemplate('{{ STORE_NAME }}', { STORE_NAME: 'Ogimi' })).toBe('Ogimi');
  });

  it('lists tokens once, in order of first use', () => {
    expect(extractTokens('{{A}} {{B}} {{A}}')).toEqual(['A', 'B']);
  });

  it('reports tokens that nothing will fill', () => {
    expect(unknownTokens('{{STORE_NAME}} {{NOPE}}', PROMPT_KINDS.NEW_REVIEWER.variables)).toEqual(['NOPE']);
  });

  it('replaces a required block in place when its variable is present', () => {
    const out = ensureBlock('before {{KNOWLEDGE_BASE}} after', 'KNOWLEDGE_BASE', 'KB', 'corpus');
    expect(out).toBe('before corpus after');
  });

  it('appends a required block when the variable was edited away', () => {
    const out = ensureBlock('no token here', 'KNOWLEDGE_BASE', 'KNOWLEDGE BASE', 'corpus');
    expect(out).toMatch(/no token here\n\nKNOWLEDGE BASE\ncorpus$/);
  });
});

describe('buildAnalysisPrompt', () => {
  const analyst = () =>
    buildAnalysisPrompt({
      mode: 'RUNNING_ANALYST',
      kind: 'VIDEO',
      body: PROMPT_KINDS.RUNNING_ANALYST.defaultBody,
      variables: { STORE_NAME: 'Ogimi Wellness', PRODUCT_NAME: 'Cellular Defense', CREATIVE_CODE: 'OW-V0002', PERIOD: '2026-08-19 to 2026-09-17' },
    });

  it('renders the running analyst with its variables filled', () => {
    const built = analyst();
    expect(built.mode).toBe('RUNNING_ANALYST');
    expect(built.prompt).toContain('OW-V0002 from Ogimi Wellness, advertising Cellular Defense');
    expect(built.prompt).not.toMatch(/\{\{STORE_NAME\}\}/);
  });

  it('always appends the fixed materials, vocabulary and output rule', () => {
    const built = analyst();
    expect(built.prompt).toMatch(/MATERIALS \(provided by the ERP\)/);
    expect(built.prompt).toMatch(/CLASSIFY THE CREATIVE \(fixed vocabulary\)/);
    expect(built.prompt).toMatch(/OUTPUT \(fixed\)/);
    expect(built.prompt).toContain('pattern interrupt');
  });

  it('keeps the SCALE / WATCH / KILL rules from the default text', () => {
    expect(analyst().prompt).toMatch(/SCALE, WATCH, or KILL/);
    expect(analyst().prompt).toMatch(/NO_THRESHOLDS/);
  });

  it('injects the knowledge base into the reviewer even if the text dropped the variable', () => {
    // The gate must never run blind, whatever the advertiser edited.
    const built = buildAnalysisPrompt({
      mode: 'NEW_REVIEWER',
      kind: 'VIDEO',
      body: 'Judge this creative for {{STORE_NAME}}. No other instructions.',
      variables: { STORE_NAME: 'Dear Scent', KNOWLEDGE_BASE: 'WINNER (1):\n- DS-V0001', LIBRARY: '- DS-V0002' },
    });
    expect(built.prompt).toContain('WINNER (1):');
    expect(built.prompt).toContain('- DS-V0002');
    expect(built.prompt).toMatch(/KNOWLEDGE BASE \(provided by the ERP\)/);
  });

  it('places the knowledge base where the text asks for it, without duplicating it', () => {
    const built = buildAnalysisPrompt({
      mode: 'NEW_REVIEWER',
      kind: 'VIDEO',
      body: 'A\n{{KNOWLEDGE_BASE}}\nB\n{{LIBRARY}}\nC',
      variables: { KNOWLEDGE_BASE: 'CORPUS-X', LIBRARY: 'LIB-Y' },
    });
    expect(built.prompt.split('CORPUS-X')).toHaveLength(2);
    expect(built.prompt).toMatch(/A\nCORPUS-X\nB\nLIB-Y\nC/);
  });

  it('describes a static creative as one frame', () => {
    const built = buildAnalysisPrompt({ mode: 'NEW_REVIEWER', kind: 'STATIC', body: 'x', variables: {} });
    expect(built.prompt).toMatch(/one frame with timestampSeconds null/);
  });

  it('tells a video analysis about the sheets, the frames and the transcript', () => {
    const built = analyst();
    expect(built.prompt).toMatch(/sheets\/\*\.jpg/);
    expect(built.prompt).toMatch(/amber label marks the first frame of a detected scene/);
    expect(built.prompt).toMatch(/transcript\.status is COMPLETED/);
    expect(built.prompt).toMatch(/TIMELINE \(fixed\)/);
  });

  it('never mentions sheets or a transcript for a static creative', () => {
    const built = buildAnalysisPrompt({ mode: 'RUNNING_ANALYST', kind: 'STATIC', body: 'x', variables: {} });
    expect(built.prompt).not.toMatch(/sheets\//);
    expect(built.prompt).not.toMatch(/transcript\.status/);
    expect(built.prompt).toMatch(/startSeconds and endSeconds 0/);
  });

  it('requires the timeline and beats from both prompts', () => {
    for (const mode of ['RUNNING_ANALYST', 'NEW_REVIEWER'] as const) {
      const schema = PROMPT_KINDS[mode].schema as { required: readonly string[]; properties: Record<string, unknown> };
      expect(schema.required).toEqual(expect.arrayContaining(['timeline', 'beats']));
      expect(schema.properties.timeline).toBeDefined();
      expect(schema.properties.beats).toBeDefined();
    }
  });

  it('ships default bodies that use every required variable', () => {
    for (const mode of ['RUNNING_ANALYST', 'NEW_REVIEWER'] as const) {
      const used = extractTokens(PROMPT_KINDS[mode].defaultBody);
      for (const variable of PROMPT_KINDS[mode].variables.filter((v) => v.required)) {
        expect(used).toContain(variable.token);
      }
      expect(unknownTokens(PROMPT_KINDS[mode].defaultBody, PROMPT_KINDS[mode].variables)).toEqual([]);
    }
  });

  it('gives both prompts the same vocabulary so records stay comparable', () => {
    const a = systemAppendix('RUNNING_ANALYST', 'VIDEO');
    const b = systemAppendix('NEW_REVIEWER', 'VIDEO');
    for (const token of ['pattern interrupt', 'talking head UGC', 'durationBucket', 'priceVisible']) {
      expect(a).toContain(token);
      expect(b).toContain(token);
    }
  });
});
