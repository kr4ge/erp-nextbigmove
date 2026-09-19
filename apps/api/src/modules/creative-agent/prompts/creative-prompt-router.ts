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
  const contextLine = mode === 'RUNNING_ANALYST'
    ? '1. analysis-context.json: the creative record, its linked Meta ads, and the measured performance for the period, with order outcomes from the ERP.'
      + (isStatic ? '' : ' It also carries `video` (duration, scene count, pacing measured by code) and, when Meta measured it, `retention`: how many viewers were still watching at 25, 50, 75, 95 and 100 percent of the length, each mapped to a timestamp and to the scene containing it.')
    : '1. analysis-context.json: the creative record and its registration data.'
      + (isStatic ? '' : ' It also carries `video`: duration, scene count and pacing measured by code.');
  const materials = [
    'MATERIALS (provided by the ERP)',
    'Work only from the files in the current directory.',
    contextLine,
    isStatic
      ? '2. video-timeline.json: the image manifest, one frame with timestampSeconds null.\n3. frames/static-01.jpg: look at this image before writing anything.'
      : [
          '2. video-timeline.json: the detected scenes with their startSeconds and endSeconds, every contact sheet with the timestamp of each cell, the full-size frames, the transcript with per-line timestamps, and the pacing measurements (cuts per minute, longest static run, when speech starts, silences).',
          '3. sheets/*.jpg: the whole video sampled once a second, in timestamp order, tiled onto sheets. Every cell shows its timestamp in the corner; an amber label marks the first frame of a detected scene. Read every sheet in order, several per turn, before writing anything.',
          '4. frames/*.jpg: full-size frames for the hook (the first 3 seconds, two per second) and for the first frame of each scene. Open one only when a sheet cannot show the detail you need, such as small on-screen text or a price card.',
          'Sound: when transcript.status is COMPLETED in video-timeline.json, its segments are what was actually said, with timestamps; quote from them. When there is no transcript, use the registered script only, say so, and never invent dialogue.',
        ].join('\n'),
    'Metrics that are null were not measured: treat them as unknown, never as zero.',
  ].join('\n');

  const timeline = [
    'TIMELINE (fixed)',
    isStatic
      ? 'Fill `timeline` with one entry per region of the image in reading order (headline, product, offer, call to action, and so on), each with startSeconds and endSeconds 0, the role it plays, what is seen, the text it carries, spokenLine null, the technique used, an issue if there is one, and KEEP or FIX. Fill `beats` with 0 for what is present and null for what is absent; the three first-3-seconds flags describe the image itself.'
      : 'Before judging, fill `timeline`: one entry per scene as you read the creative, using the detected scenes in video-timeline.json as the starting point and merging or splitting them where the content demands, covering the whole running time. Each entry gives startSeconds and endSeconds, a role (HOOK, PROBLEM, PROOF, DEMO, OFFER, CTA, OTHER), what is seen, the on-screen text (null when none), the spoken line quoted from the transcript (null when none), the technique the maker used, an issue if there is one (null otherwise), and KEEP or FIX. Then fill `beats` with the moments the timeline reveals, in seconds from the start and null when the moment never comes: when the hook ends, when the product, the price and the call to action first appear, and whether a face, speech and on-screen text are present in the first 3 seconds. Every timestamp you cite anywhere in the result must appear on a sheet or in the transcript.',
  ].join('\n');

  return [
    materials,
    '',
    timeline,
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
