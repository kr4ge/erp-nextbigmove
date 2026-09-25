import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import type { UpsertCreativeStoreTargetDto } from '../dto/creative-store-target.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';

/** Which figures came from the store itself rather than the tenant fallback. */
export type StoreTargetSource = 'STORE' | 'TENANT_DEFAULT' | 'MIXED' | 'NONE';

export type StoreTargetValues = {
  hookRatePct: number | null;
  holdRatePct: number | null;
  ctrPct: number | null;
  /** Where an order stops making money. A ceiling, not an ambition. */
  breakevenCpp: number | null;
  /** What a good creative should achieve, comfortably under break-even. */
  cpp: number | null;
  /** Proven headroom: below this, put more budget behind it. */
  scaleCpp: number | null;
  /** Above this the creative is losing money faster than it can recover. */
  killCpp: number | null;
  arPct: number | null;
  scaleArPct: number | null;
  killArPct: number | null;
  maxCancellationPct: number | null;
  maxRtsPct: number | null;
  note: string | null;
  /** Set when any value was inherited, so the prompt can say so. */
  source?: StoreTargetSource;
  inheritedKeys?: string[];
};

export const STORE_TARGET_KEYS = [
  'hookRatePct',
  'holdRatePct',
  'ctrPct',
  'breakevenCpp',
  'cpp',
  'scaleCpp',
  'killCpp',
  'arPct',
  'scaleArPct',
  'killArPct',
  'maxCancellationPct',
  'maxRtsPct',
] as const;

/**
 * Target KPIs per store.
 *
 * What a winner looks like for a store is decided once here and read by every
 * analysis of that store's creatives, as prompt variables. Reading needs the
 * same permission as reading creatives; deciding the targets is an advertising
 * judgement and needs performance management.
 */
