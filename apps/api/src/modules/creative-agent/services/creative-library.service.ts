import { BadRequestException, Injectable } from '@nestjs/common';
import { CreativePerformanceStatus, CreativeRevisionState, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import { ListCreativeLibraryQueryDto } from '../dto/list-creative-library-query.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { MediaAssetsService } from '../../../common/services/media-assets.service';
import { CreativeAccessService } from './creative-access.service';

type MetricBucket = {
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  video: Partial<Record<VideoMetricKey, number>>;
  accountIds: Set<string>;
};

type VideoMetricKey =
  | 'videoPlays3s'
  | 'thruPlays'
  | 'videoPlays25'
  | 'videoPlays50'
  | 'videoPlays75'
  | 'videoPlays95'
  | 'videoPlays100';

const VIDEO_METRIC_KEYS: VideoMetricKey[] = [
  'videoPlays3s',
  'thruPlays',
  'videoPlays25',
  'videoPlays50',
  'videoPlays75',
  'videoPlays95',
  'videoPlays100',
];

type UnregisteredBucket = MetricBucket & {
  code: string | null;
  adName: string;
  accountId: string;
  adId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

const CREATIVE_LIBRARY_INCLUDE = {
  storeConfig: { select: { id: true, storeId: true, storeNameSnapshot: true, shopIdSnapshot: true, codePrefix: true, active: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
  aliases: { select: { id: true, alias: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  metaAdLinks: {
    select: { id: true, accountId: true, adId: true, adNameSnapshot: true, source: true, linkedAt: true },
    orderBy: { linkedAt: 'asc' as const },
  },
  thumbnailAsset: { select: { objectKey: true, contentType: true } },
} satisfies Prisma.CreativeInclude;

type CreativeLibraryRow = Prisma.CreativeGetPayload<{ include: typeof CREATIVE_LIBRARY_INCLUDE }>;
type SerializedLibraryItem = {
  code: string;
  title: string;
  createdAt: Date;
  accountIds: string[];
  metaAdId: string | null;
  aliases: string[];
  store: { name: string; [key: string]: unknown };
  creator: { name: string; [key: string]: unknown };
  format: string | null;
  hookType: string | null;
  metrics: Record<string, number | null>;
};

@Injectable()
export class CreativeLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly mediaAssets: MediaAssetsService,
  ) {}

  async list(actor: CreativeActor, query: ListCreativeLibraryQueryDto) {
    const context = await this.access.resolve(actor);
    this.access.require(
      context,
      CREATIVE_AGENT_PERMISSIONS.READ,
      CREATIVE_AGENT_PERMISSIONS.READ_ALL,
      CREATIVE_AGENT_PERMISSIONS.ALIAS_MANAGE,
    );
    const range = this.resolveDateRange(query.startDate, query.endDate);
    const canReadAll = this.access.canReadAll(context);

    const creativeWhere: Prisma.CreativeWhereInput = {
      tenantId: context.tenantId,
      ...(!canReadAll
        ? { createdById: context.userId }
        : query.creatorId
          ? { createdById: query.creatorId }
          : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.storeId ? { storeConfig: { storeId: query.storeId } } : {}),
      ...(query.revisionState ? { revisionState: query.revisionState } : {}),
      ...(query.performanceStatus ? { performanceStatus: query.performanceStatus } : {}),
    };
    const insightWhere: Prisma.MetaAdInsightWhereInput = {
      tenantId: context.tenantId,
      date: { gte: range.start, lte: range.end },
      ...(query.accountId ? { accountId: query.accountId } : {}),
    };

    const [linkedCreatives, visibleCreatives, groupedInsights, storeConfigs, accounts, creators] = await Promise.all([
      this.prisma.creativeMetaAdLink.findMany({
        where: { tenantId: context.tenantId },
        select: { creativeId: true, accountId: true, adId: true },
      }),
      this.prisma.creative.findMany({
        where: creativeWhere,
        include: CREATIVE_LIBRARY_INCLUDE,
      }),
      this.prisma.metaAdInsight.groupBy({
        by: ['accountId', 'adId', 'adName'],
        where: insightWhere,
        _sum: {
          spend: true,
          impressions: true,
          clicks: true,
          linkClicks: true,
          videoPlays3s: true,
          thruPlays: true,
          videoPlays25: true,
          videoPlays50: true,
          videoPlays75: true,
          videoPlays95: true,
          videoPlays100: true,
        },
        _min: { date: true },
        _max: { date: true },
      }),
      this.prisma.creativeStoreConfig.findMany({
        where: { tenantId: context.tenantId },
        select: { id: true, storeId: true, storeNameSnapshot: true, codePrefix: true, active: true },
        orderBy: { storeNameSnapshot: 'asc' },
      }),
      this.prisma.metaAdAccount.findMany({
        where: { tenantId: context.tenantId },
        select: { accountId: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.creative.findMany({
        where: { tenantId: context.tenantId, ...(!canReadAll ? { createdById: context.userId } : {}) },
        distinct: ['createdById'],
        select: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
    ]);

    const linkedByMetaAd = new Map(
      linkedCreatives
        .map((link) => [
          `${link.accountId}:${link.adId}`,
          link.creativeId,
        ]),
    );
    const metrics = new Map<string, MetricBucket>();
    const unregistered = new Map<string, UnregisteredBucket>();
    let untaggedSpend = 0;

    for (const row of groupedInsights) {
      const rowSpend = Number(row._sum.spend ?? 0);
      const rowMetrics = {
        spend: rowSpend,
        impressions: row._sum.impressions ?? 0,
        clicks: row._sum.clicks ?? 0,
        linkClicks: row._sum.linkClicks ?? 0,
      };
      const linkedCreativeId = linkedByMetaAd.get(`${row.accountId}:${row.adId}`);
      if (linkedCreativeId) {
        const bucket = metrics.get(linkedCreativeId) ?? this.emptyMetrics();
        bucket.spend += rowMetrics.spend;
        bucket.impressions += rowMetrics.impressions;
        bucket.clicks += rowMetrics.clicks;
        bucket.linkClicks += rowMetrics.linkClicks;
        this.addVideoMetrics(bucket, row._sum);
        bucket.accountIds.add(row.accountId);
        metrics.set(linkedCreativeId, bucket);
      } else {
        untaggedSpend += rowSpend;
        const key = `${row.accountId}:${row.adId}`;
        const bucket = unregistered.get(key) ?? {
          ...this.emptyMetrics(),
          code: null,
          adName: row.adName,
          accountId: row.accountId,
          adId: row.adId,
          firstSeenAt: row._min.date ?? range.start,
          lastSeenAt: row._max.date ?? range.end,
        };
        bucket.spend += rowMetrics.spend;
        bucket.impressions += rowMetrics.impressions;
        bucket.clicks += rowMetrics.clicks;
        bucket.linkClicks += rowMetrics.linkClicks;
        this.addVideoMetrics(bucket, row._sum);
        bucket.accountIds.add(row.accountId);
        if (row._min.date && row._min.date < bucket.firstSeenAt) bucket.firstSeenAt = row._min.date;
        if (row._max.date && row._max.date > bucket.lastSeenAt) bucket.lastSeenAt = row._max.date;
        unregistered.set(key, bucket);
      }
    }

    const normalizedQuery = query.query?.toLowerCase() ?? '';
    let items = visibleCreatives.map((creative) => {
      const bucket = metrics.get(creative.id) ?? this.emptyMetrics();
      return this.serializeCreative(creative, bucket);
    }).filter((item) => {
      if (query.accountId && !item.accountIds.includes(query.accountId)) return false;
      if (!normalizedQuery) return true;
      return [
        item.code,
        item.title,
        item.store.name,
        item.creator.name,
        item.format,
        item.hookType,
        ...item.aliases,
      ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
    });

    items = this.sortItems(items, query.sortKey, query.sortDirection);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const pageItems = items.slice((page - 1) * query.pageSize, page * query.pageSize);
    // Sign only the page slice; objects stay private and URLs are short-lived.
    await Promise.all(pageItems.map(async (item) => {
      const objectKey = item.thumbnailObjectKey as string | null;
      item.thumbnailUrl = objectKey
        ? await this.mediaAssets.createSignedAssetUrl({ objectKey })
        : null;
      delete item.thumbnailObjectKey;
    }));
    const accountNames = new Map(accounts.map((account) => [account.accountId, account.name]));
    const canManageUnregistered = canReadAll || this.access.has(context, CREATIVE_AGENT_PERMISSIONS.ALIAS_MANAGE);

    const allUnregisteredItems = canManageUnregistered
      ? Array.from(unregistered.values())
        .map((item) => {
          return {
            key: `${item.accountId}:${item.adId}`,
            code: item.code,
            adName: item.adName,
            accountId: item.accountId,
            adId: item.adId,
            accountName: accountNames.get(item.accountId) ?? item.accountId,
            store: null,
            spend: this.roundMoney(item.spend),
            impressions: item.impressions,
            clicks: item.clicks,
            firstSeenAt: item.firstSeenAt.toISOString(),
            lastSeenAt: item.lastSeenAt.toISOString(),
          };
        })
        .sort((left, right) => right.spend - left.spend)
      : [];
    const unregisteredTotal = allUnregisteredItems.length;
    const unregisteredTotalPages = Math.max(
      1,
      Math.ceil(unregisteredTotal / query.unregisteredPageSize),
    );
    const unregisteredPage = Math.min(
      query.unregisteredPage,
      unregisteredTotalPages,
    );
    const unregisteredItems = allUnregisteredItems.slice(
      (unregisteredPage - 1) * query.unregisteredPageSize,
      unregisteredPage * query.unregisteredPageSize,
    );

    return {
      selected: {
        startDate: this.toDateOnly(range.start),
        endDate: this.toDateOnly(range.end),
        query: query.query ?? '',
        kind: query.kind ?? '',
        storeId: query.storeId ?? '',
        accountId: query.accountId ?? '',
        creatorId: query.creatorId ?? '',
        revisionState: query.revisionState ?? '',
        performanceStatus: query.performanceStatus ?? '',
        page,
        pageSize: query.pageSize,
        unregisteredPage,
        unregisteredPageSize: query.unregisteredPageSize,
        sortKey: query.sortKey,
        sortDirection: query.sortDirection,
      },
      filters: {
        stores: storeConfigs.filter((config) => config.storeId).map((config) => ({
          value: config.storeId!,
          label: `${config.storeNameSnapshot} (${config.codePrefix})`,
          active: config.active,
        })),
        creators: creators.map(({ createdBy }) => ({
          value: createdBy.id,
          label: [createdBy.firstName, createdBy.lastName].filter(Boolean).join(' ') || createdBy.email,
        })),
        accounts: accounts.map((account) => ({ value: account.accountId, label: account.name })),
        revisionStates: Object.values(CreativeRevisionState).map((value) => ({ value, label: this.humanize(value) })),
        performanceStatuses: Object.values(CreativePerformanceStatus).map((value) => ({ value, label: this.humanize(value) })),
      },
      items: pageItems,
      unregistered: unregisteredItems,
      summary: { untaggedSpend: this.roundMoney(untaggedSpend) },
      metricsAvailability: {
        spend: true,
        impressions: true,
        clicks: true,
        ctr: true,
        videoPlays3s: true,
        thruPlays: true,
        hookRate: true,
        holdRate: true,
        completionRate: true,
        retention: true,
        reason: 'Video rates are shown when the selected Meta export contains the required raw video columns.',
      },
      pagination: { page, pageSize: query.pageSize, total, totalPages },
      unregisteredPagination: {
        page: unregisteredPage,
        pageSize: query.unregisteredPageSize,
        total: unregisteredTotal,
        totalPages: unregisteredTotalPages,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listUnregistered(actor: CreativeActor, query: ListCreativeLibraryQueryDto) {
    const response = await this.list(actor, query);
    return {
      selected: response.selected,
      items: response.unregistered,
      pagination: response.unregisteredPagination,
      summary: response.summary,
      generatedAt: response.generatedAt,
    };
  }

  private resolveDateRange(startDate?: string, endDate?: string) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 29));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException('Invalid creative library date range');
    }
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (days > 366) throw new BadRequestException('Creative library date range cannot exceed 366 days');
    return { start, end };
  }

  private emptyMetrics(): MetricBucket {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      linkClicks: 0,
      video: {},
      accountIds: new Set<string>(),
    };
  }

  private addVideoMetrics(
    bucket: MetricBucket,
    sums: Partial<Record<VideoMetricKey, number | null>>,
  ) {
    for (const key of VIDEO_METRIC_KEYS) {
      const value = sums[key];
      if (value === null || value === undefined) continue;
      bucket.video[key] = (bucket.video[key] ?? 0) + value;
    }
  }

  private safeRate(numerator: number | null, denominator: number): number | null {
    if (numerator === null || denominator <= 0) return null;
    const rate = numerator / denominator;
    return rate >= 0 && rate <= 1 ? rate : null;
  }

  private serializeCreative(creative: CreativeLibraryRow, metrics: MetricBucket): SerializedLibraryItem & Record<string, unknown> {
    const creatorName = [creative.createdBy.firstName, creative.createdBy.lastName].filter(Boolean).join(' ') || creative.createdBy.email;
    const videoPlays3s = metrics.video.videoPlays3s ?? null;
    const thruPlays = metrics.video.thruPlays ?? null;
    const isStatic = creative.kind === 'STATIC';
    const hookRate = isStatic ? null : this.safeRate(videoPlays3s, metrics.impressions);
    const holdRate = isStatic || videoPlays3s === null
      ? null
      : this.safeRate(thruPlays, videoPlays3s);
    const completionRate = isStatic
      ? null
      : this.safeRate(thruPlays, metrics.impressions);
    const ctr = this.safeRate(metrics.linkClicks, metrics.impressions);
    return {
      id: creative.id,
      code: creative.code,
      title: creative.title,
      store: {
        id: creative.storeConfig.storeId,
        configId: creative.storeConfig.id,
        name: creative.storeConfig.storeNameSnapshot,
        shopId: creative.storeConfig.shopIdSnapshot,
        codePrefix: creative.storeConfig.codePrefix,
        active: creative.storeConfig.active,
      },
      kind: creative.kind,
      accountIds: Array.from(metrics.accountIds).sort(),
      metaAccountId: creative.metaAccountId,
      metaAdId: creative.metaAdId,
      metaAdLinks: creative.metaAdLinks,
      metaAdNameSnapshot: creative.metaAdNameSnapshot,
      metaLinkSource: creative.metaLinkSource,
      metaLinkedAt: creative.metaLinkedAt,
      creator: { id: creative.createdBy.id, name: creatorName, avatar: creative.createdBy.avatar },
      format: creative.format,
      hookType: creative.hookType,
      script: creative.script,
      notes: creative.notes,
      mediaUrl: creative.mediaUrl,
      thumbnailIsVideo: creative.thumbnailIsVideo,
      thumbnailObjectKey: creative.thumbnailAsset?.objectKey ?? null,
      aliases: creative.aliases.map((alias) => alias.alias),
      aliasRecords: creative.aliases,
      revisionState: creative.revisionState,
      performanceStatus: creative.performanceStatus,
      metrics: {
        spend: this.roundMoney(metrics.spend),
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        linkClicks: metrics.linkClicks,
        videoPlays3s,
        thruPlays,
        hookRate,
        holdRate,
        completionRate,
        ctr,
        cpm: metrics.impressions > 0
          ? this.roundMoney((metrics.spend / metrics.impressions) * 1000)
          : null,
        costPerThruPlay: thruPlays !== null && thruPlays > 0
          ? this.roundMoney(metrics.spend / thruPlays)
          : null,
        retention25: isStatic || videoPlays3s === null
          ? null
          : this.safeRate(metrics.video.videoPlays25 ?? null, videoPlays3s),
        retention50: isStatic || videoPlays3s === null
          ? null
          : this.safeRate(metrics.video.videoPlays50 ?? null, videoPlays3s),
        retention75: isStatic || videoPlays3s === null
          ? null
          : this.safeRate(metrics.video.videoPlays75 ?? null, videoPlays3s),
        retention95: isStatic || videoPlays3s === null
          ? null
          : this.safeRate(metrics.video.videoPlays95 ?? null, videoPlays3s),
        retention100: isStatic || videoPlays3s === null
          ? null
          : this.safeRate(metrics.video.videoPlays100 ?? null, videoPlays3s),
      },
      submittedAt: creative.submittedAt,
      approvedAt: creative.approvedAt,
      createdAt: creative.createdAt,
      updatedAt: creative.updatedAt,
    };
  }

  private sortItems(items: Array<SerializedLibraryItem & Record<string, unknown>>, sortKey: string, direction: 'asc' | 'desc') {
    const multiplier = direction === 'asc' ? 1 : -1;
    return [...items].sort((left, right) => {
      const metricKeys = ['spend', 'impressions', 'hookRate', 'holdRate', 'ctr'];
      const leftValue = metricKeys.includes(sortKey) ? left.metrics[sortKey] ?? -1 : left[sortKey];
      const rightValue = metricKeys.includes(sortKey) ? right.metrics[sortKey] ?? -1 : right[sortKey];
      if (typeof leftValue === 'number' && typeof rightValue === 'number') return (leftValue - rightValue) * multiplier;
      if (leftValue instanceof Date && rightValue instanceof Date) return (leftValue.getTime() - rightValue.getTime()) * multiplier;
      return String(leftValue ?? '').localeCompare(String(rightValue ?? '')) * multiplier;
    });
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private humanize(value: string): string {
    return value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
