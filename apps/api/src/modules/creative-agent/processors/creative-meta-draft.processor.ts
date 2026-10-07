import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  CREATIVE_META_DRAFT_BUILD_JOB,
  CREATIVE_META_DRAFT_QUEUE,
  CREATIVE_META_DRAFT_RELEASE_JOB,
  CREATIVE_META_DRAFT_UPLOAD_JOB,
  type CreativeMetaDraftBuildJobData,
  type CreativeMetaDraftReleaseJobData,
  type CreativeMetaDraftUploadJobData,
} from '../creative-agent.constants';
import { CreativeMetaDraftService } from '../services/creative-meta-draft.service';

const configured = Number(process.env.CREATIVE_META_DRAFT_CONCURRENCY || '2');
const concurrency = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 2;

/**
 * Worker for the Meta draft queue. Low concurrency on purpose: Meta rate-limits
 * per ad account, and twenty uploads at once earn a throttle that stalls every
 * tenant behind it. The queue's limiter caps throughput on top of this.
 */
@Processor(CREATIVE_META_DRAFT_QUEUE)
export class CreativeMetaDraftProcessor {
  private readonly logger = new Logger(CreativeMetaDraftProcessor.name);

  constructor(private readonly drafts: CreativeMetaDraftService) {}

  @Process({ name: CREATIVE_META_DRAFT_UPLOAD_JOB, concurrency })
  async upload(job: Job<CreativeMetaDraftUploadJobData>) {
    const attempts = Math.max(1, Number(job.opts?.attempts) || 1);
    const attempt = (job.attemptsMade || 0) + 1;
    this.logger.log(`Uploading media for draft=${job.data.draftId} tenant=${job.data.tenantId} attempt=${attempt}/${attempts}`);
    await this.drafts.processUpload(job.data.tenantId, job.data.draftId, { finalAttempt: attempt >= attempts });
  }

  @Process({ name: CREATIVE_META_DRAFT_BUILD_JOB, concurrency: 1 })
  async build(job: Job<CreativeMetaDraftBuildJobData>) {
    const attempts = Math.max(1, Number(job.opts?.attempts) || 1);
    const attempt = (job.attemptsMade || 0) + 1;
    this.logger.log(`Building campaign for batch=${job.data.batchId} tenant=${job.data.tenantId} attempt=${attempt}/${attempts}`);
    await this.drafts.processBuild(job.data.tenantId, job.data.batchId, { finalAttempt: attempt >= attempts });
  }

  @Process({ name: CREATIVE_META_DRAFT_RELEASE_JOB, concurrency })
  async release(job: Job<CreativeMetaDraftReleaseJobData>) {
    await this.drafts.processRelease(job.data.tenantId, job.data.creativeId);
  }

  @OnQueueFailed()
  onFailed(job: Job<Record<string, string>>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Meta draft job failed job=${job?.name || 'n/a'} id=${job?.data?.draftId || job?.data?.batchId || job?.data?.creativeId || 'n/a'} tenant=${job?.data?.tenantId || 'n/a'} attempts=${job?.attemptsMade || 0}/${job?.opts?.attempts || 1}: ${message}`,
    );
  }
}
