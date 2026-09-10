import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { access, writeFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ClaudeboxClientService } from './claudebox-client.service';
import { CreativeAiContextService } from './creative-ai-context.service';
import { CreativeAiMediaService } from './creative-ai-media.service';

@Injectable()
export class CreativeAiAnalyzerService {
  private readonly logger = new Logger(CreativeAiAnalyzerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: CreativeAiMediaService,
    private readonly contextBuilder: CreativeAiContextService,
    private readonly claudebox: ClaudeboxClientService,
  ) {}

  async analyze(tenantId: string, runId: string) {
    if (process.env.AI_AGENT_ENABLED !== 'true') {
      throw new Error('Creative AI is disabled');
    }
    const run = await this.prisma.creativeAiRun.findFirst({
      where: { id: runId, tenantId },
      select: {
        id: true,
        tenantId: true,
        requestedById: true,
        sourcePath: true,
        status: true,
        provider: true,
        model: true,
        effort: true,
        settingsSnapshot: true,
      },
    });
    if (!run) throw new Error('Creative AI run was not found in its tenant');
    if (!run.sourcePath) throw new Error('Creative AI run has no source video');
    if (run.status === 'CANCELLED' || run.status === 'COMPLETED') return;

    const root = resolve(process.env.CREATIVE_AI_WORKSPACE_ROOT || join(process.cwd(), 'tmp', 'creative-ai'));
    const sourcePath = resolve(root, run.sourcePath);
    if (!sourcePath.startsWith(`${root}${sep}`)) throw new Error('Creative AI source path escaped its workspace');
    await access(sourcePath);
    const workspace = dirname(sourcePath);

    try {
      await this.setStage(tenantId, runId, 'PREPROCESSING', 10, 'Reading video and extracting frames', {
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      });
      const mediaManifest = await this.media.preprocess(workspace, sourcePath);
      await this.setStage(tenantId, runId, 'CONTEXT_BUILDING', 55, 'Loading linked ad and order performance', {
        mediaManifest: mediaManifest as Prisma.InputJsonValue,
        warnings: mediaManifest.warnings,
      });

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

      const output = await this.claudebox.run({
        tenantId,
        userId: run.requestedById,
        runId,
        workspace: `/workspace/${tenantId}/${runId}`,
        prompt: this.buildPrompt(),
        provider: run.provider,
        model: run.model,
        effort: run.effort,
        maxTurns: this.settingNumber(run.settingsSnapshot, 'maxTurns', 12),
        maxBudgetUsd: this.settingNumber(run.settingsSnapshot, 'maxBudgetUsd', 1),
      });
      const result = this.parseResult(output.result);
      await this.prisma.$transaction(async (tx) => {
        await tx.creativeAiRun.update({
          where: { id: runId },
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
        await tx.auditLog.create({
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
      });
      this.logger.log(`Completed creative AI analysis tenant=${tenantId} run=${runId}`);
    } catch (error) {
      const message = this.errorMessage(error);
      await this.prisma.creativeAiRun.updateMany({
        where: { id: runId, tenantId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        data: {
          status: 'FAILED',
          stage: 'Analysis failed',
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      throw error;
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
      where: { id: runId, tenantId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      data: { ...data, status, progress, stage },
    });
    if (updated.count !== 1) throw new Error('Creative AI run is no longer available for processing');
  }

  private buildPrompt() {
    return [
      'Analyze this registered advertising creative using only the files in the current run directory.',
      'First read analysis-context.json and video-timeline.json. Then inspect every JPG listed in video-timeline.json with the Read tool.',
      'Evaluate the opening hook, visual clarity, pacing, on-screen message, product demonstration, credibility, offer, and call to action.',
      'Connect visual observations to the measured Meta and reconciled-order metrics, but do not claim causation. Label inferences as hypotheses.',
      'Every visual claim must cite the nearest timestampSeconds from the manifest. Never invent dialogue; if transcription is unavailable, use the registered script only and state that limitation.',
      'Do not expose tenant IDs, user IDs, file paths, or internal implementation details in the answer.',
      'Recommend concrete edits and measurable A/B tests. Preserve null/unmeasured metrics as unknown, never as zero.',
      'Return only the JSON object required by the supplied schema.',
    ].join('\n');
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
