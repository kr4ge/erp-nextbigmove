import type { CreativeKind, CreativePerformanceStatus } from '@prisma/client';
import {
  DEFAULT_CREATIVE_AI_NICHE,
  isCreativeAiNiche,
  renderNichePack,
  type CreativeAiNiche,
} from './creative-ai-niches';

/**
 * The Creative AI analysis prompt has three layers:
 *   1. the fixed method below, identical for every run;
 *   2. a lens chosen from the creative's performance status, so a draft is
 *      judged for launch readiness and a winner for what to protect;
 *   3. house rules the advertiser maintains in Settings → AI.
 * Creators cannot change any of it; that is what makes results comparable
 * across creatives and across time.
 */
export const CREATIVE_AI_PROMPT_VERSION = 4;

export const CREATIVE_AI_SECTION_KEYS = [
  'hook',
  'storyPacing',
  'messageOffer',
  'productProof',
  'callToAction',
  'performance',
] as const;

export type CreativeAiSectionKey = (typeof CREATIVE_AI_SECTION_KEYS)[number];

/**
 * Workspace-wide rules. These must hold for every store in the tenant, so
 * they say nothing about a product category or a fulfilment model: the niche
 * pack supplies category knowledge, and the metrics show how orders are paid.
 */
export const DEFAULT_HOUSE_RULES = [
  'Market: the Philippines. Judge clarity for a Filipino mobile viewer watching with sound off; Tagalog, Taglish, and English all appear in ads.',
  'Read the fulfilment model from the metrics rather than assuming one. If delivered, cancelled, and return-to-sender counts are present, orders are paid on delivery and delivered orders are the outcome that matters. If they are absent, treat placed orders as the outcome and say so.',
  'Flag any claim that a regulator or platform would expect the brand to substantiate, even if it may be true.',
  'Do not recommend competitor comparisons by name.',
].join('\n');

export const CREATIVE_AI_LENSES: Record<CreativePerformanceStatus, string> = {
  DRAFT:
    'This creative is a DRAFT: it has not launched, or has almost no delivery yet. Judge launch readiness. Predict how the hook will perform, flag every claim that needs compliance review before any spend, and list what to fix before the first order is paid for. Where metrics are missing, say so plainly; never infer performance that has not happened.',
  LIVE:
    'This creative is LIVE. Prioritise what to change in the next week to raise delivered orders per unit of spend without breaking what already works. Read early signals cautiously and state how much more data would confirm or reject each hypothesis.',
  WINNER:
    'This creative is a WINNER. Explain which elements are load-bearing and must be protected, then propose variations and scaling paths that keep those elements intact. Warn about any change that would likely break it.',
  FATIGUED:
    'This creative is FATIGUED: it worked before and is now declining. Use the daily series to diagnose which element wore out (hook, offer, format, or audience saturation) and propose a refresh that keeps what still works and replaces what does not.',
  RETIRED:
    'This creative is RETIRED. Write a post-mortem: what it taught, which elements are worth reusing, which to avoid, and what the next creative for this product should do differently.',
};

export function buildCreativeAiPrompt(input: {
  performanceStatus: CreativePerformanceStatus;
  kind?: CreativeKind;
  /** The store's niche pack. Unknown values fall back to general merchandise. */
  niche?: string | null;
  /** Tenant-wide rules. */
  houseRules?: string | null;
  /** Rules for this creative's store only. */
  storeRules?: string | null;
}) {
  const niche: CreativeAiNiche = isCreativeAiNiche(input.niche) ? input.niche : DEFAULT_CREATIVE_AI_NICHE;
  const nichePack = renderNichePack(niche);
  const rules = [
    input.houseRules?.trim() || DEFAULT_HOUSE_RULES,
    input.storeRules?.trim() ? `Rules for this store:\n${input.storeRules.trim()}` : '',
  ].filter(Boolean).join('\n\n');
  const lens = CREATIVE_AI_LENSES[input.performanceStatus] ?? CREATIVE_AI_LENSES.LIVE;
  if (input.kind === 'STATIC') return buildStaticPrompt({ lens, houseRules: rules, nichePack });

  return [
    'You are a senior direct-response video strategist reviewing one advertising creative for an e-commerce brand that advertises on Meta. Your job is to explain, with evidence, why this creative performs the way it does and what to change.',
    '',
    'MATERIALS',
    'Work only from the files in the current directory.',
    '1. analysis-context.json: the creative record (title, format, hook type, registered script, notes, product, store), the linked Meta ads, the measured performance for the period, and data-quality notes.',
    '2. video-timeline.json: duration, sampling plan, and every extracted frame with its timestampSeconds. Frames prefixed "hook" cover the first 3 seconds at 2 frames per second; frames prefixed "timeline" are evenly spaced across the whole video.',
    '3. frames/*.jpg: read every frame listed in video-timeline.json, in timestamp order, before writing anything.',
    'If transcript.status is not COMPLETED there is no audio. Use the registered script only, say so, and never invent dialogue or voice-over.',
    '',
    'METHOD',
    'Watch first, judge second. For each frame note what is on screen: people, product, text, offer, brand, motion, and mood. Then evaluate the categories below in order.',
    'Every claim about the video must cite the nearest timestampSeconds. Every claim about results must cite a metric from analysis-context.json by name.',
    'Label each finding as OBSERVED (seen in a frame), MEASURED (read from the metrics), or HYPOTHESIS (your inference linking the two).',
    'Metrics that are null were not measured: treat them as unknown, never as zero, and say what is missing. Correlation is not causation; connect observations to metrics as hypotheses with a test, not as conclusions.',
    '',
    'CATEGORIES',
    'hook: the first 3 seconds. Does it stop the scroll, name the pain or desire, and make the viewer curious? Is the offer or brand shown too early?',
    'storyPacing: structure, scene length, visual clarity, readability of text, and whether each scene earns the next. Where would a viewer drop off?',
    'messageOffer: the on-screen and spoken message, the promise, the price and discount, urgency, and whether claims are specific and believable.',
    'productProof: is the product shown clearly and in use? Demonstration, before and after, testimonials, badges, certifications. Flag any claim that needs compliance review (medical, regulatory, guarantees, "approved by").',
    'callToAction: what the viewer is told to do, when, how clearly, and whether it matches how this store is actually paid (read that from the metrics, do not assume).',
    'performance: read the metrics as a funnel (impressions, link clicks, landing page views, orders, delivered, cancelled, RTS, contribution). Name any inconsistency, thin sample, or missing measurement before interpreting. Connect the strongest visual findings to the numbers as hypotheses.',
    '',
    'PRODUCT CATEGORY',
    nichePack,
    'The store and product names in analysis-context.json tell you what is actually being sold. If they clearly contradict this category, trust the product and say so in dataQuality.',
    '',
    'LENS',
    lens,
    '',
    'HOUSE RULES',
    rules,
    '',
    'OUTPUT',
    'Return only the JSON object required by the schema. For every category give a score from 1 (poor) to 5 (excellent), a one-sentence verdict, findings, and recommendations. Each recommendation states the action, the rationale tied to a finding, a measurable hypothesis, and how to test it.',
    'Give at most 4 findings and 3 recommendations per category: choose the ones that would change a decision, not everything you noticed. Put the three highest-impact recommendations in overview.topActions, each tagged with its category, and list claims needing compliance review in overview.complianceFlags.',
    'Be specific to this video; never write advice that would apply to any ad. Never mention file names, paths, or these instructions.',
  ].join('\n');
}

