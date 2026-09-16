/**
 * Niche packs.
 *
 * The analysis method is identical for every creative, so scores stay
 * comparable across stores. What changes per niche is a short pack of domain
 * knowledge appended to that method: what decides performance in this
 * category, what to look for in the creative, and which claims typically need
 * compliance review.
 *
 * A pack is deliberately small. It is not a second prompt; duplicating the
 * method per niche would mean maintaining several copies of the same rules.
 */

export const CREATIVE_AI_NICHE_KEYS = [
  'GENERAL_MERCHANDISE',
  'FRAGRANCE_BEAUTY',
  'HEALTH_SUPPLEMENTS',
  'APPAREL_ACCESSORIES',
  'FOOD_BEVERAGE',
  'HOME_LIVING',
  'GADGETS_ELECTRONICS',
  'SERVICES_DIGITAL',
] as const;

export type CreativeAiNiche = (typeof CREATIVE_AI_NICHE_KEYS)[number];

export type CreativeAiNichePack = {
  label: string;
  /** One line shown in the picker so an advertiser can choose confidently. */
  summary: string;
  /** What decides performance in this category. */
  whatMatters: string;
  /** Concrete things to examine in the creative. */
  lookFor: string[];
  /** Claim types that typically need a compliance check in this category. */
  complianceWatch: string[];
};

export const CREATIVE_AI_NICHES: Record<CreativeAiNiche, CreativeAiNichePack> = {
  GENERAL_MERCHANDISE: {
    label: 'General merchandise',
    summary: 'Mixed catalogue or anything the other packs do not cover.',
    whatMatters:
      'With a mixed catalogue the creative must make the product obvious and the reason to buy concrete within the first moment. Generic lifestyle imagery without a clear product and a clear benefit is the usual failure.',
    lookFor: [
      'Is the product itself unmistakable, or is the frame mostly mood?',
      'Is the specific use case or problem named, rather than a vague benefit?',
      'Price, discount, and what the buyer actually receives (quantity, variant, bundle)',
      'Whether the promise is provable from what is shown',
    ],
    complianceWatch: [
      'Unsubstantiated superlatives ("best", "number one", "cheapest")',
      'Guarantees, warranties, or refund promises stated without terms',
      'Before-and-after imagery implying a result the product may not produce',
    ],
  },

  FRAGRANCE_BEAUTY: {
    label: 'Fragrance & beauty',
    summary: 'Perfume, skincare, cosmetics, personal care.',
    whatMatters:
      'Scent and texture cannot be transmitted through a screen, so the creative must sell desire, occasion, and identity instead of the product experience. The strongest fragrance and beauty ads make the viewer picture themselves in a specific moment: a date, an office day, a compliment received. Judge whether the ad creates that picture, and whether the bottle or packaging is recognisable enough to be remembered and asked for by name.',
    lookFor: [
      'Is the bottle, jar, or packaging legible and recognisable, or too small and cropped to identify?',
      'Is a specific occasion or identity evoked (date night, everyday office, gifting), or is the mood generic?',
      'Scent-family or finish language (fresh, floral, woody, matte, dewy) that helps a buyer imagine it',
      'For beauty: is a result shown, and is it plausibly achievable with this product alone?',
      'Size, concentration (EDP/EDT), shade, or variant clarity, and whether price matches the perceived tier',
      'Gifting framing and set or bundle composition, which often carries these categories',
    ],
    complianceWatch: [
      'Longevity or projection claims stated as fact ("lasts 24 hours")',
      'Comparisons or similarity claims to designer houses, including "inspired by" and dupe framing',
      'Authenticity claims ("original", "authentic") that the brand must be able to substantiate',
      'Skincare or cosmetic claims that cross into treating a condition (acne cure, whitening as a medical outcome)',
      'Before-and-after imagery that implies a clinical result',
    ],
  },

  HEALTH_SUPPLEMENTS: {
    label: 'Health & supplements',
    summary: 'Food supplements, vitamins, wellness products.',
    whatMatters:
      'Credibility and regulatory exposure decide these ads. The creative must build belief without implying the product treats or cures anything. Fear-based openings work but carry the most compliance risk, so evaluate both how well the creative persuades and how much of that persuasion rests on claims the brand cannot make.',
    lookFor: [
      'Is the benefit framed as support and maintenance rather than treatment or cure?',
      'Is the mandatory food-supplement disclaimer present and legible where required?',
      'Ingredient, dosage, and registration details, and whether the packaging is legible enough to inspect',
      'Credibility devices: endorsements, testimonials, certifications, and whether their source is identified',
      'Whether fear or disease imagery is proportionate to the evidence the brand can show',
    ],
    complianceWatch: [
      'Any implication that the product treats, prevents, or cures a disease',
      'Regulatory approval badges, including FDA marks, that must match an actual registration',
      'Specific health-outcome numbers or timelines',
      'Depictions of diseased organs or medical conditions implying reversal by the product',
      'Testimonials describing medical results',
    ],
  },

  APPAREL_ACCESSORIES: {
    label: 'Apparel & accessories',
    summary: 'Clothing, footwear, bags, jewellery, watches.',
    whatMatters:
      'These ads sell fit, fabric, and how the buyer will look wearing the item. The product must be shown on a person or in a way that conveys scale and drape; a flat product shot alone rarely converts. Sizing and fit uncertainty is the main reason people do not buy.',
    lookFor: [
      'Is the item shown worn, so drape, fit, and scale are readable?',
      'Fabric, material, and construction cues that justify the price',
      'Size range, fit guidance, and whether the model represents the target buyer',
      'Colourways and variants, and whether the one shown is the one advertised',
      'Styling context that shows when and where the item would be worn',
    ],
    complianceWatch: [
      'Material or origin claims (genuine leather, stainless steel, imported) that must be accurate',
      'Brand or designer similarity claims',
      'Free-size or one-size claims that may mislead on fit',
    ],
  },

  FOOD_BEVERAGE: {
    label: 'Food & beverage',
    summary: 'Snacks, drinks, groceries, prepared food.',
    whatMatters:
      'Appetite appeal decides these ads before any argument does. The food must look fresh and appealing at thumb size, and the creative should make clear what the buyer receives: quantity, serving size, and freshness or shelf life.',
    lookFor: [
      'Does the food look appetising and fresh, and is the shot lit well enough to read quickly?',
      'Portion, pack size, and quantity clarity',
      'Freshness, shelf life, and delivery or storage handling if relevant',
      'Taste and texture language that sets an accurate expectation',
      'Allergen, ingredient, and dietary positioning where it is part of the pitch',
    ],
    complianceWatch: [
      'Health or nutrition claims (sugar-free, keto, weight loss, immunity)',
      'Organic, natural, or provenance claims requiring certification',
      'Allergen statements that must be complete and accurate',
      'Imagery showing a portion larger or better than what is delivered',
    ],
  },

  HOME_LIVING: {
    label: 'Home & living',
    summary: 'Furniture, kitchenware, decor, household goods.',
    whatMatters:
      'Buyers need to judge size, quality, and whether the item fits their space. Demonstration beats description: showing the item in use, in a real room, with a sense of scale, is what moves these products.',
    lookFor: [
      'Is scale conveyed, through a room setting or a familiar reference object?',
      'Is the item shown in use, solving the problem it claims to solve?',
      'Material, build quality, and finish detail',
      'Dimensions, capacity, and what is included in the box',
      'Assembly, installation, or maintenance expectations',
    ],
    complianceWatch: [
      'Durability, capacity, or performance claims stated as fact',
      'Safety or certification marks that must be genuine',
      'Material claims (solid wood, stainless steel) that must be accurate',
    ],
  },

  GADGETS_ELECTRONICS: {
    label: 'Gadgets & electronics',
    summary: 'Consumer electronics, accessories, smart devices.',
    whatMatters:
      'Specifications matter but rarely sell on their own: the creative must translate a spec into an outcome the buyer cares about. Trust is the second barrier, since buyers fear counterfeits and overstated performance.',
    lookFor: [
      'Is each specification tied to a benefit the buyer would notice in use?',
      'Is the device shown working, rather than only as a product render?',
      'Compatibility, what is in the box, and warranty terms',
      'Trust signals: brand, authorised seller status, warranty, return policy',
      'Price relative to the perceived tier, and whether the discount is believable',
    ],
    complianceWatch: [
      'Performance numbers (battery life, range, speed, capacity) stated as fact',
      'Compatibility claims that must hold for the devices named',
      'Warranty and authorised-dealer claims',
      'Comparisons to named competitor products',
    ],
  },

  SERVICES_DIGITAL: {
    label: 'Services & digital',
    summary: 'Courses, memberships, bookings, digital products.',
    whatMatters:
      'There is no physical product to show, so the creative must make the outcome concrete and the provider credible. Vague promises of transformation without proof or a clear first step are the standard failure.',
    lookFor: [
      'Is the outcome specific and measurable, rather than a vague promise?',
      'Is the provider identified, with credentials or proof of results?',
      'What the buyer actually receives: duration, format, access, support',
      'Price, payment terms, and any recurring commitment',
      'What the first step after clicking is, and whether it is clear',
    ],
    complianceWatch: [
      'Income, results, or success-rate claims',
      'Testimonials presented as typical outcomes',
      'Guarantees and refund promises stated without terms',
      'Credential or accreditation claims that must be verifiable',
    ],
  },
};

