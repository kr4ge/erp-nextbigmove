import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  CREATIVE_AI_ANALYZE_JOB,
  CREATIVE_AI_QUEUE,
  CREATIVE_GATE_REVIEW_JOB,
  type CreativeAiAnalyzeJobData,
  type CreativeGateReviewJobData,
} from '../creative-agent.constants';
import { CreativeAiAnalyzerService } from '../services/creative-ai-analyzer.service';
import { CreativeEnrollmentReviewService } from '../services/creative-enrollment-review.service';

const configuredConcurrency = Number(process.env.CREATIVE_AI_QUEUE_CONCURRENCY || '1');
const concurrency = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
  ? Math.floor(configuredConcurrency)
  : 1;

@Processor(CREATIVE_AI_QUEUE)
export class CreativeAiProcessor {
  private readonly logger = new Logger(CreativeAiProcessor.name);

  constructor(
    private readonly analyzer: CreativeAiAnalyzerService,
    private readonly reviews: CreativeEnrollmentReviewService,
  ) {}

  @Process({ name: CREATIVE_AI_ANALYZE_JOB, concurrency })
  async analyze(job: Job<CreativeAiAnalyzeJobData>) {
    const attempts = Math.max(1, Number(job.opts?.attempts) || 1);
    const attempt = (job.attemptsMade || 0) + 1;
    this.logger.log(`Starting creative AI run=${job.data.runId} tenant=${job.data.tenantId} attempt=${attempt}/${attempts}`);
    // Only the last attempt may close the run as FAILED; an earlier failure
    // leaves it in progress so the retry resumes from its checkpoints.
    await this.analyzer.analyze(job.data.tenantId, job.data.runId, { finalAttempt: attempt >= attempts });
  }

  @Process({ name: CREATIVE_GATE_REVIEW_JOB, concurrency })
  async gateReview(job: Job<CreativeGateReviewJobData>) {
    this.logger.log(`Starting gate review=${job.data.reviewId} tenant=${job.data.tenantId}`);
    await this.reviews.execute(job.data.tenantId, job.data.reviewId);
  }

  @OnQueueFailed()
  onFailed(job: Job<CreativeAiAnalyzeJobData & CreativeGateReviewJobData>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Creative AI failed job=${job?.name || 'n/a'} run=${job?.data?.runId || job?.data?.reviewId || 'n/a'} tenant=${job?.data?.tenantId || 'n/a'} attempts=${job?.attemptsMade || 0}/${job?.opts?.attempts || 1}: ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}
