import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bull';
import { readdir, rm, stat, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AI_QUEUE, type CreativeAiAnalyzeJobData } from '../creative-agent.constants';
import { creativeAiJobTimeoutMs, creativeAiStaleRunGraceMs } from '../utils/creative-ai-timeouts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IN_PROGRESS = ['PREPROCESSING', 'CONTEXT_BUILDING', 'ANALYZING'] as const;
const TERMINAL = ['COMPLETED', 'FAILED', 'CANCELLED'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Housekeeping for Creative AI, registered only in the worker role:
 *  - closes runs that stopped reporting progress (a worker restart mid-run
 *    would otherwise leave them "Analyzing" forever);
 *  - closes queued runs whose queue job no longer exists;
 *  - removes source videos and, after the retention window, the whole run
 *    workspace, so the disk does not fill up with 60 MB uploads.
 */
@Injectable()
export class CreativeAiMaintenanceService {
  private readonly logger = new Logger(CreativeAiMaintenanceService.name);
  private sweeping = false;
  private purging = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CREATIVE_AI_QUEUE) private readonly queue: Queue<CreativeAiAnalyzeJobData>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepStaleRuns() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const silentSince = new Date(Date.now() - creativeAiJobTimeoutMs() - creativeAiStaleRunGraceMs());
      const stuck = await this.prisma.creativeAiRun.findMany({
        where: { status: { in: [...IN_PROGRESS] }, updatedAt: { lt: silentSince } },
        select: { id: true, tenantId: true, status: true },
      });
      for (const run of stuck) {
        const closed = await this.prisma.creativeAiRun.updateMany({
          where: { id: run.id, tenantId: run.tenantId, status: { in: [...IN_PROGRESS] } },
          data: {
            status: 'FAILED',
            stage: 'Analysis stopped responding',
            errorMessage: 'The analysis stopped responding and was closed automatically. Start it again.',
            completedAt: new Date(),
          },
        });
        if (closed.count === 1) {
          this.logger.warn(`Closed unresponsive creative AI run tenant=${run.tenantId} run=${run.id} lastStatus=${run.status}`);
        }
      }

      const queuedSince = new Date(Date.now() - 60 * 60 * 1000);
      const queued = await this.prisma.creativeAiRun.findMany({
        where: { status: 'QUEUED', createdAt: { lt: queuedSince } },
        select: { id: true, tenantId: true, queueJobId: true },
      });
      for (const run of queued) {
        if (await this.jobStillPending(run.queueJobId)) continue;
        const closed = await this.prisma.creativeAiRun.updateMany({
          where: { id: run.id, tenantId: run.tenantId, status: 'QUEUED' },
          data: {
            status: 'FAILED',
            stage: 'Analysis never started',
            errorMessage: 'The analysis was queued but never picked up by a worker. Start it again.',
            completedAt: new Date(),
          },
        });
        if (closed.count === 1) {
          this.logger.warn(`Closed orphaned queued creative AI run tenant=${run.tenantId} run=${run.id}`);
        }
      }
    } catch (error) {
      this.logger.error(`Creative AI stale-run sweep failed: ${this.message(error)}`);
    } finally {
      this.sweeping = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async purgeWorkspaces() {
    if (this.purging) return;
    this.purging = true;
    try {
      const root = this.workspaceRoot();
      const retentionMs = this.retentionDays() * DAY_MS;
      const retainSource = process.env.CREATIVE_AI_RETAIN_SOURCE_VIDEO?.trim().toLowerCase() === 'true';
      const now = Date.now();
      let removedRuns = 0;
      let removedSources = 0;

      const tenantDirs = await this.listDirectories(root);
      for (const tenantId of tenantDirs.filter((name) => UUID_PATTERN.test(name))) {
        const tenantRoot = join(root, tenantId);
        for (const runId of (await this.listDirectories(tenantRoot)).filter((name) => UUID_PATTERN.test(name))) {
          const runDirectory = join(tenantRoot, runId);
          const run = await this.prisma.creativeAiRun.findFirst({
            where: { id: runId, tenantId },
            select: { status: true, completedAt: true, updatedAt: true },
          });
          if (!run) {
            // No run row: an upload that failed before it was queued, or a
            // deleted run. Give it a day in case a request is still in flight.
            const info = await stat(runDirectory).catch(() => null);
            if (info && info.mtimeMs < now - DAY_MS) {
              await rm(runDirectory, { recursive: true, force: true });
              removedRuns += 1;
            }
            continue;
          }
          if (!(TERMINAL as readonly string[]).includes(run.status)) continue;
          const finishedAt = (run.completedAt ?? run.updatedAt).getTime();
          if (finishedAt < now - retentionMs) {
            await rm(runDirectory, { recursive: true, force: true });
            removedRuns += 1;
            continue;
          }
          if (!retainSource) {
            removedSources += await this.removeSourceFiles(runDirectory);
          }
        }
      }

      const removedUploads = await this.purgeStaleUploads(now);
      if (removedRuns || removedSources || removedUploads) {
        this.logger.log(
          `Creative AI workspace purge: removed ${removedRuns} run folder(s), ${removedSources} source video(s), ${removedUploads} stale upload(s)`,
        );
      }
    } catch (error) {
      this.logger.error(`Creative AI workspace purge failed: ${this.message(error)}`);
    } finally {
      this.purging = false;
    }
  }

  private async jobStillPending(queueJobId: string | null) {
    if (!queueJobId) return false;
    try {
      const job = await this.queue.getJob(queueJobId);
      if (!job) return false;
      const state = await job.getState();
      return state === 'waiting' || state === 'delayed' || state === 'active' || state === 'paused';
    } catch (error) {
      this.logger.warn(`Could not read queue job ${queueJobId}: ${this.message(error)}`);
      return true;
    }
  }

  private async removeSourceFiles(runDirectory: string) {
    let removed = 0;
    for (const name of await readdir(runDirectory).catch(() => [] as string[])) {
      if (!/^source\.[a-z0-9]+$/i.test(name)) continue;
      await unlink(join(runDirectory, name)).catch(() => undefined);
      removed += 1;
    }
    return removed;
  }

  private async purgeStaleUploads(now: number) {
    const uploadRoot = resolve(process.env.CREATIVE_AI_UPLOAD_TMP_DIR || join(process.cwd(), 'tmp', 'creative-ai-uploads'));
    let removed = 0;
    for (const name of await readdir(uploadRoot).catch(() => [] as string[])) {
      const path = join(uploadRoot, name);
      const info = await stat(path).catch(() => null);
      if (!info?.isFile() || info.mtimeMs > now - DAY_MS) continue;
      await unlink(path).catch(() => undefined);
      removed += 1;
    }
    return removed;
  }

  private async listDirectories(path: string) {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  private workspaceRoot() {
    return resolve(process.env.CREATIVE_AI_WORKSPACE_ROOT || join(process.cwd(), 'tmp', 'creative-ai'));
  }

  private retentionDays() {
    const value = Number(process.env.CREATIVE_AI_WORKSPACE_RETENTION_DAYS || 14);
    return Number.isFinite(value) && value > 0 ? value : 14;
  }

  private message(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
