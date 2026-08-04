import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SmsOutboxService } from './sms-outbox.service';

@Injectable()
export class SmsOutboxRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: SmsOutboxService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async recoverPendingEvents() {
    const events = await this.prisma.smsOutboxEvent.findMany({
      where: {
        status: 'PENDING',
        availableAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true },
    });

    await Promise.all(events.map((event) => this.outbox.enqueue(event.id)));
  }
}
