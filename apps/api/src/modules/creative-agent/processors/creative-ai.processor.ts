import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  CREATIVE_AI_ANALYZE_JOB,
  CREATIVE_AI_QUEUE,
  type CreativeAiAnalyzeJobData,
} from '../creative-agent.constants';
import { CreativeAiAnalyzerService } from '../services/creative-ai-analyzer.service';

const configuredConcurrency = Number(process.env.CREATIVE_AI_QUEUE_CONCURRENCY || '1');
const concurrency = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
  ? Math.floor(configuredConcurrency)
  : 1;

@Processor(CREATIVE_AI_QUEUE)
export class CreativeAiProcessor {
  private readonly logger = new Logger(CreativeAiProcessor.name);

  constructor(private readonly analyzer: CreativeAiAnalyzerService) {}

  @Process({ name: CREATIVE_AI_ANALYZE_JOB, concurrency })
  async analyze(job: Job<CreativeAiAnalyzeJobData>) {
    this.logger.log(`Starting creative AI run=${job.data.runId} tenant=${job.data.tenantId}`);
    await this.analyzer.analyze(job.data.tenantId, job.data.runId);
  }

  @OnQueueFailed()
  onFailed(job: Job<CreativeAiAnalyzeJobData>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Creative AI failed run=${job?.data?.runId || 'n/a'} tenant=${job?.data?.tenantId || 'n/a'} attempts=${job?.attemptsMade || 0}/${job?.opts?.attempts || 1}: ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}
