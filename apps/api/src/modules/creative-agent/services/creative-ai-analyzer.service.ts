import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { access, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreativePromptContextService } from './creative-prompt-context.service';
import { ClaudeboxClientService, CreativeAiRunCancelledError, CreativeAiRunLimitError } from './claudebox-client.service';
import { CreativeAiContextService } from './creative-ai-context.service';
import { CreativeAiMediaService } from './creative-ai-media.service';

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'] as const;
const CANCEL_POLL_MS = 3_000;
// The model streams its answer token by token. Persisting every delta would
// write hundreds of times per run, so partial text is flushed on a timer and
// the dialog picks it up on its normal poll.
const PARTIAL_FLUSH_MS = 2_000;
const PARTIAL_MAX_CHARS = 200_000;

type MediaManifest = Awaited<ReturnType<CreativeAiMediaService['preprocess']>>;

/**
 * Runs one Creative AI analysis. Each stage is a checkpoint: a retried job
 * reuses frames that already exist, the model is called at most once per
 * completed run, and a cancellation recorded in the database stops the run
 * at the next stage boundary or aborts the model call in flight.
 */
@Injectable()
export class CreativeAiAnalyzerService {
  private readonly logger = new Logger(CreativeAiAnalyzerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: CreativeAiMediaService,
    private readonly contextBuilder: CreativeAiContextService,
    private readonly claudebox: ClaudeboxClientService,
    private readonly promptContext: CreativePromptContextService,
  ) {}

