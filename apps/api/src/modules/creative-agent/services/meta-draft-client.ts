/**
 * Writes to the Meta Marketing API for the draft worker.
 *
 * Deliberately not the shared MetaAdsProvider: that client is read-only and on
 * the path every spend sync takes. This one creates things, so it is its own
 * small file where every call is visible. Param builders are pure and tested;
 * the network functions wrap them and parse Meta's error envelope into one
 * exception type the worker can log and retry on.
 *
 * Everything created here is PAUSED. Publishing is a person's job.
 */

import { SOP_FIXED_SETTINGS } from '../utils/creative-meta-draft-plan';

export const META_GRAPH_BASE = 'https://graph.facebook.com/v23.0';

type FetchLike = typeof fetch;

export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
    readonly userMessage?: string,
    readonly traceId?: string,
  ) {
    super(message);
    this.name = 'MetaGraphError';
  }

  /** Throttles and transient server faults are worth another attempt; bad input is not. */
  get retryable(): boolean {
    if (this.status >= 500) return true;
    // 4 = app rate limit, 17 = user rate limit, 32 = page rate limit, 613 = custom rate limit, 80004 = ads insights throttle.
    return [1, 2, 4, 17, 32, 613, 80004].includes(this.code ?? -1);
  }
}

/** Turn Meta's `{error: {...}}` body into a MetaGraphError, or a plain one when the body is not JSON. */
export function parseGraphError(status: number, body: unknown): MetaGraphError {
  const error = (body as { error?: Record<string, unknown> } | null)?.error;
  if (error && typeof error === 'object') {
    const message = String(error.message ?? 'Meta refused the request');
    const userMessage = typeof error.error_user_msg === 'string' ? error.error_user_msg : undefined;
    return new MetaGraphError(
      userMessage ? `${message} ${userMessage}` : message,
      status,
      typeof error.code === 'number' ? error.code : undefined,
      typeof error.error_subcode === 'number' ? error.error_subcode : undefined,
      userMessage,
      typeof error.fbtrace_id === 'string' ? error.fbtrace_id : undefined,
    );
  }
  return new MetaGraphError(`Meta returned HTTP ${status}`, status);
}