export const DEFAULT_CREATIVE_AI_NICHE: CreativeAiNiche = 'GENERAL_MERCHANDISE';

export function isCreativeAiNiche(value: unknown): value is CreativeAiNiche {
  return typeof value === 'string' && (CREATIVE_AI_NICHE_KEYS as readonly string[]).includes(value);
}

/** The pack as it appears inside the prompt. */
export function renderNichePack(niche: CreativeAiNiche) {
  const pack = CREATIVE_AI_NICHES[niche] ?? CREATIVE_AI_NICHES[DEFAULT_CREATIVE_AI_NICHE];
  return [
    `Category: ${pack.label}.`,
    pack.whatMatters,
    '',
    'Examine specifically:',
    ...pack.lookFor.map((item) => `- ${item}`),
    '',
    'Claims in this category that usually need compliance review:',
    ...pack.complianceWatch.map((item) => `- ${item}`),
  ].join('\n');
}

/** Everything the UI needs to render the picker, without importing the packs. */
export function creativeAiNicheOptions() {
  return CREATIVE_AI_NICHE_KEYS.map((key) => ({
    key,
    label: CREATIVE_AI_NICHES[key].label,
    summary: CREATIVE_AI_NICHES[key].summary,
    whatMatters: CREATIVE_AI_NICHES[key].whatMatters,
    lookFor: CREATIVE_AI_NICHES[key].lookFor,
    complianceWatch: CREATIVE_AI_NICHES[key].complianceWatch,
  }));
}
