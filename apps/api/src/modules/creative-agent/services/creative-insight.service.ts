import { HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { CreativeActor } from '../types/creative-actor.type';
import { ADVERTISING_PROVISIONAL_DEFAULTS } from '../utils/advertising-metrics';
import { round } from '../utils/creative-metrics';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import { CreativeAccessService } from './creative-access.service';

const MODEL = 'claude-sonnet-5';

/**
 * Below this spend AND order count a creative has not bought enough data to
 * teach anything — mirrors the leaderboard's "Testing" pill.
 */
const EVIDENCE_SPEND = 3_000;
const EVIDENCE_ORDERS = 10;

/** Fatigue = real delivery both weeks, decay of at least this much, frequency not falling. */
const FATIGUE_MIN_IMPRESSIONS = 1_000;
const FATIGUE_DECAY = 0.8;

/**
 * This screen speaks to the creative, so its outputs are make-suggestions,
 * never media-buying verdicts — scale/kill is the advertiser's vocabulary and
 * their own dashboard's job. REFRESH_NOW outranks MORE_VARIATIONS because a
 * fatiguing performer has a deadline and a proven winner does not.
 */
export type SuggestionUrgency = 'REFRESH_NOW' | 'MORE_VARIATIONS';
export type OtherStatus = 'GATHERING_DATA' | 'NO_SIGNAL';

type EconTotals = { spend: number; orders: number; grossSales: number; excludedSales: number };
type WeekTotals = { impressions: number; linkClicks: number; videoPlays3s: number; frequencyNumerator: number; frequencyDenominator: number };

const emptyEcon = (): EconTotals => ({ spend: 0, orders: 0, grossSales: 0, excludedSales: 0 });
const emptyWeek = (): WeekTotals => ({ impressions: 0, linkClicks: 0, videoPlays3s: 0, frequencyNumerator: 0, frequencyDenominator: 0 });

function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}
function dayShift(ymd: string, days: number): Date {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}
const pctText = (value: number | null) => (value === null ? '—' : `${(value * 100).toFixed(1)}%`);
const pesoText = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;

type InternalRow = {
  id: string;
  code: string;
  title: string;
  kind: string;
  angle: string | null;
  hookType: string | null;
  format: string | null;
  remixOfCode: string | null;
  creator: string;
  isWinner: boolean;
  fatiguing: boolean;
  hasEvidence: boolean;
  hookDecayed: boolean;
  ctrDecayed: boolean;
  metrics: {
    spend30: number;
    orders30: number;
    arPct30: number | null;
    hookCur: number | null;
    hookPrev: number | null;
    ctrCur: number | null;
    ctrPrev: number | null;
    frequency: number | null;
  };
};

