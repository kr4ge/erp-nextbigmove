import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SMS_OUTBOUND_JOB, SMS_OUTBOUND_QUEUE } from './sms.constants';

@Injectable()
export class SmsOutboxService {
  private readonly logger = new Logger(SmsOutboxService.name);

  constructor(@InjectQueue(SMS_OUTBOUND_QUEUE) private readonly queue: Queue) {}

  async enqueue(outboxEventId: string) {
    try {
      await this.queue.add(
        SMS_OUTBOUND_JOB,
        { outboxEventId },
        {
          jobId: `sms-outbox:${outboxEventId}`,
          attempts: Number(process.env.SMS_OUTBOUND_QUEUE_ATTEMPTS ?? 5),
          backoff: {
            type: 'exponential',
            delay: Number(process.env.SMS_OUTBOUND_QUEUE_BACKOFF_MS ?? 2000),
          },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      );
    } catch (error) {
      this.logger.error(
        `Unable to enqueue SMS outbox event ${outboxEventId}; recovery will retry it`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
