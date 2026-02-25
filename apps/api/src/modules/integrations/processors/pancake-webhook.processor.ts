import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { IntegrationService } from '../integration.service';
import {
  PANCAKE_WEBHOOK_JOB,
  PANCAKE_WEBHOOK_QUEUE,
  PancakeWebhookJobData,
} from '../pancake-webhook.constants';

@Processor(PANCAKE_WEBHOOK_QUEUE)
export class PancakeWebhookQueueProcessor {
  private readonly logger = new Logger(PancakeWebhookQueueProcessor.name);

  constructor(private readonly integrationService: IntegrationService) {}

  @Process(PANCAKE_WEBHOOK_JOB)
  async handleIngest(job: Job<PancakeWebhookJobData>) {
    const startedAt = Date.now();
    const { eventId, tenantId } = job.data;

    this.logger.debug(
      `Processing Pancake webhook job ${job.id} event=${eventId} tenant=${tenantId}`,
    );

    const result = await this.integrationService.processQueuedPancakeWebhookEvent(job.data);
    const durationMs = Date.now() - startedAt;

    this.logger.log(
      `Processed Pancake webhook event=${eventId} tenant=${tenantId} upserted=${result.upserted} warnings=${result.warnings.length} durationMs=${durationMs}`,
    );

    return result;
  }

  @OnQueueFailed()
  onFailed(job: Job<PancakeWebhookJobData>, error: any) {
    const { eventId, tenantId } = job?.data || ({} as PancakeWebhookJobData);
    this.logger.error(
      `Pancake webhook job failed event=${eventId} tenant=${tenantId}: ${error?.message || 'Unknown error'}`,
      error?.stack,
    );
  }
}