@Injectable()
export class CreativeInsightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  /**
   * The shared computation behind every endpoint: per-creative economics over a
   * rolling 30 Manila days, and week-over-week delivery for fatigue. Scoped the
   * way the library is — a creative reads their own work, a manager the tenant.
   */
  private async computeRows(actor: CreativeActor) {
    const context = await this.access.resolve(actor);
    const canReadAll = this.access.canReadAll(context);
    const tenantId = context.tenantId;
    const today = manilaToday();
    const econStart = dayShift(today, -29);
    const weekCurStart = dayShift(today, -6);
    const weekPrevStart = dayShift(today, -13);
    const weekPrevEnd = dayShift(today, -7);
    const end = dayShift(today, 0);

    const [creatives, links] = await Promise.all([
      this.prisma.creative.findMany({
        where: { tenantId, ...(canReadAll ? {} : { createdById: context.userId }) },
        select: {
          id: true, code: true, title: true, kind: true, angle: true, hookType: true,
          format: true, remixOfCode: true, createdAt: true,
          metaAdId: true, metaAdLinks: { select: { adId: true } },
          createdBy: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.creativeMetaAdLink.findMany({ where: { tenantId }, select: { adId: true, creativeId: true } }),
    ]);

    const visibleIds = new Set(creatives.map((creative) => creative.id));
    const creativeByAd = new Map<string, string>();
    for (const link of links) if (visibleIds.has(link.creativeId)) creativeByAd.set(link.adId, link.creativeId);
    for (const creative of creatives) {
      if (creative.metaAdId && !creativeByAd.has(creative.metaAdId)) creativeByAd.set(creative.metaAdId, creative.id);
    }
    const adIds = [...creativeByAd.keys()];

    const econ = new Map<string, EconTotals>();
    const weekCur = new Map<string, WeekTotals>();
    const weekPrev = new Map<string, WeekTotals>();

    if (adIds.length) {
      const [reconciled, insights] = await Promise.all([
        this.prisma.reconcileMarketing.groupBy({
          by: ['adId'],
          where: { tenantId, adId: { in: adIds }, date: { gte: econStart, lte: end } },
          _sum: { spend: true, purchasesPos: true, codPos: true, canceledCodPos: true, rtsCodPos: true, restockingCodPos: true, abandonedCodPos: true },
        }),
        this.prisma.metaAdInsight.findMany({
          where: { tenantId, adId: { in: adIds }, date: { gte: weekPrevStart, lte: end } },
          select: { adId: true, date: true, impressions: true, linkClicks: true, videoPlays3s: true, frequency: true },
        }),
      ]);
      for (const row of reconciled) {
        const creativeId = creativeByAd.get(row.adId);
        if (!creativeId) continue;
        const bucket = econ.get(creativeId) ?? emptyEcon();
        bucket.spend += Number(row._sum.spend ?? 0);
        bucket.orders += row._sum.purchasesPos ?? 0;
        bucket.grossSales += Number(row._sum.codPos ?? 0);
        bucket.excludedSales += Number(row._sum.canceledCodPos ?? 0) + Number(row._sum.rtsCodPos ?? 0)
          + Number(row._sum.restockingCodPos ?? 0) + Number(row._sum.abandonedCodPos ?? 0);
        econ.set(creativeId, bucket);
      }
      for (const row of insights) {
        const creativeId = creativeByAd.get(row.adId);
        if (!creativeId) continue;
        const target = row.date >= weekCurStart ? weekCur : row.date <= weekPrevEnd ? weekPrev : null;
        if (!target) continue;
        const bucket = target.get(creativeId) ?? emptyWeek();
        bucket.impressions += row.impressions;
        bucket.linkClicks += row.linkClicks;
        bucket.videoPlays3s += row.videoPlays3s ?? 0;
        if (row.frequency !== null && row.impressions > 0) {
          bucket.frequencyNumerator += Number(row.frequency) * row.impressions;
          bucket.frequencyDenominator += row.impressions;
        }
        target.set(creativeId, bucket);
      }
    }

    const ceiling = ADVERTISING_PROVISIONAL_DEFAULTS.adSpendRatioHealthy;
    const warning = ADVERTISING_PROVISIONAL_DEFAULTS.adSpendRatioWarning;

    const rows: InternalRow[] = creatives.map((creative) => {
      const totals = econ.get(creative.id) ?? emptyEcon();
      const cur = weekCur.get(creative.id) ?? emptyWeek();
      const prev = weekPrev.get(creative.id) ?? emptyWeek();
      const adjusted = Math.max(0, totals.grossSales - totals.excludedSales);
      const arPct = adjusted > 0 ? totals.spend / adjusted : null;
      const hookCur = cur.impressions > 0 ? cur.videoPlays3s / cur.impressions : null;
      const hookPrev = prev.impressions > 0 ? prev.videoPlays3s / prev.impressions : null;
      const ctrCur = cur.impressions > 0 ? cur.linkClicks / cur.impressions : null;
      const ctrPrev = prev.impressions > 0 ? prev.linkClicks / prev.impressions : null;
      const freqCur = cur.frequencyDenominator > 0 ? cur.frequencyNumerator / cur.frequencyDenominator : null;
      const freqPrev = prev.frequencyDenominator > 0 ? prev.frequencyNumerator / prev.frequencyDenominator : null;

      const measurable = cur.impressions >= FATIGUE_MIN_IMPRESSIONS && prev.impressions >= FATIGUE_MIN_IMPRESSIONS;
      const hookDecayed = hookPrev !== null && hookPrev > 0 && hookCur !== null && hookCur <= hookPrev * FATIGUE_DECAY;
      const ctrDecayed = ctrPrev !== null && ctrPrev > 0 && ctrCur !== null && ctrCur <= ctrPrev * FATIGUE_DECAY;
      const audienceNotFresh = freqCur === null || freqPrev === null || freqCur >= freqPrev;
      const fatiguing = measurable && (hookDecayed || ctrDecayed) && audienceNotFresh;

      const creatorName = [creative.createdBy.firstName, creative.createdBy.lastName].filter(Boolean).join(' ') || creative.createdBy.email;
      return {
        id: creative.id, code: creative.code, title: creative.title, kind: creative.kind,
        angle: creative.angle, hookType: creative.hookType, format: creative.format,
        remixOfCode: creative.remixOfCode, creator: creatorName,
        isWinner: totals.orders >= EVIDENCE_ORDERS && arPct !== null && arPct <= ceiling,
        fatiguing,
        hasEvidence: totals.spend >= EVIDENCE_SPEND || totals.orders >= EVIDENCE_ORDERS,
        hookDecayed, ctrDecayed,
        metrics: {
          spend30: round(totals.spend, 2), orders30: totals.orders,
          arPct30: arPct === null ? null : round(arPct, 4),
          hookCur: hookCur === null ? null : round(hookCur, 4),
          hookPrev: hookPrev === null ? null : round(hookPrev, 4),
          ctrCur: ctrCur === null ? null : round(ctrCur, 4),
          ctrPrev: ctrPrev === null ? null : round(ctrPrev, 4),
          frequency: freqCur === null ? null : round(freqCur, 2),
        },
      };
    });

    return {
      context, canReadAll, today, rows, warning,
      window: {
        econStart: econStart.toISOString().slice(0, 10),
        end: today,
        rule: { arCeiling: ceiling, killLine: warning, evidenceSpend: EVIDENCE_SPEND, evidenceOrders: EVIDENCE_ORDERS },
      },
    };
  }

  /** Latest analysis run for THIS user — the run and its daily slot are personal. */
  private async latestRunFor(tenantId: string, userId: string) {
    return this.prisma.creativeInsightRun.findFirst({
      where: { tenantId, createdById: userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, answer: true, model: true, periodStart: true, periodEnd: true, createdAt: true },
    });
  }

  /**
   * The creative's view: which of their creatives deserve fresh versions.
   *
   * A fatiguing performer comes first — it has a deadline. A proven winner
   * follows — it has earned more variations. Everything else sits in a quiet
   * "not yet" list with neutral reasons: what to DO about an underperformer is
   * the advertiser's dashboard, not this one.
   */
  async getQueue(actor: CreativeActor) {
    const computed = await this.computeRows(actor);
    const { rows, context, today } = computed;

    const suggestions = rows
      .filter((row) =>
        (row.fatiguing && row.metrics.orders30 > 0 && (row.metrics.arPct30 === null || row.metrics.arPct30 <= computed.warning))
        || (row.isWinner && !row.fatiguing))
      .map((row) => {
        const urgency: SuggestionUrgency = row.fatiguing ? 'REFRESH_NOW' : 'MORE_VARIATIONS';
        const reason = row.fatiguing
          ? `Was landing, now decaying — ${row.hookDecayed ? `hook ${pctText(row.metrics.hookPrev)} → ${pctText(row.metrics.hookCur)}` : `CTR ${pctText(row.metrics.ctrPrev)} → ${pctText(row.metrics.ctrCur)}`} this week. Make fresh versions before it dies.`
          : `Proven winner — ${row.metrics.orders30} orders at ${pctText(row.metrics.arPct30)} AR%. Worth more variations while it's working.`;
        return { ...row, urgency, reason };
      })
      .sort((a, b) => (a.urgency === b.urgency ? b.metrics.spend30 - a.metrics.spend30 : a.urgency === 'REFRESH_NOW' ? -1 : 1));

    const suggestedIds = new Set(suggestions.map((row) => row.id));
    const others = rows
      .filter((row) => !suggestedIds.has(row.id))
      .map((row) => ({
        id: row.id, code: row.code, title: row.title,
        status: (row.hasEvidence ? 'NO_SIGNAL' : 'GATHERING_DATA') as OtherStatus,
        note: row.hasEvidence
          ? 'No strong signal in the last 30 days — nothing to refresh from yet.'
          : `Still gathering data — ${pesoText(row.metrics.spend30)} of ${pesoText(EVIDENCE_SPEND)} spend, ${row.metrics.orders30} of ${EVIDENCE_ORDERS} orders.`,
      }));

    const latestRun = await this.latestRunFor(context.tenantId, context.userId);
    const diagnoseUsedToday = Boolean(
      latestRun && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(latestRun.createdAt) === today,
    );

    return {
      window: computed.window,
      suggestions: suggestions.map(({ hasEvidence, hookDecayed, ctrDecayed, ...row }) => row),
      others,
      latestRun,
      diagnoseUsedToday,
      aiConfigured: Boolean(await this.aiSettings.resolveKey(context.tenantId)),
    };
  }

  /**
   * The rolling-30-day read: what the winners share, what the losers share,
   * the best angles, and the variations worth making next. Losers are half the
   * value — winners alone say what to copy, losers say what to stop making.
   */
  async diagnose(actor: CreativeActor) {
    const computed = await this.computeRows(actor);
    const { context, rows, today } = computed;
    const key = await this.aiSettings.resolveKey(context.tenantId);
    if (!key) {
      throw new ServiceUnavailableException('No Anthropic API key configured. Ask the main admin to add one in Settings → AI.');
    }

    // One per day, by the owner's rule — a human clicks it, the gate just
    // stops a second click from double-spending.
    const latestRun = await this.latestRunFor(context.tenantId, context.userId);
    if (latestRun && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(latestRun.createdAt) === today) {
      throw new HttpException(
        `Today's analysis already ran at ${new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(latestRun.createdAt)}. One per day — it is on the page below; run again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const graded = rows.filter((row) => row.hasEvidence);
    const winners = graded.filter((row) => row.isWinner);
    if (graded.length < 3 || winners.length < 1) {
      throw new ServiceUnavailableException(
        `Not enough judged creatives to analyze — ${graded.length} past the evidence gate, ${winners.length} winner${winners.length === 1 ? '' : 's'}. Run more creatives first; an analysis of two data points is a guess wearing a badge.`,
      );
    }

    const detail = await this.prisma.creative.findMany({
      where: { tenantId: context.tenantId, id: { in: graded.map((row) => row.id) } },
      select: { id: true, script: true, notes: true, metaAdLinks: { select: { adId: true } }, metaAdId: true },
    });
    const detailById = new Map(detail.map((row) => [row.id, row]));
    const allAdIds = detail.flatMap((row) => [...row.metaAdLinks.map((link) => link.adId), ...(row.metaAdId ? [row.metaAdId] : [])]);
    const copies = allAdIds.length
      ? await this.prisma.adCreative.findMany({ where: { tenantId: context.tenantId, adIds: { hasSome: allAdIds } }, select: { adIds: true, title: true, body: true } })
      : [];
    const copyByAd = new Map<string, { title: string | null; body: string | null }>();
    for (const copy of copies) for (const adId of copy.adIds) copyByAd.set(adId, { title: copy.title, body: copy.body });

    const clip = (value: string | null | undefined, max: number) => (value ? value.replace(/\s+/g, ' ').slice(0, max) : null);
    const block = (row: InternalRow) => {
      const extra = detailById.get(row.id);
      const adIdsForRow = extra ? [...extra.metaAdLinks.map((link) => link.adId), ...(extra.metaAdId ? [extra.metaAdId] : [])] : [];
      const copy = adIdsForRow.map((adId) => copyByAd.get(adId)).find(Boolean);
      return [
        `${row.code} · ${row.kind} · ${row.isWinner ? 'WINNER' : 'NON-WINNER'}${row.fatiguing ? ' · FATIGUING' : ''}`,
        `angle: ${row.angle ?? '—'} | hookType: ${row.hookType ?? '—'} | format: ${row.format ?? '—'}`,
        `orders30: ${row.metrics.orders30} | AR%: ${pctText(row.metrics.arPct30)} | spend30: ${pesoText(row.metrics.spend30)} | hook: ${pctText(row.metrics.hookCur)} | ctr: ${pctText(row.metrics.ctrCur)}`,
        copy?.body ? `ad copy: ${clip(copy.body, 300)}` : null,
        extra?.script ? `script: ${clip(extra.script, 600)}` : 'script: (none pasted)',
      ].filter(Boolean).join('\n');
    };

    const prompt = [
      `Creative performance for a PH COD e-commerce brand — rolling last 30 days (${computed.window.econStart} to ${computed.window.end}). The winner bar is 10+ orders at AR% (spend ÷ net sales) ≤ 30%. The reader is the CREATIVE who makes the videos, not the media buyer.`,
      ``,
      `=== WINNERS (${winners.length}) ===`,
      ...winners.map(block),
      ``,
      `=== NON-WINNERS (${graded.length - winners.length}) ===`,
      ...graded.filter((row) => !row.isWinner).map(block),
    ].join('\n\n');

    const client = new Anthropic({ apiKey: key });
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: [
          `You are the creative strategist writing for the video creative of this account. Analyze ONLY the data provided — never invent creatives, numbers, or audience facts. Cite creative codes for every claim.`,
          `Answer in four short sections, markdown headers: "What the winners share", "What the losers share", "Best angles to make more of", "Variations to try next".`,
          `"Variations to try next" is the payoff: 3-5 concrete variation ideas, each naming which winner it builds on and which element changes (hook / angle / format / avatar / opening visual). Keep the ideas diverse — each should move different elements, because the ad platform suppresses near-duplicates. Keep the whole answer under 500 words. If the sample is thin, say plainly which conclusions are weak.`,
        ].join('\n'),
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (error) {
      // A dead or wrong key must read as configuration, not as a crash.
      throw new ServiceUnavailableException(`The AI call failed: ${(error as Error).message}`);
    }
    const answer = response.content
      .filter((item): item is Anthropic.TextBlock => item.type === 'text')
      .map((item) => item.text).join('\n').trim();

    const run = await this.prisma.creativeInsightRun.create({
      data: {
        tenantId: context.tenantId,
        periodStart: new Date(`${computed.window.econStart}T00:00:00.000Z`),
        periodEnd: new Date(`${computed.window.end}T00:00:00.000Z`),
        model: MODEL,
        answer,
        inputSummary: {
          winners: winners.map((row) => row.code),
          losers: graded.filter((row) => !row.isWinner).map((row) => row.code),
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        } as Prisma.InputJsonObject,
        createdById: context.userId,
      },
      select: { id: true, answer: true, model: true, periodStart: true, periodEnd: true, createdAt: true },
    });
    return run;
  }

  /**
   * Variant briefs for one creative. Diversity is a hard instruction, not a
   * vibe: near-clones of a winner get suppressed by Meta's delivery, so each
   * variant must move at least two named axes.
   */
  async variants(actor: CreativeActor, creativeId: string) {
    const context = await this.access.resolve(actor);
    const key = await this.aiSettings.resolveKey(context.tenantId);
    if (!key) {
      throw new ServiceUnavailableException('No Anthropic API key configured. Ask the main admin to add one in Settings → AI.');
    }

    const creative = await this.prisma.creative.findFirst({
      where: {
        id: creativeId,
        tenantId: context.tenantId,
        ...(this.access.canReadAll(context) ? {} : { createdById: context.userId }),
      },
      select: {
        id: true, code: true, title: true, kind: true, angle: true, hookType: true, format: true,
        script: true, notes: true, storeConfigId: true,
        storeConfig: { select: { storeId: true } },
        metaAdId: true, metaAdLinks: { select: { adId: true } },
      },
    });
    if (!creative) throw new NotFoundException('Creative not found');

    const adIds = [...creative.metaAdLinks.map((link) => link.adId), ...(creative.metaAdId ? [creative.metaAdId] : [])];
    const copyRow = adIds.length
      ? await this.prisma.adCreative.findFirst({ where: { tenantId: context.tenantId, adIds: { hasSome: adIds } }, select: { title: true, body: true } })
      : null;
    if (!creative.script && !copyRow?.body) {
      throw new ServiceUnavailableException(`${creative.code} has no script and no synced ad copy — nothing to remix. Paste the script in the registry first.`);
    }

    const computed = await this.computeRows(actor);
    const row = computed.rows.find((item) => item.id === creative.id);
    const latest = await this.latestRunFor(context.tenantId, context.userId);
    const latestContext = latest?.answer ? latest.answer.slice(0, 1200) : null;

    const client = new Anthropic({ apiKey: key });
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 3000,
        system: [
          `You generate ad variant briefs for a PH COD e-commerce brand. Respond with ONLY a JSON array, no prose before or after.`,
          `Exactly 6 objects, each: {"title": string, "hook": string (the spoken/on-screen first line), "angle": string, "hookType": one of "PAIN_POINT"|"CURIOSITY"|"SOCIAL_PROOF"|"BEFORE_AFTER", "format": one of "UGC"|"TESTIMONIAL"|"PRODUCT_DEMO"|"PROBLEM_SOLUTION", "script": string (8-12 short lines, Taglish is fine), "rationale": string (one sentence, tied to the data), "differsBy": string[] (which axes moved)}.`,
          `Diversity is mandatory: every variant differs from the ORIGINAL and from every OTHER variant on at least two axes among hook, angle, format, avatar/talent, opening visual. Use at least 3 distinct hookTypes and at least 2 formats across the 6. Near-duplicates get suppressed by the ad platform — do not produce them.`,
        ].join('\n'),
        messages: [{
          role: 'user',
          content: [
            `ORIGINAL ${creative.code} · ${creative.kind}`,
            `title: ${creative.title}`,
            `angle: ${creative.angle ?? '—'} | hookType: ${creative.hookType ?? '—'} | format: ${creative.format ?? '—'}`,
            row ? `performance 30d: ${row.metrics.orders30} orders · AR% ${pctText(row.metrics.arPct30)} · hook ${pctText(row.metrics.hookCur)}${row.fatiguing ? ' · FATIGUING — the refresh should feel new, not like a re-run' : ''}` : null,
            copyRow?.body ? `ad copy: ${copyRow.body.slice(0, 400)}` : null,
            creative.script ? `script:\n${creative.script.slice(0, 1500)}` : null,
            latestContext ? `\nAccount-level learnings from the last analysis (use them):\n${latestContext}` : null,
          ].filter(Boolean).join('\n'),
        }],
      });
    } catch (error) {
      throw new ServiceUnavailableException(`The AI call failed: ${(error as Error).message}`);
    }

    const raw = response.content
      .filter((item): item is Anthropic.TextBlock => item.type === 'text')
      .map((item) => item.text).join('\n').trim();

    let variants: unknown[] | null = null;
    try {
      const start = raw.indexOf('[');
      const endIdx = raw.lastIndexOf(']');
      if (start !== -1 && endIdx > start) {
        const parsed = JSON.parse(raw.slice(start, endIdx + 1));
        if (Array.isArray(parsed)) variants = parsed;
      }
    } catch {
      // Raw text still gets returned; the UI shows it un-parsed rather than nothing.
    }

    return {
      creative: { id: creative.id, code: creative.code, title: creative.title, storeId: creative.storeConfig.storeId },
      model: MODEL,
      variants,
      raw: variants ? null : raw,
    };
  }
}
