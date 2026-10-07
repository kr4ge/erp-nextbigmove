/**
 * The rules a Meta draft is built from, kept pure so they can be tested
 * without a database or a Graph token.
 *
 * Everything management's launch SOP fixes lives here as data, and everything
 * the SOP leaves to judgement (how many ads, whether a batch is a real test)
 * is a function of what the ERP already knows.
 */

/** Currencies Meta bills in whole units rather than hundredths. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'CLP', 'COP', 'HUF', 'ISK', 'JPY', 'KRW', 'PYG', 'TWD', 'UGX', 'VND', 'XAF', 'XOF',
]);

/**
 * What the SOP fixes for every sales launch. Frozen onto each batch so a
 * reader a year from now sees what was actually sent, not what the code does
 * today.
 */
export const SOP_FIXED_SETTINGS = {
  objective: 'OUTCOME_SALES',
  buyingType: 'AUCTION',
  budgetLevel: 'CAMPAIGN',
  bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
  specialAdCategories: [] as string[],
  abTest: false,
  catalog: false,
  billingEvent: 'IMPRESSIONS',
  optimizationGoal: 'OFFSITE_CONVERSIONS',
  conversionEvent: 'PURCHASE',
  destinationType: 'WEBSITE',
  ageMin: 18,
  advantageAudience: true,
  advantagePlacements: true,
  attribution: { clickDays: 7, viewDays: 1 },
  multiAdvertiserAds: false,
  status: 'PAUSED',
  maxAdsPerCampaign: 3,
} as const;

/** Meta wants budgets in the currency's minor unit: ₱1,000 is 100000. */
export function toMinorUnits(amount: number, currency: string | null | undefined): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Budget must be a non-negative number');
  const code = (currency || 'PHP').toUpperCase();
  return ZERO_DECIMAL_CURRENCIES.has(code) ? Math.round(amount) : Math.round(amount * 100);
}

/**
 * The ad name the ERP already teaches makers to paste: `customId_title_CODE_creator`
 * when the creative is enrolled against a POS item, otherwise the older
 * `title_creator_CODE`. The matcher links ads back to the registry through the
 * code segment, so the code is never optional. Mirrors buildAdName on the web.
 */
export function buildAdName(parts: {
  code: string;
  title?: string | null;
  creator?: string | null;
  customId?: string | null;
}): string {
  const customId = parts.customId?.trim();
  const segments = customId
    ? [customId, parts.title?.trim(), parts.code.trim(), parts.creator?.trim()]
    : [parts.title?.trim(), parts.creator?.trim(), parts.code.trim()];
  return segments.filter((part): part is string => Boolean(part)).join('_');
}

/** A name segment: letters, digits and dashes, so underscores keep separating parts. */
export function nameSegment(value: string | null | undefined, fallback = 'x'): string {
  const cleaned = (value || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
  return cleaned || fallback;
}

/** `PREFIX_Product_YYYYMMDD`: store, product and launch day, readable in Ads Manager. */
export function buildCampaignName(input: {
  codePrefix: string;
  product: string | null | undefined;
  launchDate: Date;
  timezone: string;
}): string {
  const day = localDateParts(input.launchDate, input.timezone);
  const stamp = `${day.year}${String(day.month).padStart(2, '0')}${String(day.day).padStart(2, '0')}`;
  return `${input.codePrefix}_${nameSegment(input.product, 'Product')}_${stamp}`;
}

/** One ad set per campaign, so its name only has to say what it targets. */
export function buildAdSetName(campaignName: string, countries: string[]): string {
  const where = countries.length ? countries.map((c) => c.toUpperCase()).join('-') : 'ALL';
  return `${campaignName}_Broad-${where}`;
}

/**
 * Midnight at the start of the next calendar day in the store's timezone.
 * The SOP wants a full first day of data and clean budget pacing.
 */
export function nextMidnight(timezone: string, now = new Date()): Date {
  const local = localDateParts(now, timezone);
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  const offsetMs = Math.round((localAsUtc - now.getTime()) / 60_000) * 60_000;
  const tomorrowMidnightAsUtc = Date.UTC(local.year, local.month - 1, local.day + 1, 0, 0, 0);
  return new Date(tomorrowMidnightAsUtc - offsetMs);
}

export function localDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour') % 24, minute: read('minute'), second: read('second') };
}

export type AdCountSuggestion = { suggested: 1 | 2 | 3; reason: string };

/**
 * How many ads the campaign should hold, from the SOP's own table: one for a
 * proven winner or a relaunch, two to compare angles, three for a product with
 * no data. The ERP knows which case applies from the knowledge base.
 */
export function suggestAdCount(input: {
  hasProvenWinner: boolean;
  productEntryCount: number;
  storeEntryCount: number;
}): AdCountSuggestion {
  if (input.hasProvenWinner) {
    return { suggested: 1, reason: 'A proven winner, or a relaunch of one. One ad set, one ad.' };
  }
  if (input.productEntryCount === 0) {
    return {
      suggested: 3,
      reason: input.storeEntryCount === 0
        ? 'No recorded results for this store yet. Three different angles, one ad set.'
        : 'No recorded results for this product yet. Three different angles, one ad set.',
    };
  }
  return { suggested: 2, reason: 'The product has a record. Two angles to compare, one ad set.' };
}

/**
 * The SOP's first testing rule: different angles or hooks, not one video in
 * three colours. Creatives that share both are variations, and the batch is
 * warned rather than refused because the registry fields are self-reported.
 */
export function duplicateAngleWarnings(
  creatives: Array<{ code: string; angle: string | null; hookType: string | null }>,
): string[] {
  const warnings: string[] = [];
  const seen = new Map<string, string[]>();
  for (const creative of creatives) {
    const angle = normalise(creative.angle);
    const hook = normalise(creative.hookType);
    if (!angle || !hook) continue;
    const key = `${angle}|${hook}`;
    seen.set(key, [...(seen.get(key) ?? []), creative.code]);
  }
  for (const codes of seen.values()) {
    if (codes.length > 1) {
      warnings.push(`${codes.join(' and ')} share the same angle and hook. That is a variation, not a test; Meta will pick one and starve the rest.`);
    }
  }
  return warnings;
}

/**
 * Dynamic URL parameters Meta fills at delivery, so every click says which
 * campaign, ad set and ad it came from without anyone typing UTMs by hand.
 */
export function buildUrlTags(): string {
  return [
    'utm_source={{site_source_name}}',
    'utm_medium=paid',
    'utm_campaign={{campaign.name}}',
    'utm_term={{adset.name}}',
    'utm_content={{ad.name}}',
  ].join('&');
}

/** The daily spend that reaches 50 purchases in a week at this cost per purchase. */
export function learningBudget(targetCpp: number | null | undefined): number | null {
  if (!targetCpp || targetCpp <= 0) return null;
  return Math.round((targetCpp * 50) / 7);
}

/** Deep link to the campaign in Ads Manager, or to the account when nothing has been created yet. */
export function adsManagerUrl(adAccountId: string, campaignId?: string | null): string {
  const base = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(adAccountId)}`;
  return campaignId ? `${base}&selected_campaign_ids=${encodeURIComponent(campaignId)}` : base;
}

function normalise(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
