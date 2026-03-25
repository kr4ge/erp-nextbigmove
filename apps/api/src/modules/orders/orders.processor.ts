import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { OrdersService } from './orders.service';
import {
  CONFIRMATION_UPDATE_QUEUE,
  CONFIRMATION_UPDATE_STATUS_JOB,
  ConfirmationUpdateStatusJobData,
} from './orders.constants';

@Processor(CONFIRMATION_UPDATE_QUEUE)
export class OrdersQueueProcessor {
  private readonly logger = new Logger(OrdersQueueProcessor.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Process(CONFIRMATION_UPDATE_STATUS_JOB)
  async handleUpdateStatus(job: Job<ConfirmationUpdateStatusJobData>) {
    const startedAt = Date.now();
    const {
      tenantId,
      shopId,
      posOrderId,
      targetStatus,
      targetTags,
      targetNote,
      targetNotePrint,
      targetShippingAddress,
    } = job.data;
    const hasShippingAddressUpdate =
      !!targetShippingAddress &&
      typeof targetShippingAddress === 'object' &&
      !Array.isArray(targetShippingAddress);
    const targetLabel =
      typeof targetStatus === 'number'
        ? `status=${targetStatus} tags=${Array.isArray(targetTags) ? targetTags.length : 0} note=${typeof targetNote === 'string' ? 1 : 0} note_print=${typeof targetNotePrint === 'string' ? 1 : 0} shipping_address=${hasShippingAddressUpdate ? 1 : 0}`
        : `status=n/a tags=${Array.isArray(targetTags) ? targetTags.length : 0} note=${typeof targetNote === 'string' ? 1 : 0} note_print=${typeof targetNotePrint === 'string' ? 1 : 0} shipping_address=${hasShippingAddressUpdate ? 1 : 0}`;

    this.logger.debug(
      `Processing confirmation update job=${job.id} tenant=${tenantId} shop=${shopId} order=${posOrderId} ${targetLabel}`,
    );

    const result = await this.ordersService.processQueuedConfirmationOrderStatusUpdate(job.data);
    const durationMs = Date.now() - startedAt;

    if (result.success) {
      this.logger.log(
        `Processed confirmation update job=${job.id} tenant=${tenantId} shop=${shopId} order=${posOrderId} ${targetLabel} durationMs=${durationMs}`,
      );
    } else {
      this.logger.warn(
        `Skipped confirmation update job=${job.id} tenant=${tenantId} shop=${shopId} order=${posOrderId} ${targetLabel} reason=${result.reason} durationMs=${durationMs}`,
      );
    }

    return result;
  }

  @OnQueueFailed()
  async onFailed(job: Job<ConfirmationUpdateStatusJobData>, error: any) {
    const data = job?.data;
    const attemptsMade = job?.attemptsMade || 0;
    const configuredAttempts =
      typeof job?.opts?.attempts === 'number' && Number.isFinite(job.opts.attempts)
        ? job.opts.attempts
        : 1;
    const isTerminal = attemptsMade >= configuredAttempts;

    this.logger.error(
      `Confirmation update job failed job=${job?.id} tenant=${data?.tenantId || 'n/a'} shop=${data?.shopId || 'n/a'} order=${data?.posOrderId || 'n/a'} attempts=${attemptsMade}/${configuredAttempts} terminal=${isTerminal ? 1 : 0}: ${error?.message || 'Unknown error'}`,
      error?.stack,
    );

    if (!data || !isTerminal) return;

    await this.ordersService
      .clearConfirmationUpdateInFlightByJob(data.orderRowId, data.tenantId)
      .catch(() => undefined);
  }
}
