import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  WMS_PACKING_POST_COMPLETE_QUEUE,
  WMS_PACKING_POST_COMPLETE_SYNC_JOB,
  type WmsPackingPostCompleteJobData,
} from './wms-mobile.constants';
import { WmsMobileService } from './wms-mobile.service';

const WMS_PACKING_POST_COMPLETE_QUEUE_CONCURRENCY = Math.max(
  1,
  Number(process.env.WMS_PACKING_POST_COMPLETE_QUEUE_CONCURRENCY || 2),
);

@Processor(WMS_PACKING_POST_COMPLETE_QUEUE)
export class WmsPackingProcessor {
  private readonly logger = new Logger(WmsPackingProcessor.name);

  constructor(private readonly wmsMobileService: WmsMobileService) {}

  @Process({
    name: WMS_PACKING_POST_COMPLETE_SYNC_JOB,
    concurrency: WMS_PACKING_POST_COMPLETE_QUEUE_CONCURRENCY,
  })
  async handlePostCompleteSync(job: Job<WmsPackingPostCompleteJobData>) {
    await this.wmsMobileService.processPackingPostCompleteJob(job.data);
  }

  @OnQueueFailed()
  onFailed(job: Job<WmsPackingPostCompleteJobData>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `WMS post-pack sync failed job=${job?.id ?? 'n/a'} order=${job?.data?.fulfillmentOrderId ?? 'n/a'} attempts=${job?.attemptsMade ?? 0}/${job?.opts?.attempts ?? 1}: ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}