  async analyze(tenantId: string, runId: string, options: { finalAttempt?: boolean } = {}) {
    const finalAttempt = options.finalAttempt !== false;
    if (process.env.AI_AGENT_ENABLED !== 'true') {
      throw new Error('Creative AI is disabled');
    }
    const run = await this.prisma.creativeAiRun.findFirst({
      where: { id: runId, tenantId },
      select: {
        id: true,
        tenantId: true,
        requestedById: true,
        creativeId: true,
        sourcePath: true,
        status: true,
        provider: true,
        model: true,
        effort: true,
        settingsSnapshot: true,
        startedAt: true,
        creative: {
          select: {
            performanceStatus: true,
            kind: true,
            storeConfig: { select: { aiNiche: true, aiStoreRules: true } },
          },
        },
      },
    });
    if (!run) throw new Error('Creative AI run was not found in its tenant');
    if (run.status === 'CANCELLED' || run.status === 'COMPLETED' || run.status === 'FAILED') {
      this.logger.log(`Skipping creative AI run tenant=${tenantId} run=${runId} status=${run.status}`);
      return;
    }
    if (!run.sourcePath) throw new Error('Creative AI run has no source video');

    const root = resolve(process.env.CREATIVE_AI_WORKSPACE_ROOT || join(process.cwd(), 'tmp', 'creative-ai'));
    const sourcePath = resolve(root, run.sourcePath);
    if (!sourcePath.startsWith(`${root}${sep}`)) throw new Error('Creative AI source path escaped its workspace');
    const workspace = dirname(sourcePath);

    const abort = new AbortController();
    let cancelPoll: NodeJS.Timeout | undefined;

    try {
      // Stage 1: frames. Reuse a manifest left by an earlier attempt so a retry
      // never re-runs ffmpeg (and can proceed even after the source was removed).
      let mediaManifest = await this.existingManifest(workspace);
      if (mediaManifest) {
        await this.setStage(tenantId, runId, 'PREPROCESSING', 10, 'Reusing prepared video frames', {
          startedAt: run.startedAt ?? new Date(),
          completedAt: null,
          errorMessage: null,
        });
      } else {
        await this.setStage(tenantId, runId, 'PREPROCESSING', 10, 'Reading video and extracting frames', {
          startedAt: new Date(),
          completedAt: null,
          errorMessage: null,
        });
        await this.requireSource(sourcePath);
        mediaManifest = await this.media.preprocess(workspace, sourcePath, run.creative.kind);
        await this.discardSourceVideo(sourcePath);
      }
      await this.setStage(tenantId, runId, 'CONTEXT_BUILDING', 55, 'Loading linked ad and order performance', {
        mediaManifest: mediaManifest as Prisma.InputJsonValue,
        warnings: mediaManifest.warnings,
      });

      // Stage 2: performance context. Cheap, so it is always rebuilt.
      const analysisContext = await this.contextBuilder.build(tenantId, runId);
      await writeFile(
        join(workspace, 'analysis-context.json'),
        JSON.stringify(analysisContext, null, 2),
        'utf8',
      );
      await this.setStage(tenantId, runId, 'ANALYZING', 75, 'Analyzing visual evidence with performance data', {
        metricsSnapshot: analysisContext as Prisma.InputJsonValue,
        warnings: [...new Set([...mediaManifest.warnings, ...analysisContext.dataQuality.warnings])],
      });

      // Stage 3: the model. A cancel request written by the API is picked up
      // here and turned into a gateway-side process cancel.
      cancelPoll = setInterval(() => {
        void this.isCancelled(tenantId, runId).then((cancelled) => {
          if (cancelled) abort.abort();
        });
      }, CANCEL_POLL_MS);
      // Stream the answer into the run row so the dialog can show it forming
      // instead of a progress bar that sits still for minutes.
      // The activity feed is what the dialog shows while the model works: each
      // tool call and each thinking pause, in order, the way an agent console
      // does. It is stored as plain lines in responseText so no migration or
      // extra column is needed; the last line is the current step.
      const activity: string[] = [];
      let streamed = '';
      let pendingFlush = false;
      let lastFlushedLength = 0;
      const pushActivity = (line: string) => {
        if (activity[activity.length - 1] === line) return;
        activity.push(line);
        if (activity.length > 120) activity.shift();
        pendingFlush = true;
      };
      // Narration arrives as a growing string. Emitting the whole of it each
      // time would repeat every sentence, so only the newest one is appended,
      // interleaved with the tool steps in the order they happened.
      let narrationEmitted = 0;
      const renderProgress = (final = false) => {
        const pending = streamed.slice(narrationEmitted);
        // Only emit up to the last sentence boundary: a flush can land
        // mid-word, and half a sentence in the feed reads as a glitch.
        const boundary = Math.max(pending.lastIndexOf('. '), pending.lastIndexOf('! '), pending.lastIndexOf('? '));
        const upTo = final ? pending.length : boundary >= 0 ? boundary + 1 : 0;
        const narration = pending.slice(0, upTo).trim();
        if (narration) {
          narrationEmitted += upTo;
          pushActivity(narration);
        }
        return activity.join('\n').slice(0, PARTIAL_MAX_CHARS);
      };
      const flushPartial = async () => {
        pendingFlush = false;
        const text = renderProgress();
        if (text.length === lastFlushedLength) return;
        lastFlushedLength = text.length;
        await this.prisma.creativeAiRun.updateMany({
          where: { id: runId, tenantId, status: 'ANALYZING' },
          data: { responseText: text },
        }).catch(() => undefined);
      };
      const flushTimer = setInterval(() => {
        if (pendingFlush) void flushPartial();
      }, PARTIAL_FLUSH_MS);

      // Which prompt this creative gets is decided from its own measured
      // delivery, not from anyone choosing: a creative that has spent and been
      // seen is judged on what it earned, one that has not is judged on how it
      // is made.
      const built = await this.promptContext.build({
        tenantId,
        creativeId: run.creativeId,
        kind: run.creative.kind,
        signals: {
          linkedAdCount: analysisContext.attribution.linkedAdCount,
          spend: analysisContext.metrics.spend,
          impressions: analysisContext.metrics.impressions,
        },
        period: `${analysisContext.scope.dateStart} to ${analysisContext.scope.dateEnd}`,
      });
      await this.prisma.creativeAiRun.updateMany({
        where: { id: runId, tenantId },
        data: {
          analysisMode: built.mode,
          analysisModeNote: built.modeNote,
          promptTemplateId: built.promptTemplateId,
        },
      });

      const output = await this.claudebox.run({
        tenantId,
        userId: run.requestedById,
        runId,
        workspace: `/workspace/${tenantId}/${runId}`,
        prompt: built.prompt,
        jsonSchema: built.schema,
        provider: run.provider,
        model: run.model,
        effort: run.effort,
        maxTurns: this.settingNumber(run.settingsSnapshot, 'maxTurns', 12),
        maxRunMinutes: this.settingNumber(run.settingsSnapshot, 'maxRunMinutes', 15),
        // When the gateway runs on its own host it cannot see this directory,
        // so the prepared files are pushed to it over the socket. Set
        // CREATIVE_AI_SHARED_WORKSPACE=true only where both sides mount the
        // same volume.
        localWorkspace: process.env.CREATIVE_AI_SHARED_WORKSPACE?.trim().toLowerCase() === 'true'
          ? undefined
          : workspace,
        signal: abort.signal,
        onDelta: (delta) => {
          if (streamed.length < PARTIAL_MAX_CHARS) streamed += delta;
          pendingFlush = true;
        },
        onActivity: (entry) => {
          if (entry.kind === 'TOOL') {
            pushActivity(`@@TOOL|${entry.tool}|${entry.target ?? ''}`);
          } else if (entry.kind === 'THINKING') {
            pushActivity('@@THINKING|');
          }
        },
      }).finally(() => clearInterval(flushTimer));
      clearInterval(cancelPoll);
      cancelPoll = undefined;

      const result = this.parseResult(output.result);
      // One statement completes the run, so a failure after this point (for
      // example the audit write) can never lead a retry to call the model again.
      const completed = await this.prisma.creativeAiRun.updateMany({
        where: { id: runId, tenantId, status: { notIn: [...TERMINAL_STATUSES] } },
        data: {
          status: 'COMPLETED',
          progress: 100,
          stage: 'Analysis complete',
          analysisResult: {
            ...result,
            _run: {
              provider: run.provider,
              model: run.model,
              effort: run.effort,
              promptVersion: built.promptVersion,
              analysisMode: built.mode,
              lens: run.creative.performanceStatus,
              kind: run.creative.kind,
              niche: run.creative.storeConfig?.aiNiche ?? null,
              usage: output.usage,
              totalCostUsd: output.totalCostUsd,
            },
          } as Prisma.InputJsonValue,
          responseText: output.responseText,
          claudeSessionId: output.sessionId,
          completedAt: new Date(),
          errorMessage: null,
        },
      });
      if (completed.count !== 1) {
        this.logger.warn(`Creative AI run finished after it was cancelled tenant=${tenantId} run=${runId}`);
        return;
      }
      try {
        await this.prisma.auditLog.create({
          data: {
            tenantId,
            userId: run.requestedById,
            action: 'creative.ai.run.complete',
            resource: 'CreativeAiRun',
            resourceId: runId,
            changes: {
              provider: run.provider,
              model: run.model,
              effort: run.effort,
              totalCostUsd: output.totalCostUsd,
            },
          },
        });
      } catch (auditError) {
        this.logger.warn(`Creative AI audit entry failed run=${runId}: ${this.errorMessage(auditError)}`);
      }
      this.logger.log(`Completed creative AI analysis tenant=${tenantId} run=${runId}`);
    } catch (error) {
      if (cancelPoll) clearInterval(cancelPoll);
      if (error instanceof CreativeAiRunCancelledError || await this.isCancelled(tenantId, runId)) {
        this.logger.log(`Creative AI run cancelled tenant=${tenantId} run=${runId}`);
        return;
      }
      const message = this.errorMessage(error);
      // A cost or turn cap is deterministic: the retry would spend the same
      // amount and stop at the same place, so close the run now.
      const closeNow = finalAttempt || error instanceof CreativeAiRunLimitError;
      if (closeNow) {
        await this.prisma.creativeAiRun.updateMany({
          where: { id: runId, tenantId, status: { notIn: [...TERMINAL_STATUSES] } },
          data: {
            status: 'FAILED',
            stage: error instanceof CreativeAiRunLimitError ? 'Stopped at the run limit' : 'Analysis failed',
            errorMessage: message,
            completedAt: new Date(),
          },
        });
      } else {
        // The queue will retry; keep the run in progress so the retry resumes
        // from the existing frames instead of finding a closed run.
        await this.prisma.creativeAiRun.updateMany({
          where: { id: runId, tenantId, status: { notIn: [...TERMINAL_STATUSES] } },
          data: {
            stage: 'Retrying after an error',
            errorMessage: message,
          },
        });
        this.logger.warn(`Creative AI run will retry tenant=${tenantId} run=${runId}: ${message}`);
      }
      throw error;
    } finally {
      if (cancelPoll) clearInterval(cancelPoll);
    }
  }

