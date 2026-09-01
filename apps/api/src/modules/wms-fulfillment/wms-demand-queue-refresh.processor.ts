import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  WMS_DEMAND_QUEUE_REFRESH_JOB,
  WMS_DEMAND_QUEUE_REFRESH_QUEUE,
  type WmsDemandQueueRefreshJobData,
} from './wms-fulfillment.constants';
import { WmsFulfillmentSyncService } from './wms-fulfillment-sync.service';

@Processor(WMS_DEMAND_QUEUE_REFRESH_QUEUE)
export class WmsDemandQueueRefreshProcessor {
  private readonly logger = new Logger(WmsDemandQueueRefreshProcessor.name);

  constructor(private readonly fulfillmentSyncService: WmsFulfillmentSyncService) {}

  @Process({
    name: WMS_DEMAND_QUEUE_REFRESH_JOB,
    concurrency: 1,
  })
  async handleDemandQueueRefresh(job: Job<WmsDemandQueueRefreshJobData>) {
    const startedAt = Date.now();
    await this.fulfillmentSyncService.refreshDemandQueueForScope({
      tenantId: job.data.tenantId,
      storeId: job.data.storeId,
    });
    this.logger.log(
      `Refreshed WMS demand queue job=${job.id} tenant=${job.data.tenantId} store=${job.data.storeId} durationMs=${Date.now() - startedAt}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<WmsDemandQueueRefreshJobData>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `WMS demand queue refresh failed job=${job?.id ?? 'n/a'} tenant=${job?.data?.tenantId ?? 'n/a'} store=${job?.data?.storeId ?? 'n/a'} attempts=${job?.attemptsMade ?? 0}/${job?.opts?.attempts ?? 1}: ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}
