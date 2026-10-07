import { describe, expect, it } from '@jest/globals';
import {
  MetaGraphError,
  adCreativeParams,
  adParams,
  adSetParams,
  campaignParams,
  createCampaign,
  parseGraphError,
  uploadImageBytes,
  waitForVideoReady,
} from './meta-draft-client';

function fakeFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift() ?? { status: 500, body: { error: { message: 'no more responses' } } };
    return {
      ok: (next.status ?? 200) < 400,
      status: next.status ?? 200,
      text: async () => JSON.stringify(next.body),
    } as Response;
  }) as typeof fetch;
  return { impl, calls };
}

describe('meta draft client', () => {
  describe('param builders follow the SOP', () => {
    it('creates a paused sales campaign with a campaign-level daily budget and no bid cap', () => {
      const params = campaignParams({ name: 'SE_Rose_20260930', dailyBudgetMinor: 100000 });
      expect(params).toMatchObject({
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        daily_budget: '100000',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        special_ad_categories: '[]',
      });
    });

    it('optimises the ad set on the product pixel for purchases, broad, 18+', () => {
      const params = adSetParams({
        name: 'x', campaignId: 'c1', pixelId: 'px1', countries: ['ph'], startTime: new Date('2026-09-29T16:00:00.000Z'),
      });
      expect(params.optimization_goal).toBe('OFFSITE_CONVERSIONS');
      expect(JSON.parse(params.promoted_object)).toEqual({ pixel_id: 'px1', custom_event_type: 'PURCHASE' });
      const targeting = JSON.parse(params.targeting);
      expect(targeting.geo_locations.countries).toEqual(['PH']);
      expect(targeting.age_min).toBe(18);
      expect(targeting.targeting_automation.advantage_audience).toBe(1);
      expect(params).not.toHaveProperty('publisher_platforms');
      expect(params).not.toHaveProperty('daily_budget');
      expect(params.start_time).toBe('2026-09-29T16:00:00.000Z');
    });

    it('builds a video creative with its thumbnail, page, Instagram account and a Shop Now link', () => {
      const params = adCreativeParams({
        name: 'ad', pageId: 'p1', instagramUserId: 'ig1', link: 'https://shop.example/rose', message: 'Hello', headline: 'Rose',
        urlTags: 'utm_source=x', media: { kind: 'VIDEO', videoId: 'v1', thumbnailHash: 'h1' },
      });
      const spec = JSON.parse(params.object_story_spec);
      expect(spec.page_id).toBe('p1');
      expect(spec.instagram_user_id).toBe('ig1');
      expect(spec.video_data).toMatchObject({ video_id: 'v1', image_hash: 'h1', message: 'Hello', title: 'Rose' });
      expect(spec.video_data.call_to_action).toEqual({ type: 'SHOP_NOW', value: { link: 'https://shop.example/rose' } });
      expect(JSON.parse(params.contextual_multi_ads)).toEqual({ enroll_status: 'OPT_OUT' });
      expect(params.url_tags).toBe('utm_source=x');
    });

    it('builds an image creative from a hash and omits Instagram when none is set', () => {
      const params = adCreativeParams({
        name: 'ad', pageId: 'p1', link: 'https://shop.example', message: 'Hi', urlTags: '',
        media: { kind: 'IMAGE', imageHash: 'img1' },
      });
      const spec = JSON.parse(params.object_story_spec);
      expect(spec.link_data.image_hash).toBe('img1');
      expect(spec).not.toHaveProperty('instagram_user_id');
    });

    it('creates the ad paused against its ad set and creative', () => {
      expect(adParams({ name: 'n', adSetId: 'as1', creativeId: 'cr1' })).toEqual({
        name: 'n', adset_id: 'as1', creative: '{"creative_id":"cr1"}', status: 'PAUSED',
      });
    });
  });

  describe('errors', () => {
    it('reads Meta\'s error envelope, including the user-facing message', () => {
      const error = parseGraphError(400, {
        error: { message: 'Invalid parameter', code: 100, error_subcode: 1815857, error_user_msg: 'Pixel does not belong to this account.', fbtrace_id: 'abc' },
      });
      expect(error).toBeInstanceOf(MetaGraphError);
      expect(error.code).toBe(100);
      expect(error.userMessage).toContain('Pixel');
      expect(error.message).toContain('Pixel does not belong');
      expect(error.retryable).toBe(false);
    });

    it('marks throttles and server faults as retryable', () => {
      expect(parseGraphError(400, { error: { message: 'rate', code: 17 } }).retryable).toBe(true);
      expect(parseGraphError(503, null).retryable).toBe(true);
    });
  });

  describe('network calls', () => {
    it('posts form-encoded params with the token and returns the new id', async () => {
      const { impl, calls } = fakeFetch([{ body: { id: 'camp_1' } }]);
      const id = await createCampaign('tok', '123', { name: 'n', dailyBudgetMinor: 5 }, impl);
      expect(id).toBe('camp_1');
      expect(calls[0].url).toBe('https://graph.facebook.com/v23.0/act_123/campaigns');
      const body = new URLSearchParams(String(calls[0].init?.body));
      expect(body.get('access_token')).toBe('tok');
      expect(body.get('objective')).toBe('OUTCOME_SALES');
    });

    it('throws a MetaGraphError when Meta refuses', async () => {
      const { impl } = fakeFetch([{ status: 400, body: { error: { message: 'nope', code: 100 } } }]);
      await expect(createCampaign('tok', '123', { name: 'n', dailyBudgetMinor: 5 }, impl)).rejects.toMatchObject({ code: 100 });
    });

    it('returns the image hash Meta assigns', async () => {
      const { impl, calls } = fakeFetch([{ body: { images: { 'thumb.jpg': { hash: 'deadbeef' } } } }]);
      const hash = await uploadImageBytes('tok', '123', { bytes: Buffer.from('x'), name: 'thumb.jpg' }, impl);
      expect(hash).toBe('deadbeef');
      expect(new URLSearchParams(String(calls[0].init?.body)).get('bytes')).toBe(Buffer.from('x').toString('base64'));
    });

    it('waits until the video is ready and fails on a processing error', async () => {
      const ready = fakeFetch([
        { body: { status: { video_status: 'processing', processing_progress: 40 } } },
        { body: { status: { video_status: 'ready' } } },
      ]);
      const sleeps: number[] = [];
      await waitForVideoReady('tok', 'v1', { intervalMs: 7, sleep: async (ms) => { sleeps.push(ms); }, fetchImpl: ready.impl });
      expect(sleeps).toEqual([7]);

      const failed = fakeFetch([{ body: { status: { video_status: 'error' } } }]);
      await expect(waitForVideoReady('tok', 'v1', { sleep: async () => undefined, fetchImpl: failed.impl })).rejects.toThrow(/could not process/);
    });
  });
});