async function graphRequest(
  token: string,
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string>,
  fetchImpl: FetchLike = fetch,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: token });
  const url = method === 'GET' ? `${META_GRAPH_BASE}/${path}?${body.toString()}` : `${META_GRAPH_BASE}/${path}`;
  const response = await fetchImpl(url, method === 'GET'
    ? { method }
    : { method, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) throw parseGraphError(response.status, parsed);
  if (!parsed || typeof parsed !== 'object') throw new MetaGraphError('Meta returned an empty body', response.status);
  return parsed as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Param builders: what the SOP fixes, as the API spells it.
// ---------------------------------------------------------------------------

export function campaignParams(input: { name: string; dailyBudgetMinor: number }): Record<string, string> {
  return {
    name: input.name,
    objective: SOP_FIXED_SETTINGS.objective,
    status: SOP_FIXED_SETTINGS.status,
    buying_type: SOP_FIXED_SETTINGS.buyingType,
    special_ad_categories: JSON.stringify(SOP_FIXED_SETTINGS.specialAdCategories),
    // Campaign budget: Meta splits it across ad sets, and the SOP wants that.
    daily_budget: String(input.dailyBudgetMinor),
    bid_strategy: SOP_FIXED_SETTINGS.bidStrategy,
  };
}

export function adSetParams(input: {
  name: string;
  campaignId: string;
  pixelId: string;
  countries: string[];
  startTime: Date;
}): Record<string, string> {
  return {
    name: input.name,
    campaign_id: input.campaignId,
    status: SOP_FIXED_SETTINGS.status,
    billing_event: SOP_FIXED_SETTINGS.billingEvent,
    optimization_goal: SOP_FIXED_SETTINGS.optimizationGoal,
    destination_type: SOP_FIXED_SETTINGS.destinationType,
    promoted_object: JSON.stringify({ pixel_id: input.pixelId, custom_event_type: SOP_FIXED_SETTINGS.conversionEvent }),
    // Broad: the creative does the targeting. Advantage+ audience on, no
    // placement exclusions (omitting publisher_platforms leaves placements automatic).
    targeting: JSON.stringify({
      geo_locations: { countries: input.countries.map((c) => c.toUpperCase()) },
      age_min: SOP_FIXED_SETTINGS.ageMin,
      targeting_automation: { advantage_audience: 1 },
    }),
    attribution_spec: JSON.stringify([
      { event_type: 'CLICK_THROUGH', window_days: SOP_FIXED_SETTINGS.attribution.clickDays },
      { event_type: 'VIEW_THROUGH', window_days: SOP_FIXED_SETTINGS.attribution.viewDays },
    ]),
    start_time: input.startTime.toISOString(),
  };
}

export function adCreativeParams(input: {
  name: string;
  pageId: string;
  instagramUserId?: string | null;
  link: string;
  displayLink?: string | null;
  message: string;
  headline?: string | null;
  urlTags: string;
  media: { kind: 'VIDEO'; videoId: string; thumbnailHash: string } | { kind: 'IMAGE'; imageHash: string };
}): Record<string, string> {
  const callToAction = { type: 'SHOP_NOW', value: { link: input.link } };
  const storySpec: Record<string, unknown> = { page_id: input.pageId };
  if (input.instagramUserId) storySpec.instagram_user_id = input.instagramUserId;
  if (input.media.kind === 'VIDEO') {
    storySpec.video_data = {
      video_id: input.media.videoId,
      image_hash: input.media.thumbnailHash,
      message: input.message,
      ...(input.headline ? { title: input.headline } : {}),
      ...(input.displayLink ? { link_description: input.displayLink } : {}),
      call_to_action: callToAction,
    };
  } else {
    storySpec.link_data = {
      image_hash: input.media.imageHash,
      link: input.link,
      message: input.message,
      ...(input.headline ? { name: input.headline } : {}),
      ...(input.displayLink ? { caption: input.displayLink } : {}),
      call_to_action: callToAction,
    };
  }
  return {
    name: input.name,
    object_story_spec: JSON.stringify(storySpec),
    url_tags: input.urlTags,
    // Multi-advertiser ads off: no sharing the slot with competitors, no cropping.
    contextual_multi_ads: JSON.stringify({ enroll_status: 'OPT_OUT' }),
  };
}

export function adParams(input: { name: string; adSetId: string; creativeId: string }): Record<string, string> {
  return {
    name: input.name,
    adset_id: input.adSetId,
    creative: JSON.stringify({ creative_id: input.creativeId }),
    status: SOP_FIXED_SETTINGS.status,
  };
}

// ---------------------------------------------------------------------------
// Network calls.
// ---------------------------------------------------------------------------

function idOf(result: Record<string, unknown>, what: string): string {
  const id = result.id;
  if (typeof id !== 'string' || !id) throw new MetaGraphError(`Meta created the ${what} but returned no id`, 200);
  return id;
}

export async function createCampaign(token: string, adAccountId: string, input: Parameters<typeof campaignParams>[0], fetchImpl?: FetchLike) {
  return idOf(await graphRequest(token, 'POST', `act_${adAccountId}/campaigns`, campaignParams(input), fetchImpl), 'campaign');
}

export async function createAdSet(token: string, adAccountId: string, input: Parameters<typeof adSetParams>[0], fetchImpl?: FetchLike) {
  return idOf(await graphRequest(token, 'POST', `act_${adAccountId}/adsets`, adSetParams(input), fetchImpl), 'ad set');
}

export async function createAdCreative(token: string, adAccountId: string, input: Parameters<typeof adCreativeParams>[0], fetchImpl?: FetchLike) {
  return idOf(await graphRequest(token, 'POST', `act_${adAccountId}/adcreatives`, adCreativeParams(input), fetchImpl), 'ad creative');
}

export async function createAd(token: string, adAccountId: string, input: Parameters<typeof adParams>[0], fetchImpl?: FetchLike) {
  return idOf(await graphRequest(token, 'POST', `act_${adAccountId}/ads`, adParams(input), fetchImpl), 'ad');
}

/**
 * Hand Meta a URL to fetch the video from, so a 200 MB file never streams
 * through the API container. The URL is a short-lived signed read on our
 * object storage.
 */
export async function uploadVideoFromUrl(
  token: string,
  adAccountId: string,
  input: { fileUrl: string; name: string },
  fetchImpl?: FetchLike,
): Promise<string> {
  const result = await graphRequest(token, 'POST', `act_${adAccountId}/advideos`, {
    file_url: input.fileUrl,
    name: input.name,
  }, fetchImpl);
  return idOf(result, 'video');
}

export type VideoStatus = 'ready' | 'processing' | 'error';

export async function fetchVideoStatus(token: string, videoId: string, fetchImpl?: FetchLike): Promise<{ status: VideoStatus; detail?: string }> {
  const result = await graphRequest(token, 'GET', videoId, { fields: 'status' }, fetchImpl);
  const status = (result.status as { video_status?: string; processing_progress?: number } | undefined) ?? {};
  const value = String(status.video_status ?? 'processing').toLowerCase();
  if (value === 'ready') return { status: 'ready' };
  if (value === 'error') return { status: 'error', detail: 'Meta could not process the video' };
  return { status: 'processing', detail: typeof status.processing_progress === 'number' ? `${status.processing_progress}%` : undefined };
}

/**
 * Meta transcodes after upload; an ad creative that references a video before
 * it is ready is refused. Poll until ready, bounded, so a stuck transcode
 * fails the job instead of hanging the worker.
 */
export async function waitForVideoReady(
  token: string,
  videoId: string,
  options: { timeoutMs?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void>; fetchImpl?: FetchLike } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const intervalMs = options.intervalMs ?? 5_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const startedAt = Date.now();
  for (;;) {
    const current = await fetchVideoStatus(token, videoId, options.fetchImpl);
    if (current.status === 'ready') return;
    if (current.status === 'error') throw new MetaGraphError(current.detail ?? 'Video processing failed', 200);
    if (Date.now() - startedAt > timeoutMs) {
      throw new MetaGraphError(`Video ${videoId} was still processing after ${Math.round(timeoutMs / 60_000)} minutes`, 200, 2);
    }
    await sleep(intervalMs);
  }
}

/** Images go inline as base64; they are small and Meta hashes them for reuse. */
export async function uploadImageBytes(
  token: string,
  adAccountId: string,
  input: { bytes: Buffer; name: string },
  fetchImpl?: FetchLike,
): Promise<string> {
  const result = await graphRequest(token, 'POST', `act_${adAccountId}/adimages`, {
    bytes: input.bytes.toString('base64'),
    name: input.name,
  }, fetchImpl);
  const images = result.images as Record<string, { hash?: string }> | undefined;
  const first = images ? Object.values(images)[0] : undefined;
  if (!first?.hash) throw new MetaGraphError('Meta accepted the image but returned no hash', 200);
  return first.hash;
}

export type MetaPageOption = { id: string; name: string; instagramAccountId: string | null; instagramUsername: string | null };
export type MetaPixelOption = { id: string; name: string };

/** The pages this token manages, with the Instagram account each is linked to. */
export async function fetchPages(token: string, fetchImpl?: FetchLike): Promise<MetaPageOption[]> {
  const result = await graphRequest(token, 'GET', 'me/accounts', {
    fields: 'id,name,instagram_business_account{id,username}',
    limit: '100',
  }, fetchImpl);
  const rows = (result.data as Array<Record<string, unknown>> | undefined) ?? [];
  return rows.map((row) => {
    const ig = row.instagram_business_account as { id?: string; username?: string } | undefined;
    return {
      id: String(row.id),
      name: String(row.name ?? row.id),
      instagramAccountId: ig?.id ?? null,
      instagramUsername: ig?.username ?? null,
    };
  });
}

/** The pixels (datasets) an ad account can optimise on. */
export async function fetchPixels(token: string, adAccountId: string, fetchImpl?: FetchLike): Promise<MetaPixelOption[]> {
  const result = await graphRequest(token, 'GET', `act_${adAccountId}/adspixels`, { fields: 'id,name', limit: '100' }, fetchImpl);
  const rows = (result.data as Array<Record<string, unknown>> | undefined) ?? [];
  return rows.map((row) => ({ id: String(row.id), name: String(row.name ?? row.id) }));
}
