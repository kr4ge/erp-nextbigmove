import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  WMS_PICKING_HANDOFF_QUEUE,
  WMS_PICKING_HANDOFF_WAITING_FOR_PRINTING_JOB,
  type WmsPickingHandoffWaitingForPrintingJobData,
} from './wms-mobile.constants';
import { WmsMobileService } from './wms-mobile.service';

const WMS_PICKING_HANDOFF_QUEUE_CONCURRENCY = Math.max(
  1,
  Number(process.env.WMS_PICKING_HANDOFF_QUEUE_CONCURRENCY || 4),
);

@Processor(WMS_PICKING_HANDOFF_QUEUE)
export class WmsMobileProcessor {
  private readonly logger = new Logger(WmsMobileProcessor.name);

  constructor(private readonly wmsMobileService: WmsMobileService) {}

  @Process({
    name: WMS_PICKING_HANDOFF_WAITING_FOR_PRINTING_JOB,
    concurrency: WMS_PICKING_HANDOFF_QUEUE_CONCURRENCY,
  })
  async handlePickingHandoffWaitingForPrinting(
    job: Job<WmsPickingHandoffWaitingForPrintingJobData>,
  ) {
    this.logger.debug(
      `Processing WMS picking handoff status fanout job=${job.id} basket=${job.data.basketCode ?? job.data.basketId} orders=${job.data.orders.length}`,
    );

    await this.wmsMobileService.processPickingHandoffWaitingForPrintingJob(job.data);
  }

  @OnQueueFailed()
  onFailed(job: Job<WmsPickingHandoffWaitingForPrintingJobData>, error: any) {
    this.logger.error(
      `WMS picking handoff fanout job failed job=${job?.id} basket=${job?.data?.basketCode ?? job?.data?.basketId ?? 'n/a'} attempts=${job?.attemptsMade ?? 0}/${job?.opts?.attempts ?? 1}: ${error?.message || 'Unknown error'}`,
      error?.stack,
    );
  }
}
