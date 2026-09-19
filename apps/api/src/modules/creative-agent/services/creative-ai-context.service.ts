import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { sceneIndexAt } from '../utils/creative-ai-sampling';
import type { MediaManifest } from './creative-ai-media.service';

const numberValue = (value: Prisma.Decimal | number | null | undefined) => Number(value ?? 0);
const ratio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;
const money = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class CreativeAiContextService {
  constructor(private readonly prisma: PrismaService) {}

  async build(tenantId: string, runId: string) {
    const run = await this.prisma.creativeAiRun.findFirstOrThrow({
      where: { id: runId, tenantId },
      include: {
        creative: {
          include: {
            storeConfig: { select: { storeNameSnapshot: true } },
            aliases: { select: { alias: true } },
            metaAdLinks: {
              select: { accountId: true, adId: true, adNameSnapshot: true, source: true, linkedAt: true },
              orderBy: { linkedAt: 'asc' },
            },
          },
        },
      },
    });
    const creative = run.creative;
    const adIds = [...new Set([
      ...creative.metaAdLinks.map((link) => link.adId),
      ...(creative.metaAdId ? [creative.metaAdId] : []),
    ])];
    const date = { gte: run.dateStart, lte: run.dateEnd };
    const warnings: string[] = [];
    if (adIds.length === 0) warnings.push('NO_LINKED_META_ADS');

    const [reconciled, hook, hold, completion, adDescriptors, daily, quartiles] = adIds.length > 0
      ? await Promise.all([
          this.prisma.reconcileMarketing.aggregate({
            where: { tenantId, adId: { in: adIds }, date },
            _sum: {
              spend: true,
              impressions: true,
              linkClicks: true,
              leads: true,
              purchasesPos: true,
              deliveredCount: true,
              canceledCount: true,
              rtsCount: true,
              codPos: true,
              deliveredCodPos: true,
              sfSdrPos: true,
              ffSdrPos: true,
              ifSdrPos: true,
              codFeeDeliveredPos: true,
              cogsDeliveredPos: true,
            },
          }),
          this.prisma.metaAdInsight.aggregate({
            where: { tenantId, adId: { in: adIds }, date, videoPlays3s: { not: null } },
            _sum: { videoPlays3s: true, impressions: true },
          }),
          this.prisma.metaAdInsight.aggregate({
            where: {
              tenantId,
              adId: { in: adIds },
              date,
              videoPlays3s: { not: null },
              thruPlays: { not: null },
            },
            _sum: { thruPlays: true, videoPlays3s: true },
          }),
          this.prisma.metaAdInsight.aggregate({
            where: { tenantId, adId: { in: adIds }, date, thruPlays: { not: null } },
            _sum: { thruPlays: true, impressions: true },
          }),
          this.prisma.metaAdInsight.findMany({
            where: { tenantId, adId: { in: adIds }, date },
            select: { adName: true, campaignName: true, status: true },
            distinct: ['adId'],
            orderBy: { date: 'desc' },
          }),
          this.prisma.reconcileMarketing.groupBy({
            by: ['date'],
            where: { tenantId, adId: { in: adIds }, date },
            _sum: {
              spend: true,
              impressions: true,
              linkClicks: true,
              purchasesPos: true,
              deliveredCount: true,
              canceledCount: true,
              rtsCount: true,
              deliveredCodPos: true,
              cogsDeliveredPos: true,
              sfSdrPos: true,
              ffSdrPos: true,
              ifSdrPos: true,
              codFeeDeliveredPos: true,
            },
            orderBy: { date: 'asc' },
          }),
          // How far viewers got, as Meta measures it: plays reaching 25, 50,
          // 75, 95 and 100 percent of the video's length.
          this.prisma.metaAdInsight.aggregate({
            where: { tenantId, adId: { in: adIds }, date, videoPlays25: { not: null } },
            _sum: {
              impressions: true,
              videoPlays3s: true,
              videoPlays25: true,
              videoPlays50: true,
              videoPlays75: true,
              videoPlays95: true,
              videoPlays100: true,
            },
          }),
        ])
      : [
          { _sum: {} },
          { _sum: {} },
          { _sum: {} },
          { _sum: {} },
          [],
          [],
          { _sum: {} },
        ] as any;

    const spend = numberValue(reconciled._sum.spend);
    const impressions = reconciled._sum.impressions ?? 0;
    const linkClicks = reconciled._sum.linkClicks ?? 0;
    const landingPageViews = reconciled._sum.leads ?? 0;
    const orders = reconciled._sum.purchasesPos ?? 0;
    const delivered = reconciled._sum.deliveredCount ?? 0;
    const cancelled = reconciled._sum.canceledCount ?? 0;
    const rts = reconciled._sum.rtsCount ?? 0;
    const grossRevenue = numberValue(reconciled._sum.codPos);
    const deliveredRevenue = numberValue(reconciled._sum.deliveredCodPos);
    const deliveredCosts = numberValue(reconciled._sum.sfSdrPos)
      + numberValue(reconciled._sum.ffSdrPos)
      + numberValue(reconciled._sum.ifSdrPos)
      + numberValue(reconciled._sum.codFeeDeliveredPos)
      + numberValue(reconciled._sum.cogsDeliveredPos);
    const hookNumerator = hook._sum.videoPlays3s ?? 0;
    const hookDenominator = hook._sum.impressions ?? 0;
    const holdNumerator = hold._sum.thruPlays ?? 0;
    const holdDenominator = hold._sum.videoPlays3s ?? 0;
    const completionNumerator = completion._sum.thruPlays ?? 0;
    const completionDenominator = completion._sum.impressions ?? 0;

    if (impressions > 0 && hookDenominator === 0) warnings.push('VIDEO_METRICS_NOT_MEASURED');
    if (adIds.length > 0 && daily.length === 0) warnings.push('NO_RECONCILED_DATA_IN_DATE_RANGE');

    // The preprocessing manifest is saved on the run before this builder is
    // called, so retention shares can be pinned to real timestamps and scenes.
    const manifest = (run.mediaManifest ?? null) as MediaManifest | null;
    const video = manifest && manifest.kind === 'VIDEO'
      ? {
          durationSeconds: manifest.durationSeconds,
          sceneCount: manifest.scenes?.length ?? 0,
          sheetCount: manifest.sheets?.length ?? 0,
          transcriptStatus: manifest.transcript?.status ?? null,
          pacing: manifest.pacing ?? null,
        }
      : null;
    const retention = this.retention(quartiles._sum ?? {}, manifest);
    if (adIds.length > 0 && creative.kind === 'VIDEO' && !retention) warnings.push('VIDEO_RETENTION_NOT_MEASURED');

    return {
      schemaVersion: 1,
      scope: {
        dateStart: this.dateOnly(run.dateStart),
        dateEnd: this.dateOnly(run.dateEnd),
      },
      // The analysis question is fixed in the prompt (with a lens chosen from
      // the creative's performance status), so no free-text question is sent.
      // Only what the analysis needs. Record IDs, account IDs, and the
      // creator's identity add nothing to the answer, so they never leave ERP.
      creative: {
        code: creative.code,
        title: creative.title,
        kind: creative.kind,
        format: creative.format,
        hookType: creative.hookType,
        script: creative.script,
        notes: creative.notes,
        product: {
          name: creative.posProductName,
        },
        store: {
          name: creative.storeConfig.storeNameSnapshot,
        },
        workflow: {
          revisionState: creative.revisionState,
          performanceStatus: creative.performanceStatus,
          submittedAt: creative.submittedAt,
          approvedAt: creative.approvedAt,
        },
        aliases: creative.aliases.map((alias) => alias.alias),
      },
      attribution: {
        linkedAdCount: adIds.length,
        ads: adDescriptors.map((ad: { adName: string | null; campaignName: string | null; status: string | null }) => ({
          adName: ad.adName,
          campaignName: ad.campaignName,
          status: ad.status,
        })),
        source: 'creative_meta_ad_links -> reconcile_marketing + meta_ad_insights',
      },
      video,
      retention,
      metrics: {
        spend: money(spend),
        impressions,
        linkClicks,
        landingPageViews,
        orders,
        delivered,
        cancelled,
        rts,
        grossRevenue: money(grossRevenue),
        deliveredRevenue: money(deliveredRevenue),
        deliveredCosts: money(deliveredCosts),
        netContribution: money(deliveredRevenue - deliveredCosts - spend),
        hookRate: ratio(hookNumerator, hookDenominator),
        holdRate: ratio(holdNumerator, holdDenominator),
        completionRate: ratio(completionNumerator, completionDenominator),
        ctr: ratio(linkClicks, impressions),
        cvr: ratio(orders, linkClicks),
        costPerOrder: orders > 0 ? money(spend / orders) : null,
        deliveredCostPerOrder: delivered > 0 ? money(spend / delivered) : null,
        cancellationRate: ratio(cancelled, orders),
        rtsRate: ratio(rts, delivered + rts),
        deliveryRate: ratio(delivered, orders),
        mar: ratio(spend, grossRevenue),
        rawRateInputs: {
          hook: { numerator: hookNumerator, denominator: hookDenominator },
          hold: { numerator: holdNumerator, denominator: holdDenominator },
          completion: { numerator: completionNumerator, denominator: completionDenominator },
        },
      },
      daily: daily.map((row: any) => {
        const daySpend = numberValue(row._sum.spend);
        const dayDeliveredRevenue = numberValue(row._sum.deliveredCodPos);
        const dayCosts = numberValue(row._sum.cogsDeliveredPos)
          + numberValue(row._sum.sfSdrPos)
          + numberValue(row._sum.ffSdrPos)
          + numberValue(row._sum.ifSdrPos)
          + numberValue(row._sum.codFeeDeliveredPos);
        return {
          date: this.dateOnly(row.date),
          spend: money(daySpend),
          impressions: row._sum.impressions ?? 0,
          linkClicks: row._sum.linkClicks ?? 0,
          orders: row._sum.purchasesPos ?? 0,
          delivered: row._sum.deliveredCount ?? 0,
          cancelled: row._sum.canceledCount ?? 0,
          rts: row._sum.rtsCount ?? 0,
          netContribution: money(dayDeliveredRevenue - dayCosts - daySpend),
        };
      }),
      dataQuality: {
        warnings,
        notes: [
          'Null rates mean the source did not measure the denominator; they are not zero.',
          'Order metrics come from reconcile_marketing and use the ERP dashboard formulas.',
          'The analysis may explain correlation but must not claim causation from these aggregates.',
        ],
      },
    };
  }

  /**
   * Retention as a curve the model can read against the timeline: each share
   * of the length becomes a timestamp and the scene containing it, with how
   * many of the 3-second viewers were still there and how many left since
   * the previous point.
   */
  private retention(
    sums: Record<string, number | null | undefined>,
    manifest: MediaManifest | null,
  ) {
    const base3s = sums.videoPlays3s ?? 0;
    const impressions = sums.impressions ?? 0;
    const duration = manifest?.kind === 'VIDEO' ? manifest.durationSeconds : null;
    const scenes = manifest?.kind === 'VIDEO' ? manifest.scenes ?? [] : [];
    const raw: Array<[number, number | null | undefined]> = [
      [0.25, sums.videoPlays25],
      [0.5, sums.videoPlays50],
      [0.75, sums.videoPlays75],
      [0.95, sums.videoPlays95],
      [1, sums.videoPlays100],
    ];
    const measured = raw.filter((entry): entry is [number, number] => typeof entry[1] === 'number');
    if (measured.length === 0 || base3s <= 0) return null;

    let previous = base3s;
    const points = measured.map(([share, plays]) => {
      const atSeconds = duration != null ? Math.round(duration * share * 10) / 10 : null;
      const point = {
        share,
        label: `${Math.round(share * 100)}%`,
        atSeconds,
        sceneIndex: atSeconds != null ? sceneIndexAt(scenes, atSeconds) : null,
        plays,
        ofImpressions: ratio(plays, impressions),
        of3sViewers: ratio(plays, base3s),
        lostSincePrevious: previous > 0 ? Math.round((1 - plays / previous) * 1000) / 1000 : null,
      };
      previous = plays;
      return point;
    });
    return {
      basis: 'Meta video plays reaching 25/50/75/95/100% of the length, summed over the linked ads in the period.',
      threeSecondPlays: base3s,
      impressions,
      points,
      note: 'atSeconds maps each share to this creative\'s duration; sceneIndex is the detected scene containing that moment. lostSincePrevious is the share of viewers who left between this point and the previous one.',
    };
  }

  private dateOnly(value: Date | string) {
    return new Date(value).toISOString().slice(0, 10);
  }
}
