import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreativeStrategySource, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_STRATEGY_TAGS } from '../creative-agent.constants';
import { CreateStrategyEntryDto, UpdateStrategyResultDto } from '../dto/creative-strategy.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';

const ENTRY_SELECT = {
  id: true,
  date: true,
  title: true,
  description: true,
  tag: true,
  result: true,
  resultUpdatedAt: true,
  source: true,
  creativeId: true,
  createdById: true,
  createdAt: true,
  creative: { select: { code: true, title: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.CreativeStrategyEntrySelect;

type StrategyRow = Prisma.CreativeStrategyEntryGetPayload<{ select: typeof ENTRY_SELECT }>;

/** How far back the Creative Insights prompt reads. Two months covers a full
 *  fatigue cycle plus the run-up to it, which is the span where a logged change
 *  can still plausibly explain a metric that moved. */
const AI_CONTEXT_DAYS = 60;

/**
 * The Strategy Log: what the creative changed, when it took effect, and what
 * happened afterwards.
 *
 * Reading follows the same rule as the rest of the workspace — read_all sees
 * the whole tenant's log, everyone else sees their own. Writing is always
 * scoped to the author's own entries, so a manager reading the roll-up still
 * cannot edit or delete someone else's line.
 */
@Injectable()
export class CreativeStrategyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
  ) {}

  /** Today in Manila. The log is a business-day record, not a UTC timestamp. */
  private manilaToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  }

  private toDate(ymd: string): Date {
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  private serialize(row: StrategyRow, viewerId: string) {
    const name = [row.createdBy.firstName, row.createdBy.lastName].filter(Boolean).join(' ').trim();
    return {
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      title: row.title,
      description: row.description,
      tag: row.tag,
      result: row.result,
      resultUpdatedAt: row.resultUpdatedAt?.toISOString() ?? null,
      source: row.source,
      creativeCode: row.creative?.code ?? null,
      creativeTitle: row.creative?.title ?? null,
      author: { id: row.createdBy.id, name: name || row.createdBy.email },
      /** Drives the UI: only the author gets the result and delete controls. */
      isMine: row.createdById === viewerId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(actor: CreativeActor) {
    const context = await this.access.resolve(actor);
    this.access.requireReadable(context);
    const canReadAll = this.access.canReadAll(context);

    const rows = await this.prisma.creativeStrategyEntry.findMany({
      where: {
        tenantId: context.tenantId,
        ...(canReadAll ? {} : { createdById: context.userId }),
      },
      select: ENTRY_SELECT,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return {
      entries: rows.map((row) => this.serialize(row, context.userId)),
      tags: CREATIVE_STRATEGY_TAGS,
      today: this.manilaToday(),
      /** True when the list spans more than the viewer's own work, so the UI
       *  can show who wrote each line instead of a redundant self-attribution. */
      showsOthers: canReadAll,
    };
  }

  async create(actor: CreativeActor, dto: CreateStrategyEntryDto) {
    const context = await this.access.resolve(actor);
    this.access.requireReadable(context);

    // A code is optional, but a wrong one should fail loudly rather than
    // silently detach the entry from the creative it is about.
    let creativeId: string | null = null;
    if (dto.creativeCode) {
      const creative = await this.prisma.creative.findFirst({
        where: { tenantId: context.tenantId, code: dto.creativeCode },
        select: { id: true },
      });
      if (!creative) throw new NotFoundException(`No creative registered as ${dto.creativeCode}`);
      creativeId = creative.id;
    }

    const row = await this.prisma.creativeStrategyEntry.create({
      data: {
        tenantId: context.tenantId,
        date: this.toDate(dto.date ?? this.manilaToday()),
        title: dto.title,
        description: dto.description || null,
        tag: dto.tag || 'OTHER',
        creativeId,
        createdById: context.userId,
        source: CreativeStrategySource.MANUAL,
      },
      select: ENTRY_SELECT,
    });
    return this.serialize(row, context.userId);
  }

  async recordResult(actor: CreativeActor, entryId: string, dto: UpdateStrategyResultDto) {
    const context = await this.access.resolve(actor);
    this.access.requireReadable(context);

    const existing = await this.prisma.creativeStrategyEntry.findFirst({
      where: { id: entryId, tenantId: context.tenantId },
      select: { createdById: true },
    });
    if (!existing) throw new NotFoundException('Strategy entry not found');
    if (existing.createdById !== context.userId) {
      throw new ForbiddenException('You can only record the outcome of your own entries');
    }

    const result = dto.result?.trim() || null;
    const row = await this.prisma.creativeStrategyEntry.update({
      where: { id: entryId },
      data: { result, resultUpdatedAt: result ? new Date() : null },
      select: ENTRY_SELECT,
    });
    return this.serialize(row, context.userId);
  }

  async remove(actor: CreativeActor, entryId: string) {
    const context = await this.access.resolve(actor);
    this.access.requireReadable(context);

    const deleted = await this.prisma.creativeStrategyEntry.deleteMany({
      where: { id: entryId, tenantId: context.tenantId, createdById: context.userId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Strategy entry not found, or it belongs to someone else');
    }
    return { ok: true };
  }

  /**
   * The log as the AI reads it — the same scoping as the queue, so the analysis
   * only ever cites moves the reader can actually see. Entries with a recorded
   * result come first in each line because that pairing is the whole point:
   * the model can tie an angle change to what it did to the numbers.
   */
  async contextForAi(tenantId: string, userId: string, canReadAll: boolean): Promise<string[]> {
    const since = new Date(Date.now() - AI_CONTEXT_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.creativeStrategyEntry.findMany({
      where: {
        tenantId,
        date: { gte: since },
        ...(canReadAll ? {} : { createdById: userId }),
      },
      select: { date: true, title: true, description: true, tag: true, result: true, creative: { select: { code: true } } },
      orderBy: { date: 'desc' },
      take: 40,
    });
    return rows.map((row) => [
      `${row.date.toISOString().slice(0, 10)} · ${row.tag}${row.creative?.code ? ` · ${row.creative.code}` : ''}: ${row.title}`,
      row.description ? `  detail: ${row.description.replace(/\s+/g, ' ').slice(0, 200)}` : null,
      row.result ? `  RESULT: ${row.result.replace(/\s+/g, ' ').slice(0, 300)}` : '  RESULT: (not recorded yet)',
    ].filter(Boolean).join('\n'));
  }
}