@Injectable()
export class CreativeStoreTargetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
  ) {}

  /** Every active store with its targets, or null where none are set. */
  async listForTenant(actor: CreativeActor) {
    const context = await this.access.resolve(actor);
    this.access.require(
      context,
      CREATIVE_AGENT_PERMISSIONS.READ,
      CREATIVE_AGENT_PERMISSIONS.READ_ALL,
      CREATIVE_AGENT_PERMISSIONS.AI_USE,
      CREATIVE_AGENT_PERMISSIONS.AI_MANAGE,
    );
    const stores = await this.prisma.creativeStoreConfig.findMany({
      where: { tenantId: context.tenantId, active: true },
      select: {
        id: true,
        storeId: true,
        storeNameSnapshot: true,
        codePrefix: true,
        target: { include: { updatedBy: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { storeNameSnapshot: 'asc' },
    });
    return stores.map((store) => ({
      storeConfigId: store.id,
      posStoreId: store.storeId,
      name: store.storeNameSnapshot,
      codePrefix: store.codePrefix,
      targets: this.present(store.target),
      isSet: this.hasAny(store.target),
    }));
  }

  /**
   * One store's targets, with the tenant's defaults filling any gap.
   *
   * A tenant can run a hundred stores; asking someone to type the same six
   * numbers into each is data entry, not judgement. So a blank field falls
   * back to the tenant default and the result records which values were
   * inherited, because the prompt must not present a fallback as a decision
   * somebody made about this store.
   */
  async forStore(tenantId: string, storeConfigId: string): Promise<StoreTargetValues | null> {
    const [own, fallback] = await Promise.all([
      this.prisma.creativeStoreTarget.findFirst({ where: { tenantId, storeConfigId } }),
      this.prisma.creativeAiTargetDefault.findUnique({ where: { tenantId } }),
    ]);
    const ownValues = this.hasAny(own) ? this.values(own!) : null;
    const defaultValues = this.hasAny(fallback) ? this.values(fallback!) : null;
    if (!ownValues && !defaultValues) return null;
    if (!defaultValues) return { ...ownValues!, source: 'STORE', inheritedKeys: [] };
    if (!ownValues) return { ...defaultValues, source: 'TENANT_DEFAULT', inheritedKeys: [...STORE_TARGET_KEYS] };

    const merged = { ...ownValues };
    const inherited: string[] = [];
    for (const key of STORE_TARGET_KEYS) {
      if (merged[key] == null && defaultValues[key] != null) {
        merged[key] = defaultValues[key];
        inherited.push(key);
      }
    }
    if (!merged.note && defaultValues.note) merged.note = defaultValues.note;
    return {
      ...merged,
      source: inherited.length === 0 ? 'STORE' : 'MIXED',
      inheritedKeys: inherited,
    };
  }

  /** The tenant's fallback, for the settings panel. */
  async defaultsForTenant(actor: CreativeActor) {
    const context = await this.access.resolve(actor);
    this.access.require(
      context,
      CREATIVE_AGENT_PERMISSIONS.READ,
      CREATIVE_AGENT_PERMISSIONS.READ_ALL,
      CREATIVE_AGENT_PERMISSIONS.AI_USE,
      CREATIVE_AGENT_PERMISSIONS.AI_MANAGE,
    );
    const row = await this.prisma.creativeAiTargetDefault.findUnique({
      where: { tenantId: context.tenantId },
      include: { updatedBy: { select: { firstName: true, lastName: true } } },
    });
    const storesWithOwn = await this.prisma.creativeStoreTarget.count({ where: { tenantId: context.tenantId } });
    const activeStores = await this.prisma.creativeStoreConfig.count({ where: { tenantId: context.tenantId, active: true } });
    return {
      targets: this.present(row),
      isSet: this.hasAny(row),
      canEdit: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE),
      storesWithOwnTargets: storesWithOwn,
      storesInheriting: Math.max(0, activeStores - storesWithOwn),
    };
  }

  /** Create or replace the tenant's fallback targets. */
  async upsertDefaults(actor: CreativeActor, dto: UpsertCreativeStoreTargetDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE);
    assertBandOrder(dto);
    const decimal = (value: number | null | undefined) => (value == null ? null : new Prisma.Decimal(value));
    const values = {
      hookRatePct: decimal(dto.hookRatePct),
      holdRatePct: decimal(dto.holdRatePct),
      ctrPct: decimal(dto.ctrPct),
      breakevenCpp: decimal(dto.breakevenCpp),
      cpp: decimal(dto.cpp),
      scaleCpp: decimal(dto.scaleCpp),
      killCpp: decimal(dto.killCpp),
      arPct: decimal(dto.arPct),
      scaleArPct: decimal(dto.scaleArPct),
      killArPct: decimal(dto.killArPct),
      maxCancellationPct: decimal(dto.maxCancellationPct),
      maxRtsPct: decimal(dto.maxRtsPct),
      note: dto.note?.trim() || null,
      updatedById: context.userId,
    };
    const saved = await this.prisma.$transaction(async (tx) => {
      const row = await tx.creativeAiTargetDefault.upsert({
        where: { tenantId: context.tenantId },
        create: { tenantId: context.tenantId, ...values },
        update: values,
        include: { updatedBy: { select: { firstName: true, lastName: true } } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.target_defaults.update',
          resource: 'CreativeAiTargetDefault',
          resourceId: row.id,
          changes: this.values(row) as unknown as Prisma.InputJsonValue,
        },
      });
      return row;
    });
    return { targets: this.present(saved), isSet: this.hasAny(saved) };
  }

  /**
   * What the ERP would derive as this store's break-even from its own
   * reconciled orders, so the form can offer it instead of leaving the
   * number to memory. Null until enough orders have been delivered.
   */
  async derivedBreakeven(actor: CreativeActor, storeConfigId: string) {
    const context = await this.access.resolve(actor);
    this.access.require(
      context,
      CREATIVE_AGENT_PERMISSIONS.READ,
      CREATIVE_AGENT_PERMISSIONS.READ_ALL,
      CREATIVE_AGENT_PERMISSIONS.AI_USE,
      CREATIVE_AGENT_PERMISSIONS.AI_MANAGE,
    );
    const store = await this.prisma.creativeStoreConfig.findFirst({
      where: { id: storeConfigId, tenantId: context.tenantId },
      select: { storeId: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const adIds = await this.prisma.creativeMetaAdLink.findMany({
      where: { tenantId: context.tenantId, creative: { storeConfig: { storeId: store.storeId } } },
      select: { adId: true },
      distinct: ['adId'],
    }).then((rows) => rows.map((row) => row.adId));
    if (adIds.length === 0) return { breakevenCpp: null, deliveredOrders: 0, days: 90 };

    const sums = await this.prisma.reconcileMarketing.aggregate({
      where: { tenantId: context.tenantId, adId: { in: adIds }, date: { gte: since } },
      _sum: {
        deliveredCount: true, canceledCount: true, rtsCount: true, purchasesPos: true,
        deliveredCodPos: true, cogsDeliveredPos: true, sfSdrPos: true, ffSdrPos: true, ifSdrPos: true, codFeeDeliveredPos: true,
      },
    }).then((row) => row._sum);
    const num = (value: Prisma.Decimal | number | null | undefined) => Number(value ?? 0);
    const delivered = sums.deliveredCount ?? 0;
    const orders = sums.purchasesPos ?? 0;
    if (delivered <= 0 || orders <= 0) return { breakevenCpp: null, deliveredOrders: delivered, days: 90 };

    // Margin on a delivered order, spread over every order it takes to get
    // one delivered. That is the most an order may cost before it loses money.
    const costs = num(sums.cogsDeliveredPos) + num(sums.sfSdrPos) + num(sums.ffSdrPos) + num(sums.ifSdrPos) + num(sums.codFeeDeliveredPos);
    const marginPerDelivered = (num(sums.deliveredCodPos) - costs) / delivered;
    const deliveryRate = delivered / orders;
    const breakeven = marginPerDelivered * deliveryRate;
    return {
      breakevenCpp: breakeven > 0 ? Math.round(breakeven * 100) / 100 : null,
      deliveredOrders: delivered,
      days: 90,
    };
  }

  async get(actor: CreativeActor, storeConfigId: string) {
    const context = await this.access.resolve(actor);
    this.access.require(
      context,
      CREATIVE_AGENT_PERMISSIONS.READ,
      CREATIVE_AGENT_PERMISSIONS.READ_ALL,
      CREATIVE_AGENT_PERMISSIONS.AI_USE,
      CREATIVE_AGENT_PERMISSIONS.AI_MANAGE,
    );
    const store = await this.prisma.creativeStoreConfig.findFirst({
      where: { id: storeConfigId, tenantId: context.tenantId },
      select: { id: true, storeId: true, storeNameSnapshot: true, target: { include: { updatedBy: { select: { firstName: true, lastName: true } } } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    return { storeConfigId: store.id, posStoreId: store.storeId, name: store.storeNameSnapshot, targets: this.present(store.target), isSet: this.hasAny(store.target) };
  }

  /** Create or replace a store's targets. Blank fields are stored as null. */
  async upsert(actor: CreativeActor, storeConfigId: string, dto: UpsertCreativeStoreTargetDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE);
    const store = await this.prisma.creativeStoreConfig.findFirst({
      where: { id: storeConfigId, tenantId: context.tenantId },
      select: { id: true, storeNameSnapshot: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    assertBandOrder(dto);
    const decimal = (value: number | null | undefined) => (value == null ? null : new Prisma.Decimal(value));
    const values = {
      hookRatePct: decimal(dto.hookRatePct),
      holdRatePct: decimal(dto.holdRatePct),
      ctrPct: decimal(dto.ctrPct),
      breakevenCpp: decimal(dto.breakevenCpp),
      cpp: decimal(dto.cpp),
      scaleCpp: decimal(dto.scaleCpp),
      killCpp: decimal(dto.killCpp),
      arPct: decimal(dto.arPct),
      scaleArPct: decimal(dto.scaleArPct),
      killArPct: decimal(dto.killArPct),
      maxCancellationPct: decimal(dto.maxCancellationPct),
      maxRtsPct: decimal(dto.maxRtsPct),
      note: dto.note?.trim() || null,
      updatedById: context.userId,
    };
    const saved = await this.prisma.$transaction(async (tx) => {
      const row = await tx.creativeStoreTarget.upsert({
        where: { storeConfigId: store.id },
        create: { tenantId: context.tenantId, storeConfigId: store.id, ...values },
        update: values,
        include: { updatedBy: { select: { firstName: true, lastName: true } } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.store_targets.update',
          resource: 'CreativeStoreTarget',
          resourceId: row.id,
          changes: { store: store.storeNameSnapshot, ...this.values(row) } as Prisma.InputJsonValue,
        },
      });
      return row;
    });
    return { storeConfigId: store.id, name: store.storeNameSnapshot, targets: this.present(saved), isSet: this.hasAny(saved) };
  }

  private hasAny(row: Record<string, unknown> | null | undefined) {
    return Boolean(row && STORE_TARGET_KEYS.some((key) => row[key] != null));
  }

  private values(row: Record<string, any>): StoreTargetValues {
    const num = (value: Prisma.Decimal | number | null | undefined) => (value == null ? null : Number(value));
    return {
      hookRatePct: num(row.hookRatePct),
      holdRatePct: num(row.holdRatePct),
      ctrPct: num(row.ctrPct),
      breakevenCpp: num(row.breakevenCpp),
      cpp: num(row.cpp),
      scaleCpp: num(row.scaleCpp),
      killCpp: num(row.killCpp),
      arPct: num(row.arPct),
      scaleArPct: num(row.scaleArPct),
      killArPct: num(row.killArPct),
      maxCancellationPct: num(row.maxCancellationPct),
      maxRtsPct: num(row.maxRtsPct),
      note: row.note ?? null,
    };
  }

  private present(row: Record<string, any> | null | undefined) {
    if (!row) return null;
    return {
      ...this.values(row),
      updatedAt: row.updatedAt ?? null,
      updatedBy: row.updatedBy ? `${row.updatedBy.firstName} ${row.updatedBy.lastName}`.trim() : null,
    };
  }
}

/**
 * The targets as prompt text. A missing target is said to be missing, in
 * words, so the model reports NO_THRESHOLDS instead of inventing a number.
 */
const pctText = (value: number | null | undefined) => (value == null ? 'not set' : `${value}%`);
const moneyText = (value: number | null | undefined) => (value == null ? 'not set' : `₱${value.toLocaleString('en-PH')}`);

/**
 * How the scale and kill lines relate to the target when a store has not
 * named its own. Most stores use the same ratios, so asking for four numbers
 * per metric earns nothing; the ERP derives them and says so.
 */
export const BAND_RATIOS = { scale: 0.75, kill: 1.3 } as const;

const round2 = (value: number) => Math.round(value * 100) / 100;

/** The bands a metric actually has: the store's own lines, else derived from the target. */
export function resolveBands(target: number | null, scale: number | null, kill: number | null) {
  return {
    target,
    scale: scale ?? (target == null ? null : round2(target * BAND_RATIOS.scale)),
    kill: kill ?? (target == null ? null : round2(target * BAND_RATIOS.kill)),
    scaleDerived: scale == null && target != null,
    killDerived: kill == null && target != null,
  };
}

/**
 * The bands as a sentence the model can act on.
 *
 * Naming each line for what it decides is the point: a target is an ambition,
 * a break-even is where the money runs out, and the scale and kill lines are
 * where budget moves. Without that distinction every figure under the target
 * reads the same and nothing can be scaled with confidence.
 */
function renderBand(
  label: string,
  format: (value: number | null | undefined) => string,
  input: { scale: number | null; target: number | null; breakeven?: number | null; kill: number | null },
  targetMark = '',
): string[] {
  const band = resolveBands(input.target, input.scale, input.kill);
  const lines = [
    `- ${label} target: ${format(band.target)}${targetMark} (the ambition; at or below this the creative is working)`,
    `- ${label} scale below: ${format(band.scale)} (proven headroom; recommend increasing budget${band.scaleDerived ? `, derived as ${BAND_RATIOS.scale * 100}% of the target` : ''})`,
    `- ${label} kill above: ${format(band.kill)} (losing money faster than it can recover${band.killDerived ? `, derived as ${BAND_RATIOS.kill * 100}% of the target` : ''})`,
  ];
  if (input.breakeven !== undefined) {
    lines.splice(1, 0, `- ${label} break-even: ${format(input.breakeven)} (where an order stops making money; never an ambition)`);
  }
  return lines;
}

export function renderStoreTargets(storeName: string, targets: StoreTargetValues | null): string {
  const empty: StoreTargetValues = {
    hookRatePct: null, holdRatePct: null, ctrPct: null,
    breakevenCpp: null, cpp: null, scaleCpp: null, killCpp: null,
    arPct: null, scaleArPct: null, killArPct: null,
    maxCancellationPct: null, maxRtsPct: null, note: null,
  };
  const values = targets ?? empty;
  const inherited = new Set(values.inheritedKeys ?? []);
  const provenance = !targets
    ? `${storeName} has no target KPIs set yet. Every value below is "not set".`
    : values.source === 'TENANT_DEFAULT'
      ? `Targets for ${storeName}. This store has set none of its own, so every figure below is the tenant-wide default rather than a judgement made about this store. Judge against these bands, and say in your action that the store should set its own.`
      : values.source === 'MIXED'
        ? `Targets for ${storeName}. Figures marked [tenant default] were inherited because this store left them blank; the rest are this store's own. Judge against these bands, not against a single number.`
        : `Targets for ${storeName}, set by this store. Judge against these bands, not against a single number.`;
  const mark = (key: string) => (inherited.has(key) ? ' [tenant default]' : '');
  return [
    provenance,
    ...renderBand('CPP', moneyText, { scale: values.scaleCpp, target: values.cpp, breakeven: values.breakevenCpp, kill: values.killCpp }, mark('cpp')),
    ...renderBand('AR%', pctText, { scale: values.scaleArPct, target: values.arPct, kill: values.killArPct }, mark('arPct')),
    `- Maximum acceptable cancellation rate: ${pctText(values.maxCancellationPct)}${mark('maxCancellationPct')}`,
    `- Maximum acceptable RTS rate: ${pctText(values.maxRtsPct)}${mark('maxRtsPct')}`,
    `- Minimum hook rate: ${pctText(values.hookRatePct)}${mark('hookRatePct')} (a floor: above it is good, below it is a weakness to explain)`,
    '- Hold rate and link CTR have no store figure: judge them against platform norms for cold traffic (hold rate healthy from about 40%, link CTR from about 1%) and say that is what you compared against.',
    ...(values.note ? [`- Note from the store: ${values.note}`] : []),
  ].join('\n');
}

export function storeTargetVariables(targets: StoreTargetValues | null): Record<string, string> {
  const cpp = resolveBands(targets?.cpp ?? null, targets?.scaleCpp ?? null, targets?.killCpp ?? null);
  const ar = resolveBands(targets?.arPct ?? null, targets?.scaleArPct ?? null, targets?.killArPct ?? null);
  return {
    TARGET_HOOK_RATE: pctText(targets?.hookRatePct),
    TARGET_HOLD_RATE: pctText(targets?.holdRatePct),
    TARGET_CTR: pctText(targets?.ctrPct),
    TARGET_AR_PCT: pctText(targets?.arPct),
    SCALE_AR_PCT: pctText(ar.scale),
    KILL_AR_PCT: pctText(ar.kill),
    BREAKEVEN_CPP: moneyText(targets?.breakevenCpp),
    TARGET_CPP: moneyText(targets?.cpp),
    SCALE_CPP: moneyText(cpp.scale),
    KILL_CPP: moneyText(cpp.kill),
    MAX_CANCELLATION_RATE: pctText(targets?.maxCancellationPct),
    MAX_RTS_RATE: pctText(targets?.maxRtsPct),
  };
}

/**
 * The bands only mean anything in order. A kill line below the target, or a
 * target above break-even, would have the analysis contradict itself, so the
 * save is refused with the specific pair that is wrong.
 */
export function assertBandOrder(values: Partial<StoreTargetValues>) {
  const ordered: Array<[string, number | null | undefined, string, number | null | undefined]> = [
    ['Scale below CPP', values.scaleCpp, 'Target CPP', values.cpp],
    ['Target CPP', values.cpp, 'Kill above CPP', values.killCpp],
    ['Target CPP', values.cpp, 'Break-even CPP', values.breakevenCpp],
    ['Scale below AR%', values.scaleArPct, 'Target AR%', values.arPct],
    ['Target AR%', values.arPct, 'Kill above AR%', values.killArPct],
  ];
  for (const [lowerName, lower, higherName, higher] of ordered) {
    if (lower == null || higher == null) continue;
    if (lower > higher) throw new BadRequestException(`${lowerName} must be at or below ${higherName}.`);
  }
}
