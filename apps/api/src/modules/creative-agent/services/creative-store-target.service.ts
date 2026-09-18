import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import type { UpsertCreativeStoreTargetDto } from '../dto/creative-store-target.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';

export type StoreTargetValues = {
  hookRatePct: number | null;
  holdRatePct: number | null;
  ctrPct: number | null;
  cpp: number | null;
  arPct: number | null;
  maxCancellationPct: number | null;
  maxRtsPct: number | null;
  note: string | null;
};

export const STORE_TARGET_KEYS = [
  'hookRatePct',
  'holdRatePct',
  'ctrPct',
  'cpp',
  'arPct',
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

  /** One store's targets. Used at analysis time; no actor, tenant-scoped. */
  async forStore(tenantId: string, storeConfigId: string): Promise<StoreTargetValues | null> {
    const row = await this.prisma.creativeStoreTarget.findFirst({ where: { tenantId, storeConfigId } });
    return this.hasAny(row) ? this.values(row!) : null;
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

    const decimal = (value: number | null | undefined) => (value == null ? null : new Prisma.Decimal(value));
    const values = {
      hookRatePct: decimal(dto.hookRatePct),
      holdRatePct: decimal(dto.holdRatePct),
      ctrPct: decimal(dto.ctrPct),
      cpp: decimal(dto.cpp),
      arPct: decimal(dto.arPct),
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
      cpp: num(row.cpp),
      arPct: num(row.arPct),
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
export function renderStoreTargets(storeName: string, targets: StoreTargetValues | null): string {
  if (!targets) {
    return `${storeName} has no target KPIs set yet. Every target below is "not set".\n- Target CPP: not set\n- Target AR%: not set\n- Maximum acceptable cancellation rate: not set\n- Maximum acceptable RTS rate: not set\n- Hook rate benchmark: not set\n- Hold rate benchmark: not set\n- Link CTR benchmark: not set`;
  }
  const pct = (value: number | null) => (value == null ? 'not set' : `${value}%`);
  const money = (value: number | null) => (value == null ? 'not set' : `₱${value.toLocaleString('en-PH')}`);
  return [
    `Targets for ${storeName}:`,
    `- Target CPP: ${money(targets.cpp)}`,
    `- Target AR%: ${pct(targets.arPct)}`,
    `- Maximum acceptable cancellation rate: ${pct(targets.maxCancellationPct)}`,
    `- Maximum acceptable RTS rate: ${pct(targets.maxRtsPct)}`,
    `- Hook rate benchmark: ${pct(targets.hookRatePct)}`,
    `- Hold rate benchmark: ${pct(targets.holdRatePct)}`,
    `- Link CTR benchmark: ${pct(targets.ctrPct)}`,
    ...(targets.note ? [`- Note from the store: ${targets.note}`] : []),
  ].join('\n');
}

export function storeTargetVariables(targets: StoreTargetValues | null): Record<string, string> {
  const pct = (value: number | null | undefined) => (value == null ? 'not set' : `${value}%`);
  const money = (value: number | null | undefined) => (value == null ? 'not set' : `₱${value.toLocaleString('en-PH')}`);
  return {
    TARGET_HOOK_RATE: pct(targets?.hookRatePct),
    TARGET_HOLD_RATE: pct(targets?.holdRatePct),
    TARGET_CTR: pct(targets?.ctrPct),
    TARGET_AR_PCT: pct(targets?.arPct),
    TARGET_CPP: money(targets?.cpp),
    MAX_CANCELLATION_RATE: pct(targets?.maxCancellationPct),
    MAX_RTS_RATE: pct(targets?.maxRtsPct),
  };
}
