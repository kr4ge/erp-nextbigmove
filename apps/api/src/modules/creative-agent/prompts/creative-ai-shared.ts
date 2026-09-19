/**
 * What both analysis prompts share, and what the advertiser cannot edit.
 *
 * The prompt wording is theirs. The output contract is not: the ERP parses it,
 * the knowledge base stores it, and a new creative is compared against old
 * records field by field. So the attribute vocabulary and the JSON shape live
 * here in code, and are appended to every prompt the same way regardless of
 * what the editable text says.
 */

/**
 * Fixed attribute vocabulary.
 *
 * A record written when a creative was new must be comparable with the record
 * written once it has run, which only holds if both classify with the same
 * words. A tenant's own hook types and formats are merged in at run time, and
 * OTHER always remains so a genuinely new idea is describable rather than forced
 * into the nearest wrong box.
 */
export const CREATIVE_ATTRIBUTE_VOCABULARY = {
  angle: [
    'pain point',
    'transformation',
    'social proof',
    'authority',
    'price/offer',
    'fear of missing out',
    'education',
    'comparison',
    'OTHER',
  ],
  hookType: [
    'metaphor',
    'pattern interrupt',
    'contrarian',
    'story',
    'question',
    'shock stat',
    'callout',
    'confession',
    'prediction',
    'admission',
    'OTHER',
  ],
  format: [
    'talking head UGC',
    'testimonial',
    'product demo',
    'voiceover with b-roll',
    'skit',
    'text-on-screen only',
    'static image',
    'carousel',
    'OTHER',
  ],
  speaker: ['female 25-35', 'female 36+', 'male 25-35', 'male 36+', 'expert', 'customer', 'no speaker', 'OTHER'],
  durationBucket: ['under 15s', '15-30s', '30-60s', 'over 60s'],
  offerShown: ['bundle', 'discount', 'free shipping', 'COD emphasis', 'none', 'OTHER'],
  ctaType: ['order now', 'message us', 'learn more', 'limited stock', 'none'],
} as const;

/** The attribute lists as prompt text, with any tenant additions merged in. */
export function renderAttributeVocabulary(overrides?: { hookType?: string[]; format?: string[] }): string {
  const merge = (base: readonly string[], extra?: string[]) => [...new Set([...(extra ?? []), ...base])].join(', ');
  return [
    'Record the creative\'s attributes using only these values, so it can be compared with every other record. If nothing fits, use OTHER and describe it in otherNote.',
    `- angle: ${merge(CREATIVE_ATTRIBUTE_VOCABULARY.angle)}`,
    `- hookType: ${merge(CREATIVE_ATTRIBUTE_VOCABULARY.hookType, overrides?.hookType)}`,
    `- format: ${merge(CREATIVE_ATTRIBUTE_VOCABULARY.format, overrides?.format)}`,
    `- speaker: ${merge(CREATIVE_ATTRIBUTE_VOCABULARY.speaker)}`,
    `- durationBucket: ${merge(CREATIVE_ATTRIBUTE_VOCABULARY.durationBucket)}`,
    `- offerShown: ${merge(CREATIVE_ATTRIBUTE_VOCABULARY.offerShown)}`,
    `- ctaType: ${merge(CREATIVE_ATTRIBUTE_VOCABULARY.ctaType)}`,
    '- priceVisible: true or false',
  ].join('\n');
}

/** The attribute block both prompts emit into their result. */
export const ATTRIBUTE_SCHEMA_PROPERTIES = {
  angle: { type: 'string' },
  hookType: { type: 'string' },
  format: { type: 'string' },
  speaker: { type: 'string' },
  durationBucket: { type: 'string' },
  offerShown: { type: 'string' },
  ctaType: { type: 'string' },
  priceVisible: { type: 'boolean' },
  otherNote: {
    type: ['string', 'null'],
    description: 'One line describing the attribute, required whenever any field above is OTHER.',
  },
} as const;

/** The job a scene does in a direct-response ad. */
export const TIMELINE_ROLES = ['HOOK', 'PROBLEM', 'PROOF', 'DEMO', 'OFFER', 'CTA', 'OTHER'] as const;

/**
 * The scene-by-scene record both prompts must produce.
 *
 * The verdict says what a creative earned; the timeline says how it is built,
 * scene by scene, with what was seen, shown and said. It is what the storyboard
 * displays and what the knowledge base keeps, so its shape is fixed here.
 */
export const TIMELINE_SCHEMA_PROPERTIES = {
  timeline: {
    type: 'array',
    minItems: 1,
    maxItems: 48,
    description: 'One entry per scene, in order, covering the whole creative.',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['startSeconds', 'endSeconds', 'role', 'whatIsSeen', 'onScreenText', 'spokenLine', 'technique', 'issue', 'keepOrFix'],
      properties: {
        startSeconds: { type: 'number', minimum: 0 },
        endSeconds: { type: 'number', minimum: 0 },
        role: { type: 'string', enum: TIMELINE_ROLES },
        whatIsSeen: { type: 'string', maxLength: 240, description: 'The shot, in one line.' },
        onScreenText: { type: ['string', 'null'], maxLength: 240 },
        spokenLine: { type: ['string', 'null'], maxLength: 300, description: 'Quoted from the transcript; null when nothing is said.' },
        technique: { type: ['string', 'null'], maxLength: 160, description: 'What the maker did here: a cut, a caption style, a demonstration, a testimonial.' },
        issue: { type: ['string', 'null'], maxLength: 240 },
        keepOrFix: { type: 'string', enum: ['KEEP', 'FIX'] },
      },
    },
  },
  beats: {
    type: 'object',
    additionalProperties: false,
    required: ['hookEndsAt', 'productFirstSeenAt', 'priceFirstSeenAt', 'ctaFirstSeenAt', 'faceInFirst3s', 'speechInFirst3s', 'textInFirst3s'],
    properties: {
      hookEndsAt: { type: ['number', 'null'], description: 'Seconds from the start where the opening gives way to the body.' },
      productFirstSeenAt: { type: ['number', 'null'] },
      priceFirstSeenAt: { type: ['number', 'null'], description: 'Null when the price is never shown or spoken.' },
      ctaFirstSeenAt: { type: ['number', 'null'] },
      faceInFirst3s: { type: 'boolean' },
      speechInFirst3s: { type: 'boolean' },
      textInFirst3s: { type: 'boolean' },
    },
  },
} as const;

/**
 * The six categories the earlier analysis format reported on. Kept so the
 * knowledge base can still read records written before the two-prompt design.
 */
export const CREATIVE_AI_SECTION_KEYS = [
  'hook',
  'storyPacing',
  'messageOffer',
  'productProof',
  'callToAction',
  'performance',
] as const;

export type CreativeAiSectionKey = (typeof CREATIVE_AI_SECTION_KEYS)[number];
