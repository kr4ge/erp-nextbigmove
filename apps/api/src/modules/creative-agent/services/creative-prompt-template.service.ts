import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreativeAiPromptKind } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import { PROMPT_KINDS, systemAppendix, type CreativeAnalysisMode } from '../prompts/creative-prompt-router';
import { extractTokens, unknownTokens } from '../prompts/creative-prompt-template';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';

/** The longest prompt body accepted. Generous, but a bound. */
const MAX_BODY_CHARS = 60_000;

/**
 * Versioned analysis prompts.
 *
 * Every save is a new version and the old ones stay. Each run records the
 * version that judged it, so an old analysis can always be read against the
 * exact words the model was given, and a wording change that hurt can be rolled
 * back by re-activating the version before it. No active version means the
 * built-in default runs.
 */
@Injectable()
export class CreativePromptTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
  ) {}

  /** The body a run should use right now, and where it came from. */
  async resolve(tenantId: string, kind: CreativeAnalysisMode) {
    const active = await this.prisma.creativeAiPromptTemplate.findFirst({
      where: { tenantId, kind: kind as CreativeAiPromptKind, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (active) {
      return { body: active.body, templateId: active.id, version: active.version, isDefault: false };
    }
    const definition = PROMPT_KINDS[kind];
    return { body: definition.defaultBody, templateId: null, version: definition.defaultVersion, isDefault: true };
  }

  /** Both prompts as the settings page shows them. */
  async describeAll(tenantId: string) {
    const [runningAnalyst, newReviewer] = await Promise.all([
      this.describe(tenantId, 'RUNNING_ANALYST'),
      this.describe(tenantId, 'NEW_REVIEWER'),
    ]);
    return { runningAnalyst, newReviewer };
  }

  async describe(tenantId: string, kind: CreativeAnalysisMode) {
    const definition = PROMPT_KINDS[kind];
    const active = await this.prisma.creativeAiPromptTemplate.findFirst({
      where: { tenantId, kind: kind as CreativeAiPromptKind, isActive: true },
      orderBy: { version: 'desc' },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    const latest = await this.prisma.creativeAiPromptTemplate.aggregate({
      where: { tenantId, kind: kind as CreativeAiPromptKind },
      _max: { version: true },
    });
    const body = active?.body ?? definition.defaultBody;
    return {
      kind,
      label: definition.label,
      purpose: definition.purpose,
      body,
      isDefault: !active,
      version: active?.version ?? null,
      latestVersion: latest._max.version ?? 0,
      note: active?.note ?? null,
      updatedAt: active?.createdAt ?? null,
      updatedBy: active?.createdBy ? `${active.createdBy.firstName} ${active.createdBy.lastName}`.trim() : null,
      variables: definition.variables,
      usedTokens: extractTokens(body),
      unknownTokens: unknownTokens(body, definition.variables),
      /** What the system appends after the text, so the editor can see it. */
      appendix: systemAppendix(kind, 'VIDEO'),
      defaultBody: definition.defaultBody,
    };
  }

  /** Every saved version, newest first. */
  async versions(actor: CreativeActor, kind: CreativeAnalysisMode) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_USE, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE);
    const rows = await this.prisma.creativeAiPromptTemplate.findMany({
      where: { tenantId: context.tenantId, kind: kind as CreativeAiPromptKind },
      orderBy: { version: 'desc' },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      note: row.note,
      isActive: row.isActive,
      characters: row.body.length,
      createdAt: row.createdAt,
      createdBy: row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}`.trim() : null,
    }));
  }

  /** Save an edit as a new version and make it the one that runs. */
  async update(actor: CreativeActor, kind: CreativeAnalysisMode, input: { body: string; note?: string }) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE);

    const body = input.body.replace(/\r\n/g, '\n').trim();
    if (!body) throw new BadRequestException('The prompt cannot be empty. Use "Reset to default" to go back to the built-in text.');
    if (body.length > MAX_BODY_CHARS) {
      throw new BadRequestException(`The prompt is ${body.length} characters; the limit is ${MAX_BODY_CHARS}.`);
    }
    const unknown = unknownTokens(body, PROMPT_KINDS[kind].variables);

    const saved = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.creativeAiPromptTemplate.aggregate({
        where: { tenantId: context.tenantId, kind: kind as CreativeAiPromptKind },
        _max: { version: true },
      });
      await tx.creativeAiPromptTemplate.updateMany({
        where: { tenantId: context.tenantId, kind: kind as CreativeAiPromptKind, isActive: true },
        data: { isActive: false },
      });
      const row = await tx.creativeAiPromptTemplate.create({
        data: {
          tenantId: context.tenantId,
          kind: kind as CreativeAiPromptKind,
          version: (latest._max.version ?? 0) + 1,
          body,
          note: input.note?.trim() || null,
          isActive: true,
          createdById: context.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.ai.prompt.update',
          resource: 'CreativeAiPromptTemplate',
          resourceId: row.id,
          changes: { kind, version: row.version, characters: body.length, unknownTokens: unknown },
        },
      });
      return row;
    });

    return { ...(await this.describe(context.tenantId, kind)), savedVersion: saved.version, unknownTokens: unknown };
  }

  /** Stop using any saved version; the built-in default runs again. */
  async reset(actor: CreativeActor, kind: CreativeAnalysisMode) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE);
    await this.prisma.$transaction([
      this.prisma.creativeAiPromptTemplate.updateMany({
        where: { tenantId: context.tenantId, kind: kind as CreativeAiPromptKind, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.ai.prompt.reset',
          resource: 'CreativeAiPromptTemplate',
          resourceId: kind,
          changes: { kind },
        },
      }),
    ]);
    return this.describe(context.tenantId, kind);
  }

  /** Roll back to an earlier saved version. */
  async activate(actor: CreativeActor, kind: CreativeAnalysisMode, version: number) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE);
    const target = await this.prisma.creativeAiPromptTemplate.findUnique({
      where: { tenantId_kind_version: { tenantId: context.tenantId, kind: kind as CreativeAiPromptKind, version } },
    });
    if (!target) throw new NotFoundException(`Version ${version} does not exist for this prompt.`);
    await this.prisma.$transaction([
      this.prisma.creativeAiPromptTemplate.updateMany({
        where: { tenantId: context.tenantId, kind: kind as CreativeAiPromptKind, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.creativeAiPromptTemplate.update({ where: { id: target.id }, data: { isActive: true } }),
      this.prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.ai.prompt.activate',
          resource: 'CreativeAiPromptTemplate',
          resourceId: target.id,
          changes: { kind, version },
        },
      }),
    ]);
    return this.describe(context.tenantId, kind);
  }
}

export function isPromptKind(value: string): value is CreativeAnalysisMode {
  return value === 'RUNNING_ANALYST' || value === 'NEW_REVIEWER';
}
