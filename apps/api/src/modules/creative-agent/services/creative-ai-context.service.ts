import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

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
            storeConfig: { select: { storeId: true, storeNameSnapshot: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
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

    const [reconciled, hook, hold, completion, adDescriptors, daily] = adIds.length > 0
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
            select: { accountId: true, adId: true, adName: true, campaignId: true, campaignName: true, adsetId: true, status: true },
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
        ])
      : [
          { _sum: {} },
          { _sum: {} },
          { _sum: {} },
          { _sum: {} },
          [],
          [],
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

    return {
      schemaVersion: 1,
      scope: {
        dateStart: this.dateOnly(run.dateStart),
        dateEnd: this.dateOnly(run.dateEnd),
      },
      question: run.question || 'Explain why this creative is or is not working and recommend concrete improvements.',
      creative: {
        id: creative.id,
        code: creative.code,
        title: creative.title,
        kind: creative.kind,
        format: creative.format,
        hookType: creative.hookType,
        script: creative.script,
        notes: creative.notes,
        product: {
          variationId: creative.posVariationId,
          customId: creative.posCustomId,
          name: creative.posProductName,
        },
        store: {
          id: creative.storeConfig.storeId,
          name: creative.storeConfig.storeNameSnapshot,
        },
        creator: {
          id: creative.createdBy.id,
          name: this.personName(creative.createdBy),
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
        linkedAdIds: adIds,
        ads: adDescriptors,
        source: 'creative_meta_ad_links -> reconcile_marketing + meta_ad_insights',
      },
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

  private personName(person: { firstName: string | null; lastName: string | null; email: string }) {
    return [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || person.email;
  }

  private dateOnly(value: Date | string) {
    return new Date(value).toISOString().slice(0, 10);
  }
}
