import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SMS_OUTBOUND_JOB, SMS_OUTBOUND_QUEUE } from './sms.constants';
import { SmsGatewayClient } from './sms-gateway.client';

type SmsOutboxJob = {
  outboxEventId: string;
};

@Processor(SMS_OUTBOUND_QUEUE)
export class SmsOutboxProcessor {
  private readonly logger = new Logger(SmsOutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayClient: SmsGatewayClient,
  ) {}

  @Process(SMS_OUTBOUND_JOB)
  async dispatch(job: Job<SmsOutboxJob>) {
    const event = await this.prisma.smsOutboxEvent.findUnique({
      where: { id: job.data.outboxEventId },
      include: {
        message: {
          include: {
            sim: {
              include: { device: true },
            },
          },
        },
      },
    });

    if (!event || event.status === 'PROCESSED') {
      return;
    }

    await this.prisma.smsOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    try {
      const response = await this.gatewayClient.dispatch({
        messageId: event.message.id,
        tenantId: event.tenantId,
        externalDeviceId: event.message.sim.device.externalDeviceId,
        externalSimId: event.message.sim.externalSimId,
        subscriptionId: event.message.sim.subscriptionId,
        senderPhone: event.message.senderPhone,
        recipientPhone: event.message.recipientPhone,
        body: event.message.body,
        expiresAt: event.message.expiresAt?.toISOString() ?? null,
        idempotencyKey: event.message.idempotencyKey,
      });

      const acceptedAt = new Date(response.acceptedAt);
      await this.prisma.$transaction([
        this.prisma.smsMessage.update({
          where: { id: event.message.id },
          data: {
            gatewayMessageId: response.gatewayMessageId,
            status: 'DISPATCHING',
            dispatchedAt: acceptedAt,
            deviceId: event.message.sim.deviceId,
          },
        }),
        this.prisma.smsMessageEvent.create({
          data: {
            tenantId: event.tenantId,
            messageId: event.message.id,
            type: 'DISPATCH_ACCEPTED',
            status: 'DISPATCHING',
            occurredAt: acceptedAt,
            payload: response,
          },
        }),
        this.prisma.smsOutboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'PROCESSED',
            processedAt: acceptedAt,
            lastError: null,
          },
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMS dispatch error';
      const maxAttempts = Number(job.opts.attempts ?? 1);
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

      await this.prisma.$transaction([
        this.prisma.smsOutboxEvent.update({
          where: { id: event.id },
          data: {
            status: isFinalAttempt ? 'FAILED' : 'PENDING',
            lastError: message.slice(0, 1000),
          },
        }),
        ...(isFinalAttempt
          ? [
              this.prisma.smsMessage.update({
                where: { id: event.message.id },
                data: {
                  status: 'FAILED',
                  failedAt: new Date(),
                  errorCode: 'GATEWAY_DISPATCH_FAILED',
                  errorMessage: message.slice(0, 500),
                },
              }),
              this.prisma.smsMessageEvent.create({
                data: {
                  tenantId: event.tenantId,
                  messageId: event.message.id,
                  type: 'FAILED' as const,
                  status: 'FAILED' as const,
                  occurredAt: new Date(),
                  payload: { error: message.slice(0, 1000) },
                },
              }),
            ]
          : []),
      ]);

      this.logger.warn(`SMS dispatch failed for ${event.message.id}: ${message}`);
      throw error;
    }
  }
}
