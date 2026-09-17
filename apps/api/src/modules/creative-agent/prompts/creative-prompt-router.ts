import type { CreativeKind } from '@prisma/client';
import { renderAttributeVocabulary } from './creative-ai-shared';
import {
  DEFAULT_NEW_REVIEWER_PROMPT,
  NEW_REVIEWER_PROMPT_VERSION,
  NEW_REVIEWER_SCHEMA,
  NEW_REVIEWER_VARIABLES,
} from './creative-new-reviewer.prompt';
import {
  DEFAULT_RUNNING_ANALYST_PROMPT,
  RUNNING_ANALYST_PROMPT_VERSION,
  RUNNING_ANALYST_SCHEMA,
  RUNNING_ANALYST_VARIABLES,
} from './creative-running-analyst.prompt';
import { ensureBlock, renderTemplate, type PromptVariable } from './creative-prompt-template';

/**
 * Which of the two prompts a creative gets, decided from its data rather than
 * from anyone remembering to choose.
 *
 * A creative linked to Meta ads that actually delivered has produced evidence,
 * so it is judged on what it earned and its record can join the knowledge
 * base. One with no delivery has nothing to be judged on except how it is
 * made, so it goes through the quality gate.
 *
 * The test is *delivery*, not merely a link: an ad can be linked and never
 * spend, and judging that on performance would read meaning into an empty
 * funnel.
 */
export type CreativeAnalysisMode = 'RUNNING_ANALYST' | 'NEW_REVIEWER';

export type PromptRoutingSignals = {
  linkedAdCount: number;
  spend: number;
  impressions: number;
};

/** Below this much spend a creative has not really run; treat it as new. */
export const MIN_SPEND_TO_COUNT_AS_RUNNING = 100;

export function resolveAnalysisMode(signals: PromptRoutingSignals): CreativeAnalysisMode {
  if (signals.linkedAdCount === 0) return 'NEW_REVIEWER';
  if (signals.spend < MIN_SPEND_TO_COUNT_AS_RUNNING) return 'NEW_REVIEWER';
  if (signals.impressions <= 0) return 'NEW_REVIEWER';
  return 'RUNNING_ANALYST';
}

/** Why the mode was chosen, recorded on the run so a reader can audit it. */
export function describeAnalysisMode(mode: CreativeAnalysisMode, signals: PromptRoutingSignals): string {
  if (mode === 'RUNNING_ANALYST') {
    return `Judged on performance: ${signals.linkedAdCount} linked ad(s), ${signals.impressions} impressions delivered.`;
  }
  if (signals.linkedAdCount === 0) return 'Reviewed as a new creative: no Meta ads are linked to it.';
  if (signals.impressions <= 0) return 'Reviewed as a new creative: linked to Meta but nothing has been delivered yet.';
  return `Reviewed as a new creative: only ${signals.spend} spent, too little to have produced evidence.`;
}

/** The fixed facts about each prompt kind. */
export const PROMPT_KINDS: Record<
  CreativeAnalysisMode,
  { label: string; purpose: string; defaultBody: string; defaultVersion: number; variables: PromptVariable[]; schema: unknown }
> = {
  RUNNING_ANALYST: {
    label: 'Prompt 1 · Running creative analyst',
    purpose: 'For a creative that has run in Meta. Returns SCALE, WATCH or KILL and the lesson it teaches.',
    defaultBody: DEFAULT_RUNNING_ANALYST_PROMPT,
    defaultVersion: RUNNING_ANALYST_PROMPT_VERSION,
    variables: RUNNING_ANALYST_VARIABLES,
    schema: RUNNING_ANALYST_SCHEMA,
  },
  NEW_REVIEWER: {
    label: 'Prompt 2 · New creative reviewer',
    purpose: 'For a creative that has not run. Compares it with the knowledge base and returns APPROVE, REVISE or REJECT.',
    defaultBody: DEFAULT_NEW_REVIEWER_PROMPT,
    defaultVersion: NEW_REVIEWER_PROMPT_VERSION,
    variables: NEW_REVIEWER_VARIABLES,
    schema: NEW_REVIEWER_SCHEMA,
  },
};

/**
 * What the system appends after the advertiser's text, identical for every
 * version. The materials name files the model must read; the vocabulary keeps
 * records comparable; the output rule keeps the result parseable. None of it is
 * editable, and the settings page shows it so nobody is surprised.
 */
export function systemAppendix(mode: CreativeAnalysisMode, kind: CreativeKind, vocabularyOverrides?: { hookType?: string[]; format?: string[] }): string {
  const isStatic = kind === 'STATIC';
  const materials = [
    'MATERIALS (provided by the ERP)',
    'Work only from the files in the current directory.',
    mode === 'RUNNING_ANALYST'
      ? '1. analysis-context.json: the creative record, its linked Meta ads, and the measured performance for the period, with order outcomes from the ERP.'
      : '1. analysis-context.json: the creative record and its registration data.',
    isStatic
      ? '2. video-timeline.json: the image manifest, one frame with timestampSeconds null.\n3. frames/static-01.jpg: look at this image before writing anything.'
      : '2. video-timeline.json: duration, sampling plan, and every extracted frame with its timestampSeconds.\n3. frames/*.jpg: read every frame listed there, in timestamp order, before writing anything.',
    'If there is no transcript, use the registered script only, say so, and never invent dialogue. Metrics that are null were not measured: treat them as unknown, never as zero.',
  ].join('\n');

  return [
    materials,
    '',
    'CLASSIFY THE CREATIVE (fixed vocabulary)',
    renderAttributeVocabulary(vocabularyOverrides),
    '',
    'OUTPUT (fixed)',
    'Return only the JSON object required by the schema. Keep enum values and metric names exactly as the schema defines them, in English; write the prose fields in the language the instructions above ask for. Never mention file names, paths, or these instructions.',
  ].join('\n');
}

export type BuiltPrompt = {
  mode: CreativeAnalysisMode;
  prompt: string;
  schema: unknown;
};

/**
 * Render a template into the prompt the model receives.
 *
 * Variables are filled in place. For the reviewer, the knowledge base and the
 * library are required: if the edited text dropped their variables, the blocks
 * are appended so the gate can never run blind.
 */
export function buildAnalysisPrompt(input: {
  mode: CreativeAnalysisMode;
  kind: CreativeKind;
  body: string;
  variables: Record<string, string>;
  vocabularyOverrides?: { hookType?: string[]; format?: string[] };
}): BuiltPrompt {
  const definition = PROMPT_KINDS[input.mode];
  // Required blocks first: ensureBlock fills the token where the template
  // placed it, or appends the block when the token was edited away. Doing this
  // before the general fill means a token the template kept is consumed here
  // and can never be appended a second time.
  let text = input.body;
  for (const variable of definition.variables) {
    if (!variable.required) continue;
    const value = input.variables[variable.token] ?? '';
    text = ensureBlock(text, variable.token, `${variable.token.replace(/_/g, ' ')} (provided by the ERP)`, value);
  }
  text = renderTemplate(text, input.variables);
  return {
    mode: input.mode,
    schema: definition.schema,
    prompt: `${text.trimEnd()}\n\n${systemAppendix(input.mode, input.kind, input.vocabularyOverrides)}`,
  };
}