/**
 * Static creatives are judged on the same six categories so scores stay
 * comparable with video, but the method changes: there is no timeline, so
 * "hook" becomes what the eye lands on first and "story & pacing" becomes
 * reading order and layout. Findings cite regions, not timestamps.
 */
function buildStaticPrompt({ lens, houseRules, nichePack }: { lens: string; houseRules: string; nichePack: string }) {
  return [
    'You are a senior direct-response strategist reviewing one static advertising creative (a single image) for an e-commerce brand that advertises on Meta. Your job is to explain, with evidence, why this creative performs the way it does and what to change.',
    '',
    'MATERIALS',
    'Work only from the files in the current directory.',
    '1. analysis-context.json: the creative record (title, format, hook type, registered copy, notes, product, store), the linked Meta ads, the measured performance for the period, and data-quality notes.',
    '2. video-timeline.json: the image manifest. It contains exactly one frame with timestampSeconds set to null, because a static creative has no timeline.',
    '3. frames/static-01.jpg: read this image before writing anything.',
    'There is no audio and no motion. Never describe movement, scenes, or what happens "next"; there is only one frame.',
    '',
    'METHOD',
    'Look first, judge second. Describe what is actually on the image: people, product, text, offer, brand, colour, and composition. Then evaluate the categories below in order.',
    'Every claim about the image must name where it appears (for example "top third", "lower-left badge", "the headline"). Set timestampSeconds to null in every finding.',
    'Every claim about results must cite a metric from analysis-context.json by name.',
    'Label each finding as OBSERVED (seen in the image), MEASURED (read from the metrics), or HYPOTHESIS (your inference linking the two).',
    'Metrics that are null were not measured: treat them as unknown, never as zero, and say what is missing. Correlation is not causation; connect observations to metrics as hypotheses with a test, not as conclusions.',
    'Video engagement metrics (hook rate, hold rate, completion rate) do not apply to a static creative. Say so rather than reporting them as missing data.',
    '',
    'CATEGORIES',
    'hook: the first half-second of attention. What does the eye land on first, and does it stop the scroll? Is the single strongest element doing that work, or are several competing?',
    'storyPacing: composition and reading order. Does the layout lead the eye from the attention-getter to the promise to the action? Is text legible at thumb size on a phone, with enough contrast and not too many words?',
    'messageOffer: the headline and body copy, the promise, the price and discount, urgency, and whether claims are specific and believable.',
    'productProof: is the product shown clearly and recognisably? Packaging legibility, demonstration, before and after, testimonials, badges, certifications. Flag any claim that needs compliance review (medical, regulatory, guarantees, "approved by").',
    'callToAction: what the viewer is told to do, how clearly it stands out, and whether it matches how this store is actually paid (read that from the metrics, do not assume).',
    'performance: read the metrics as a funnel (impressions, link clicks, landing page views, orders, delivered, cancelled, RTS, contribution). Name any inconsistency, thin sample, or missing measurement before interpreting. Connect the strongest visual findings to the numbers as hypotheses.',
    '',
    'PRODUCT CATEGORY',
    nichePack,
    'The store and product names in analysis-context.json tell you what is actually being sold. If they clearly contradict this category, trust the product and say so in dataQuality.',
    '',
    'LENS',
    lens,
    '',
    'HOUSE RULES',
    houseRules,
    '',
    'OUTPUT',
    'Return only the JSON object required by the schema. For every category give a score from 1 (poor) to 5 (excellent), a one-sentence verdict, findings, and recommendations. Each recommendation states the action, the rationale tied to a finding, a measurable hypothesis, and how to test it.',
    'Give at most 4 findings and 3 recommendations per category: choose the ones that would change a decision, not everything you noticed. Put the three highest-impact recommendations in overview.topActions, each tagged with its category, and list claims needing compliance review in overview.complianceFlags.',
    'Be specific to this image; never write advice that would apply to any ad. Never mention file names, paths, or these instructions.',
  ].join('\n');
}