  private async setStage(
    tenantId: string,
    runId: string,
    status: 'PREPROCESSING' | 'CONTEXT_BUILDING' | 'ANALYZING',
    progress: number,
    stage: string,
    data: Prisma.CreativeAiRunUpdateManyMutationInput = {},
  ) {
    const updated = await this.prisma.creativeAiRun.updateMany({
      where: { id: runId, tenantId, status: { notIn: [...TERMINAL_STATUSES] } },
      data: { ...data, status, progress, stage },
    });
    if (updated.count !== 1) throw new Error('Creative AI run is no longer available for processing');
  }

  private async isCancelled(tenantId: string, runId: string) {
    try {
      const current = await this.prisma.creativeAiRun.findFirst({
        where: { id: runId, tenantId },
        select: { status: true },
      });
      return !current || current.status === 'CANCELLED';
    } catch {
      return false;
    }
  }

  private async existingManifest(workspace: string): Promise<MediaManifest | null> {
    try {
      const parsed = JSON.parse(await readFile(join(workspace, 'video-timeline.json'), 'utf8'));
      if (!parsed || !Array.isArray(parsed.frames) || parsed.frames.length === 0) return null;
      if (!Array.isArray(parsed.warnings)) parsed.warnings = [];
      return parsed as MediaManifest;
    } catch {
      return null;
    }
  }

