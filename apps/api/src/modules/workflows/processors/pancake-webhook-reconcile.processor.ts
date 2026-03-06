import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ReconcileMarketingService } from '../services/reconcile-marketing.service';
import { ReconcileSalesService } from '../services/reconcile-sales.service';
import {
  PANCAKE_WEBHOOK_RECONCILE_JOB,
  PANCAKE_WEBHOOK_RECONCILE_QUEUE,
  PancakeWebhookReconcileJobData,
} from '../../integrations/pancake-webhook.constants';

@Processor(PANCAKE_WEBHOOK_RECONCILE_QUEUE)
export class PancakeWebhookReconcileProcessor {
  private readonly logger = new Logger(PancakeWebhookReconcileProcessor.name);

  constructor(
    private readonly reconcileMarketingService: ReconcileMarketingService,
    private readonly reconcileSalesService: ReconcileSalesService,
  ) {}

  @Process(PANCAKE_WEBHOOK_RECONCILE_JOB)
  async handleReconcile(job: Job<PancakeWebhookReconcileJobData>) {
    const startedAt = Date.now();
    const { tenantId, teamId, dateLocal, requestId, logId } = job.data;

    this.logger.debug(
      `Processing webhook reconcile job ${job.id} tenant=${tenantId} team=${teamId || 'null'} date=${dateLocal} request=${requestId || 'n/a'} log=${logId || 'n/a'}`,
    );

    await this.reconcileMarketingService.reconcileDay(tenantId, dateLocal, teamId);
    await this.reconcileSalesService.aggregateDay(tenantId, dateLocal, teamId);

    this.logger.log(
      `Processed webhook reconcile tenant=${tenantId} team=${teamId || 'null'} date=${dateLocal} durationMs=${Date.now() - startedAt}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<PancakeWebhookReconcileJobData>, error: any) {
    const data = job?.data || ({} as PancakeWebhookReconcileJobData);
    this.logger.error(
      `Webhook reconcile job failed job=${job?.id} tenant=${data.tenantId} team=${data.teamId || 'null'} date=${data.dateLocal}: ${error?.message || 'Unknown error'}`,
      error?.stack,
    );
  }
}

