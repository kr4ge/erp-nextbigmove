import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { IntegrationService } from '../integration.service';
import {
  PANCAKE_WEBHOOK_AUTO_CANCEL_JOB,
  PANCAKE_WEBHOOK_JOB,
  PANCAKE_WEBHOOK_QUEUE,
  PancakeWebhookAutoCancelJobData,
  PancakeWebhookJobData,
} from '../pancake-webhook.constants';

@Processor(PANCAKE_WEBHOOK_QUEUE)
export class PancakeWebhookQueueProcessor {
  private readonly logger = new Logger(PancakeWebhookQueueProcessor.name);

  constructor(private readonly integrationService: IntegrationService) {}

  @Process(PANCAKE_WEBHOOK_JOB)
  async handleIngest(job: Job<PancakeWebhookJobData>) {
    const startedAt = Date.now();
    const { logId, tenantId, requestId } = job.data;

    this.logger.debug(
      `Processing Pancake webhook job ${job.id} log=${logId} tenant=${tenantId}`,
    );

    const result = await this.integrationService.processQueuedPancakeWebhookEvent(job.data, {
      jobId: job.id?.toString?.() || String(job.id),
      attempts: (job.attemptsMade || 0) + 1,
    });
    const durationMs = Date.now() - startedAt;

    this.logger.log(
      `Processed Pancake webhook log=${logId} request=${requestId} tenant=${tenantId} upserted=${result.upserted} warnings=${result.warnings.length} durationMs=${durationMs}`,
    );

    return result;
  }

  @Process(PANCAKE_WEBHOOK_AUTO_CANCEL_JOB)
  async handleAutoCancel(job: Job<PancakeWebhookAutoCancelJobData>) {
    const startedAt = Date.now();
    const { tenantId, shopId, orderId } = job.data;

    this.logger.debug(
      `Processing auto-cancel job ${job.id} tenant=${tenantId} shop=${shopId} order=${orderId}`,
    );

    const result = await this.integrationService.processPancakeAutoCancelJob(job.data);
    const durationMs = Date.now() - startedAt;

    if (result.success) {
      this.logger.log(
        `Auto-cancel sent tenant=${tenantId} shop=${shopId} order=${orderId} durationMs=${durationMs}`,
      );
    } else {
      this.logger.debug(
        `Auto-cancel skipped tenant=${tenantId} shop=${shopId} order=${orderId} reason=${result.reason} durationMs=${durationMs}`,
      );
    }

    return result;
  }

  @OnQueueFailed()
  onFailed(job: Job<PancakeWebhookJobData | PancakeWebhookAutoCancelJobData>, error: any) {
    const { logId, tenantId, requestId } = (job?.data || {}) as PancakeWebhookJobData;
    const asAutoCancel = (job?.data || {}) as PancakeWebhookAutoCancelJobData;
    this.logger.error(
      `Pancake webhook job failed log=${logId || 'n/a'} request=${requestId || 'n/a'} tenant=${tenantId || asAutoCancel.tenantId || 'n/a'} shop=${asAutoCancel.shopId || 'n/a'} order=${asAutoCancel.orderId || 'n/a'}: ${error?.message || 'Unknown error'}`,
      error?.stack,
    );
  }
}