  private async requireSource(sourcePath: string) {
    try {
      await access(sourcePath);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new Error('The uploaded video is no longer available in the analysis workspace. Upload it again to start a new analysis.');
      }
      throw error;
    }
  }

  /**
   * The source video is only needed to extract frames. Its SHA-256 stays on
   * the run, so remove the file unless the operator asked to keep it.
   */
  private async discardSourceVideo(sourcePath: string) {
    if (process.env.CREATIVE_AI_RETAIN_SOURCE_VIDEO?.trim().toLowerCase() === 'true') return;
    try {
      await unlink(sourcePath);
    } catch (error) {
      this.logger.warn(`Could not remove source video ${sourcePath}: ${this.errorMessage(error)}`);
    }
  }

  private parseResult(value: string): Record<string, unknown> {
    try {
      return JSON.parse(value);
    } catch {
      const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
      if (fenced) {
        try {
          return JSON.parse(fenced);
        } catch {
          // Fall through to a stable error rather than persisting malformed JSON.
        }
      }
      throw new Error('Claudebox returned a result that did not match the structured analysis contract');
    }
  }

  private errorMessage(error: unknown) {
    return (error instanceof Error ? error.message : String(error)).slice(0, 2000);
  }

  private settingNumber(snapshot: unknown, key: string, fallback: number) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return fallback;
    const value = Number((snapshot as Record<string, unknown>)[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
