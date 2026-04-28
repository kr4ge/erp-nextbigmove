import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { WorkflowService } from '../workflow.service';
import {
  MANUAL_META_UPLOAD_JOB,
  MANUAL_META_UPLOAD_QUEUE,
  type ManualMetaUploadJobData,
} from '../workflow.constants';

const parsedConcurrency = Number(process.env.MANUAL_META_UPLOAD_CONCURRENCY || '1');
const jobConcurrency = Number.isFinite(parsedConcurrency) && parsedConcurrency > 0
  ? Math.floor(parsedConcurrency)
  : 1;

@Processor(MANUAL_META_UPLOAD_QUEUE)
export class ManualMetaUploadProcessor {
  private readonly logger = new Logger(ManualMetaUploadProcessor.name);

  constructor(private readonly workflowService: WorkflowService) {}

  @Process({ name: MANUAL_META_UPLOAD_JOB, concurrency: jobConcurrency })
  async handleUpload(job: Job<ManualMetaUploadJobData>) {
    this.logger.log(
      `Processing manual meta upload job ${job.id} tenant=${job.data.tenantId} file=${job.data.originalFileName}`,
    );

    const result = await this.workflowService.processManualMetaUploadJob(job);

    this.logger.log(
      `Completed manual meta upload job ${job.id} rows=${result.rowsReceived} insights=${result.insightsUpserted}`,
    );

    return result;
  }

  @OnQueueFailed()
  onFailed(job: Job<ManualMetaUploadJobData>, error: any) {
    this.logger.error(
      `Manual meta upload job failed job=${job?.id} tenant=${job?.data?.tenantId || 'n/a'} file=${job?.data?.originalFileName || 'n/a'}: ${error?.message || 'Unknown error'}`,
      error?.stack,
    );
  }
}

