import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Prisma } from '@prisma/client';
import { Queue } from 'bull';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { copyFile, mkdir, rename, unlink } from 'fs/promises';
import { extname, join, relative, resolve, sep } from 'path';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CREATIVE_AGENT_PERMISSIONS,
  CREATIVE_AI_ANALYZE_JOB,
  CREATIVE_AI_QUEUE,
  type CreativeAiAnalyzeJobData,
} from '../creative-agent.constants';
import { ListCreativeAiRunsQueryDto, StartCreativeAiRunDto } from '../dto/creative-ai-run.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';
import { CreativeAiPolicyService } from './creative-ai-policy.service';

type UploadedVideoFile = {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class CreativeAiRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly policy: CreativeAiPolicyService,
    @InjectQueue(CREATIVE_AI_QUEUE) private readonly queue: Queue<CreativeAiAnalyzeJobData>,
  ) {}

  async start(actor: CreativeActor, dto: StartCreativeAiRunDto, video?: UploadedVideoFile) {
    try {
      if (process.env.AI_AGENT_ENABLED !== 'true') {
        throw new ServiceUnavailableException('Creative AI is disabled. Set AI_AGENT_ENABLED=true for local testing.');
      }
      if (!video?.path) {
        throw new BadRequestException('A local video file is required');
      }

      const context = await this.access.resolve(actor);
      this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_USE);
      const settings = await this.policy.resolveRunSettings(context, dto);
      const creative = await this.prisma.creative.findFirst({
        where: { id: dto.creativeId, tenantId: context.tenantId },
        select: { id: true, createdById: true, title: true, code: true, kind: true },
      });
      if (!creative) throw new NotFoundException('Creative not found');
      if (creative.kind !== 'VIDEO') {
        throw new BadRequestException('Video analysis can only be run for a VIDEO creative');
      }
      if (!this.access.canReadAll(context) && creative.createdById !== context.userId) {
        throw new ForbiddenException('You can only analyze your own creatives');
      }

      const range = this.resolveDateRange(dto.startDate, dto.endDate);
      const run = await this.prisma.creativeAiRun.create({
        data: {
          tenantId: context.tenantId,
          creativeId: creative.id,
          requestedById: context.userId,
          sourceType: 'LOCAL_UPLOAD',
          sourceFileName: this.safeFileName(video.originalname),
          sourceContentType: video.mimetype,
          sourceByteSize: video.size,
          question: dto.question?.trim() || null,
          dateStart: range.start,
          dateEnd: range.end,
          provider: settings.provider,
          model: settings.model,
          effort: settings.effort,
          settingsSnapshot: settings as unknown as Prisma.InputJsonValue,
        },
      });

      try {
        const stored = await this.persistUpload(video.path, context.tenantId, run.id, video.originalname);
        // Commit every input the worker needs before publishing the queue job. A local
        // worker can otherwise reserve the job before sourcePath is visible in Postgres.
        await this.prisma.creativeAiRun.update({
          where: { id: run.id },
          data: {
            sourcePath: stored.relativePath,
            mediaHash: stored.sha256,
          },
        });

        const queuedJob = await this.queue.add(CREATIVE_AI_ANALYZE_JOB, {
          tenantId: context.tenantId,
          runId: run.id,
        }, {
          attempts: this.positiveInt(process.env.CREATIVE_AI_QUEUE_ATTEMPTS, 2),
          backoff: {
            type: 'exponential',
            delay: this.positiveInt(process.env.CREATIVE_AI_QUEUE_BACKOFF_MS, 3000),
          },
          timeout: this.positiveInt(process.env.CREATIVE_AI_RUN_TIMEOUT_MS, 10 * 60 * 1000),
          removeOnComplete: 100,
          removeOnFail: 200,
        });

        const updated = await this.prisma.$transaction(async (tx) => {
          const saved = await tx.creativeAiRun.update({
            where: { id: run.id },
            data: {
              queueJobId: String(queuedJob.id),
            },
            include: this.detailInclude(),
          });
          await tx.auditLog.create({
            data: {
              tenantId: context.tenantId,
              userId: context.userId,
              action: 'creative.ai.run.create',
              resource: 'CreativeAiRun',
              resourceId: run.id,
              changes: {
                creativeId: creative.id,
                dateStart: range.start.toISOString().slice(0, 10),
                dateEnd: range.end.toISOString().slice(0, 10),
                sourceType: 'LOCAL_UPLOAD',
                provider: settings.provider,
                model: settings.model,
                effort: settings.effort,
              },
            },
          });
          return saved;
        });
        return this.serialize(updated);
      } catch (error) {
        await this.prisma.creativeAiRun.update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            stage: 'Could not queue analysis',
            errorMessage: this.errorMessage(error),
            completedAt: new Date(),
          },
        }).catch(() => undefined);
        throw error;
      }
    } finally {
      if (video?.path) {
        await unlink(video.path).catch(() => undefined);
      }
    }
  }

  async list(actor: CreativeActor, query: ListCreativeAiRunsQueryDto) {
    const context = await this.access.resolve(actor);
    this.access.require(
      context,
      CREATIVE_AGENT_PERMISSIONS.AI_USE,
      CREATIVE_AGENT_PERMISSIONS.AI_MANAGE,
    );
    const where = {
      tenantId: context.tenantId,
      ...(query.creativeId ? { creativeId: query.creativeId } : {}),
      ...(!this.access.canReadAll(context)
        ? { creative: { is: { createdById: context.userId } } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.creativeAiRun.findMany({
        where,
        include: this.detailInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.creativeAiRun.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serialize(item)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async get(actor: CreativeActor, runId: string) {
    const context = await this.access.resolve(actor);
    this.access.require(
      context,
      CREATIVE_AGENT_PERMISSIONS.AI_USE,
      CREATIVE_AGENT_PERMISSIONS.AI_MANAGE,
    );
    const run = await this.prisma.creativeAiRun.findFirst({
      where: { id: runId, tenantId: context.tenantId },
      include: this.detailInclude(),
    });
    if (!run) throw new NotFoundException('Creative AI run not found');
    if (!this.access.canReadAll(context) && run.creative.createdById !== context.userId) {
      throw new ForbiddenException('You can only view analyses for your own creatives');
    }
    return this.serialize(run);
  }

  private detailInclude() {
    return {
      creative: {
        select: {
          id: true,
          code: true,
          title: true,
          kind: true,
          createdById: true,
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          storeConfig: { select: { storeId: true, storeNameSnapshot: true } },
        },
      },
      requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    } as const;
  }

  private serialize(run: any) {
    const personName = (person: any) =>
      [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim() || person?.email || 'Unknown';
    return {
      id: run.id,
      status: run.status,
      progress: run.progress,
      stage: run.stage,
      creative: {
        id: run.creative.id,
        code: run.creative.code,
        title: run.creative.title,
        kind: run.creative.kind,
        creator: { id: run.creative.createdBy.id, name: personName(run.creative.createdBy) },
        store: {
          id: run.creative.storeConfig.storeId,
          name: run.creative.storeConfig.storeNameSnapshot,
        },
      },
      requestedBy: { id: run.requestedBy.id, name: personName(run.requestedBy) },
      source: {
        type: run.sourceType,
        fileName: run.sourceFileName,
        contentType: run.sourceContentType,
        byteSize: run.sourceByteSize,
      },
      question: run.question,
      ai: {
        provider: run.provider,
        model: run.model,
        effort: run.effort,
      },
      dateRange: {
        startDate: this.dateOnly(run.dateStart),
        endDate: this.dateOnly(run.dateEnd),
      },
      mediaHash: run.mediaHash,
      mediaManifest: run.mediaManifest,
      metricsSnapshot: run.metricsSnapshot,
      result: run.analysisResult,
      responseText: run.responseText,
      warnings: run.warnings,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }

  private resolveDateRange(startDate?: string, endDate?: string) {
    const today = new Date();
    const end = endDate ? this.parseDate(endDate, 'endDate') : this.utcDate(today);
    const defaultStart = new Date(end);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);
    const start = startDate ? this.parseDate(startDate, 'startDate') : defaultStart;
    if (start > end) throw new BadRequestException('startDate must not be after endDate');
    const maxRangeStart = new Date(end);
    maxRangeStart.setUTCDate(maxRangeStart.getUTCDate() - 365);
    if (start < maxRangeStart) throw new BadRequestException('Creative AI supports a maximum 366-day date range');
    return { start, end };
  }

  private parseDate(value: string, field: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} is invalid`);
    return date;
  }

  private utcDate(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private dateOnly(value: Date | string) {
    return new Date(value).toISOString().slice(0, 10);
  }

  private workspaceRoot() {
    return resolve(process.env.CREATIVE_AI_WORKSPACE_ROOT || join(process.cwd(), 'tmp', 'creative-ai'));
  }

  private async persistUpload(tempPath: string, tenantId: string, runId: string, originalName: string) {
    const root = this.workspaceRoot();
    const directory = resolve(root, tenantId, runId);
    if (!directory.startsWith(`${root}${sep}`)) throw new BadRequestException('Invalid analysis workspace');
    await mkdir(directory, { recursive: true });
    const extension = extname(originalName || '').toLowerCase() || '.video';
    const target = join(directory, `source${extension}`);
    try {
      await rename(tempPath, target);
    } catch (error: any) {
      if (error?.code !== 'EXDEV') throw error;
      await copyFile(tempPath, target);
      await unlink(tempPath);
    }
    return {
      relativePath: relative(root, target),
      sha256: await this.sha256(target),
    };
  }

  private sha256(path: string) {
    return new Promise<string>((resolveHash, reject) => {
      const hash = createHash('sha256');
      const input = createReadStream(path);
      input.on('error', reject);
      input.on('data', (chunk) => hash.update(chunk));
      input.on('end', () => resolveHash(hash.digest('hex')));
    });
  }

  private safeFileName(value: string) {
    return (value || 'video').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 255);
  }

  private positiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private errorMessage(error: unknown) {
    return (error instanceof Error ? error.message : String(error)).slice(0, 2000);
  }
}
