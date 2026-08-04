import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SmsMessageEventType, SmsMessageStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import {
  SMS_DEFAULT_SIM_DAILY_LIMIT,
  SMS_DEFAULT_SIM_PER_MINUTE_LIMIT,
  SMS_DEFAULT_TENANT_DAILY_LIMIT,
} from './sms.constants';
import { CreateSmsTemplateDto } from './dto/create-sms-template.dto';
import { GatewaySmsEventDto, GatewaySmsEventType } from './dto/gateway-sms-event.dto';
import { SendSmsMessageDto } from './dto/send-sms-message.dto';
import { SmsOutboxService } from './sms-outbox.service';
import { SmsPhoneService } from './sms-phone.service';
import { SmsGatewayClient } from './sms-gateway.client';

@Injectable()
export class SmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TeamContextService,
    private readonly phone: SmsPhoneService,
    private readonly outbox: SmsOutboxService,
    private readonly gateway: SmsGatewayClient,
  ) {}

  async createDeviceEnrollment() {
    const { tenantId } = await this.context.getContext();
    return this.gateway.createEnrollment(tenantId);
  }

  async getOverview() {
    const { tenantId } = await this.context.getContext();
    const now = new Date();
    const today = this.manilaDayBounds(now);
    const last30DaysStart = new Date(today.start.getTime() - (29 * 24 * 60 * 60 * 1000));
    const dailyLimit = Number(
      process.env.SMS_TENANT_DAILY_LIMIT ?? SMS_DEFAULT_TENANT_DAILY_LIMIT,
    );
    const pendingStatuses: SmsMessageStatus[] = [
      'PENDING',
      'WAITING_FOR_DEVICE',
      'DISPATCHING',
    ];

    const [
      totalOutbound,
      totalInbound,
      totalDevices,
      activeDevices,
      activeSims,
      deliveredMessages,
      failedMessages,
      pendingMessages,
      latestMessage,
      todayOutbound,
      todayInbound,
      last30DaysOutbound,
      last30DaysInbound,
    ] = await Promise.all([
      this.prisma.smsMessage.count({
        where: { tenantId, direction: 'OUTBOUND' },
      }),
      this.prisma.smsMessage.count({
        where: { tenantId, direction: 'INBOUND' },
      }),
      this.prisma.smsDevice.count({
        where: { tenantId, status: { not: 'REVOKED' } },
      }),
      this.prisma.smsDevice.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.smsSim.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.smsMessage.count({
        where: { tenantId, direction: 'OUTBOUND', status: 'DELIVERED' },
      }),
      this.prisma.smsMessage.count({
        where: { tenantId, direction: 'OUTBOUND', status: 'FAILED' },
      }),
      this.prisma.smsMessage.count({
        where: {
          tenantId,
          direction: 'OUTBOUND',
          status: { in: pendingStatuses },
        },
      }),
      this.prisma.smsMessage.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.smsMessage.count({
        where: {
          tenantId,
          direction: 'OUTBOUND',
          createdAt: { gte: today.start, lt: today.end },
        },
      }),
      this.prisma.smsMessage.count({
        where: {
          tenantId,
          direction: 'INBOUND',
          createdAt: { gte: today.start, lt: today.end },
        },
      }),
      this.prisma.smsMessage.count({
        where: {
          tenantId,
          direction: 'OUTBOUND',
          createdAt: { gte: last30DaysStart, lt: today.end },
        },
      }),
      this.prisma.smsMessage.count({
        where: {
          tenantId,
          direction: 'INBOUND',
          createdAt: { gte: last30DaysStart, lt: today.end },
        },
      }),
    ]);

    const terminalMessages = deliveredMessages + failedMessages;
    const deliveryRate = terminalMessages > 0
      ? Number(((deliveredMessages / terminalMessages) * 100).toFixed(1))
      : null;

    return {
      usage: {
        today: {
          sent: todayOutbound,
          received: todayInbound,
          total: todayOutbound + todayInbound,
          outboundLimit: dailyLimit,
          outboundRemaining: Math.max(dailyLimit - todayOutbound, 0),
        },
        last30Days: {
          sent: last30DaysOutbound,
          received: last30DaysInbound,
          total: last30DaysOutbound + last30DaysInbound,
          outboundCapacity: dailyLimit * 30,
        },
      },
      stats: {
        totalOutbound,
        totalInbound,
        totalDevices,
        activeDevices,
        activeSims,
        deliveredMessages,
        failedMessages,
        pendingMessages,
        deliveryRate,
        lastActivityAt: latestMessage?.createdAt ?? null,
      },
      setup: {
        hasDevice: totalDevices > 0,
        hasActiveDevice: activeDevices > 0,
        hasActiveSim: activeSims > 0,
        hasSentMessage: totalOutbound > 0,
        hasReceivedMessage: totalInbound > 0,
      },
    };
  }

  async sendMessage(dto: SendSmsMessageDto) {
    const { tenantId, userId } = await this.context.getContext();
    if (!userId) {
      throw new ForbiddenException('Authenticated user is required');
    }

    const recipientPhone = this.phone.normalize(dto.recipientPhone);
    const analyzedBody = this.phone.analyzeBody(dto.body);
    const idempotencyKey = dto.idempotencyKey?.trim() || randomUUID();

    const existing = await this.prisma.smsMessage.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.tenantId !== tenantId) {
        throw new ConflictException('Idempotency key is already in use');
      }
      return existing;
    }

    const suppression = await this.prisma.smsSuppression.findUnique({
      where: {
        tenantId_phoneNormalized: {
          tenantId,
          phoneNormalized: recipientPhone,
        },
      },
    });
    if (suppression?.isActive && !dto.overrideSuppression) {
      throw new ForbiddenException('Recipient is suppressed from SMS messaging');
    }

    const sim = await this.resolveSim({
      tenantId,
      simId: dto.simId,
      storeId: dto.storeId,
    });
    await this.validateRelatedScope(tenantId, dto.storeId, dto.posOrderId);
    await this.enforceRateLimits(tenantId, sim.id);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (Number(process.env.SMS_MESSAGE_EXPIRY_MINUTES ?? 60) * 60_000));

    const result = await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.smsConversation.upsert({
        where: {
          tenantId_simId_customerPhoneNormalized: {
            tenantId,
            simId: sim.id,
            customerPhoneNormalized: recipientPhone,
          },
        },
        create: {
          tenantId,
          simId: sim.id,
          storeId: dto.storeId,
          customerPhone: recipientPhone,
          customerPhoneNormalized: recipientPhone,
          lastMessageAt: now,
          lastMessagePreview: analyzedBody.body.slice(0, 160),
        },
        update: {
          storeId: dto.storeId ?? undefined,
          lastMessageAt: now,
          lastMessagePreview: analyzedBody.body.slice(0, 160),
        },
      });

      const message = await tx.smsMessage.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          status: 'PENDING',
          channelType: 'PHYSICAL_SIM',
          simId: sim.id,
          deviceId: sim.deviceId,
          storeId: dto.storeId,
          posOrderId: dto.posOrderId,
          senderPhone: sim.normalizedNumber ?? sim.phoneNumber ?? '',
          recipientPhone,
          body: analyzedBody.body,
          bodyEncoding: analyzedBody.encoding,
          segmentCount: analyzedBody.segmentCount,
          idempotencyKey,
          createdById: userId,
          queuedAt: now,
          expiresAt,
          metadata: {
            suppressionOverridden: Boolean(suppression?.isActive && dto.overrideSuppression),
          },
        },
      });

      await tx.smsMessageEvent.create({
        data: {
          tenantId,
          messageId: message.id,
          type: 'QUEUED',
          status: 'PENDING',
          occurredAt: now,
          payload: {},
        },
      });

      const outbox = await tx.smsOutboxEvent.create({
        data: {
          tenantId,
          messageId: message.id,
          eventType: 'SMS_MESSAGE_QUEUED',
          payload: { messageId: message.id },
        },
      });

      return { message, outboxId: outbox.id };
    });

    await this.outbox.enqueue(result.outboxId);
    return result.message;
  }

  async listConversations(limit = 50, cursor?: string) {
    const { tenantId } = await this.context.getContext();
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    return this.prisma.smsConversation.findMany({
      where: { tenantId },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        sim: {
          select: {
            id: true,
            alias: true,
            phoneNumber: true,
            carrier: true,
            status: true,
          },
        },
        store: {
          select: { id: true, shopName: true },
        },
      },
    });
  }

  async listConversationMessages(conversationId: string, limit = 100) {
    const { tenantId } = await this.context.getContext();
    const conversation = await this.prisma.smsConversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });
    if (!conversation) {
      throw new NotFoundException('SMS conversation not found');
    }

    return this.prisma.smsMessage.findMany({
      where: { tenantId, conversationId },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        events: {
          orderBy: { occurredAt: 'asc' },
        },
      },
    });
  }

  async listDevices() {
    const { tenantId } = await this.context.getContext();
    return this.prisma.smsDevice.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        sims: {
          orderBy: { slotIndex: 'asc' },
        },
      },
    });
  }

  async listTemplates() {
    const { tenantId } = await this.context.getContext();
    return this.prisma.smsTemplate.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createTemplate(dto: CreateSmsTemplateDto) {
    const { tenantId, userId } = await this.context.getContext();
    if (!userId) {
      throw new ForbiddenException('Authenticated user is required');
    }
    this.phone.analyzeBody(dto.body);

    return this.prisma.smsTemplate.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        body: dto.body.trim(),
        isActive: dto.isActive ?? true,
        createdById: userId,
      },
    });
  }

  async handleGatewayEvent(dto: GatewaySmsEventDto) {
    if (
      dto.type === GatewaySmsEventType.DEVICE_ENROLLED
      || dto.type === GatewaySmsEventType.DEVICE_HEARTBEAT
    ) {
      return this.handleDeviceEvent(dto);
    }

    if (dto.type === GatewaySmsEventType.RECEIVED) {
      return this.handleInboundEvent(dto);
    }

    if (!dto.messageId) {
      throw new BadRequestException('messageId is required for outbound SMS events');
    }

    const message = await this.prisma.smsMessage.findFirst({
      where: {
        id: dto.messageId,
        tenantId: dto.tenantId,
      },
    });
    if (!message) {
      throw new NotFoundException('SMS message not found');
    }

    const occurredAt = new Date(dto.occurredAt);
    const mapping = this.mapGatewayEvent(dto.type);

    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.smsMessageEvent.findUnique({
        where: { gatewayEventId: dto.eventId },
        select: { id: true },
      });
      if (duplicate) {
        return { duplicate: true };
      }

      const updated = await tx.smsMessage.update({
        where: { id: message.id },
        data: {
          status: mapping.status,
          gatewayMessageId: dto.gatewayMessageId ?? undefined,
          errorCode: dto.errorCode,
          errorMessage: dto.errorMessage,
          ...(mapping.timestampField ? { [mapping.timestampField]: occurredAt } : {}),
        },
      });

      await tx.smsMessageEvent.create({
        data: {
          tenantId: dto.tenantId,
          messageId: message.id,
          gatewayEventId: dto.eventId,
          type: mapping.eventType,
          status: mapping.status,
          occurredAt,
          payload: this.toJson(dto),
        },
      });

      return updated;
    });
  }

  private async handleDeviceEvent(dto: GatewaySmsEventDto) {
    if (!dto.device) {
      throw new BadRequestException('Device event requires device details');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('SMS device tenant not found');
    }

    const existingDevice = await this.prisma.smsDevice.findUnique({
      where: { externalDeviceId: dto.device.externalDeviceId },
      select: { tenantId: true },
    });
    if (existingDevice && existingDevice.tenantId !== dto.tenantId) {
      throw new ConflictException('SMS device is already enrolled to another tenant');
    }

    const externalSimIds = dto.device.sims.map((sim) => sim.externalSimId);
    if (externalSimIds.length) {
      const conflictingSim = await this.prisma.smsSim.findFirst({
        where: {
          externalSimId: { in: externalSimIds },
          tenantId: { not: dto.tenantId },
        },
        select: { externalSimId: true },
      });
      if (conflictingSim) {
        throw new ConflictException(
          `SIM ${conflictingSim.externalSimId} is already enrolled to another tenant`,
        );
      }
    }

    const occurredAt = new Date(dto.occurredAt);
    const lastSeenAt = new Date(dto.device.lastSeenAt);

    return this.prisma.$transaction(async (tx) => {
      const device = await tx.smsDevice.upsert({
        where: { externalDeviceId: dto.device!.externalDeviceId },
        create: {
          tenantId: dto.tenantId,
          externalDeviceId: dto.device!.externalDeviceId,
          name: dto.device!.name,
          status: 'ACTIVE',
          appVersion: dto.device!.appVersion,
          lastSeenAt,
          enrolledAt:
            dto.type === GatewaySmsEventType.DEVICE_ENROLLED ? occurredAt : undefined,
          metadata: {},
        },
        update: {
          name: dto.device!.name,
          status: 'ACTIVE',
          appVersion: dto.device!.appVersion,
          lastSeenAt,
          revokedAt: null,
          ...(dto.type === GatewaySmsEventType.DEVICE_ENROLLED
            ? { enrolledAt: occurredAt }
            : {}),
        },
      });

      for (const sim of dto.device!.sims) {
        const normalizedNumber = this.normalizeOptionalPhone(sim.phoneNumber);
        await tx.smsSim.upsert({
          where: { externalSimId: sim.externalSimId },
          create: {
            tenantId: dto.tenantId,
            deviceId: device.id,
            externalSimId: sim.externalSimId,
            subscriptionId: sim.subscriptionId,
            slotIndex: sim.slotIndex,
            phoneNumber: sim.phoneNumber,
            normalizedNumber,
            alias: sim.alias,
            carrier: sim.carrier,
            status: 'ACTIVE',
            lastSeenAt,
          },
          update: {
            deviceId: device.id,
            subscriptionId: sim.subscriptionId,
            slotIndex: sim.slotIndex,
            phoneNumber: sim.phoneNumber ?? undefined,
            normalizedNumber: normalizedNumber ?? undefined,
            alias: sim.alias,
            carrier: sim.carrier,
            status: 'ACTIVE',
            lastSeenAt,
          },
        });
      }

      await tx.smsSim.updateMany({
        where: {
          deviceId: device.id,
          ...(externalSimIds.length
            ? { externalSimId: { notIn: externalSimIds } }
            : {}),
        },
        data: {
          status: 'OFFLINE',
        },
      });

      return tx.smsDevice.findUnique({
        where: { id: device.id },
        include: {
          sims: {
            orderBy: { slotIndex: 'asc' },
          },
        },
      });
    });
  }

  private async handleInboundEvent(dto: GatewaySmsEventDto) {
    if (!dto.externalSimId || !dto.from || !dto.to || !dto.body) {
      throw new BadRequestException('Inbound SMS event requires externalSimId, from, to, and body');
    }

    const sim = await this.prisma.smsSim.findFirst({
      where: {
        externalSimId: dto.externalSimId,
        tenantId: dto.tenantId,
      },
      include: { device: true },
    });
    if (!sim) {
      throw new NotFoundException('SMS SIM not found');
    }

    const senderPhone = this.phone.normalize(dto.from);
    const recipientPhone = this.phone.normalize(dto.to);
    const body = this.phone.analyzeBody(dto.body);
    const occurredAt = new Date(dto.occurredAt);
    const idempotencyKey = `gateway:${dto.eventId}`;

    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.smsMessageEvent.findUnique({
        where: { gatewayEventId: dto.eventId },
        select: { messageId: true },
      });
      if (duplicate) {
        return tx.smsMessage.findUnique({ where: { id: duplicate.messageId } });
      }

      const conversation = await tx.smsConversation.upsert({
        where: {
          tenantId_simId_customerPhoneNormalized: {
            tenantId: dto.tenantId,
            simId: sim.id,
            customerPhoneNormalized: senderPhone,
          },
        },
        create: {
          tenantId: dto.tenantId,
          simId: sim.id,
          customerPhone: senderPhone,
          customerPhoneNormalized: senderPhone,
          lastMessageAt: occurredAt,
          lastMessagePreview: body.body.slice(0, 160),
        },
        update: {
          lastMessageAt: occurredAt,
          lastMessagePreview: body.body.slice(0, 160),
        },
      });

      const message = await tx.smsMessage.create({
        data: {
          tenantId: dto.tenantId,
          conversationId: conversation.id,
          direction: 'INBOUND',
          status: 'RECEIVED',
          channelType: 'PHYSICAL_SIM',
          simId: sim.id,
          deviceId: sim.deviceId,
          senderPhone,
          recipientPhone,
          body: body.body,
          bodyEncoding: body.encoding,
          segmentCount: body.segmentCount,
          idempotencyKey,
          gatewayMessageId: dto.gatewayMessageId,
          receivedAt: occurredAt,
          metadata: this.toJson(dto.metadata ?? {}),
        },
      });

      await tx.smsMessageEvent.create({
        data: {
          tenantId: dto.tenantId,
          messageId: message.id,
          gatewayEventId: dto.eventId,
          type: 'RECEIVED',
          status: 'RECEIVED',
          occurredAt,
          payload: this.toJson(dto),
        },
      });

      return message;
    });
  }

  private async resolveSim(params: { tenantId: string; simId?: string; storeId?: string }) {
    if (params.simId) {
      const sim = await this.prisma.smsSim.findFirst({
        where: {
          id: params.simId,
          tenantId: params.tenantId,
          status: 'ACTIVE',
          device: { status: 'ACTIVE' },
        },
        include: { device: true },
      });
      if (!sim) {
        throw new NotFoundException('Active SMS SIM not found');
      }
      return sim;
    }

    if (!params.storeId) {
      throw new BadRequestException('Select a SIM or store before sending');
    }

    const route = await this.prisma.smsStoreRoute.findFirst({
      where: {
        tenantId: params.tenantId,
        storeId: params.storeId,
        isActive: true,
        sim: {
          status: 'ACTIVE',
          device: { status: 'ACTIVE' },
        },
      },
      orderBy: { priority: 'asc' },
      include: {
        sim: {
          include: { device: true },
        },
      },
    });
    if (!route) {
      throw new NotFoundException('No active SMS route is configured for this store');
    }

    return route.sim;
  }

  private async validateRelatedScope(tenantId: string, storeId?: string, posOrderId?: string) {
    if (storeId) {
      const store = await this.prisma.posStore.findFirst({
        where: { id: storeId, tenantId },
        select: { id: true },
      });
      if (!store) {
        throw new NotFoundException('Store not found in this tenant');
      }
    }

    if (posOrderId) {
      const order = await this.prisma.posOrder.findFirst({
        where: {
          id: posOrderId,
          tenantId,
          ...(storeId ? { storeId } : {}),
        },
        select: { id: true },
      });
      if (!order) {
        throw new NotFoundException('POS order not found in this tenant and store');
      }
    }
  }

  private async enforceRateLimits(tenantId: string, simId: string) {
    const { start, end } = this.manilaDayBounds(new Date());
    const minuteAgo = new Date(Date.now() - 60_000);
    const [tenantDaily, simDaily, simRecent] = await Promise.all([
      this.prisma.smsMessage.count({
        where: {
          tenantId,
          direction: 'OUTBOUND',
          createdAt: { gte: start, lt: end },
        },
      }),
      this.prisma.smsMessage.count({
        where: {
          tenantId,
          simId,
          direction: 'OUTBOUND',
          createdAt: { gte: start, lt: end },
        },
      }),
      this.prisma.smsMessage.count({
        where: {
          tenantId,
          simId,
          direction: 'OUTBOUND',
          createdAt: { gte: minuteAgo },
        },
      }),
    ]);

    const tenantLimit = Number(process.env.SMS_TENANT_DAILY_LIMIT ?? SMS_DEFAULT_TENANT_DAILY_LIMIT);
    const simDailyLimit = Number(process.env.SMS_SIM_DAILY_LIMIT ?? SMS_DEFAULT_SIM_DAILY_LIMIT);
    const simMinuteLimit = Number(
      process.env.SMS_SIM_PER_MINUTE_LIMIT ?? SMS_DEFAULT_SIM_PER_MINUTE_LIMIT,
    );

    if (tenantDaily >= tenantLimit) {
      throw new HttpException('Tenant daily SMS limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (simDaily >= simDailyLimit) {
      throw new HttpException('SIM daily SMS limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (simRecent >= simMinuteLimit) {
      throw new HttpException('SIM per-minute SMS limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private manilaDayBounds(date: Date) {
    const datePart = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);

    return {
      start: new Date(`${datePart}T00:00:00+08:00`),
      end: new Date(`${datePart}T24:00:00+08:00`),
    };
  }

  private mapGatewayEvent(type: GatewaySmsEventType): {
    status: SmsMessageStatus;
    eventType: SmsMessageEventType;
    timestampField: 'dispatchedAt' | 'sentAt' | 'deliveredAt' | 'failedAt' | null;
  } {
    switch (type) {
      case GatewaySmsEventType.DISPATCH_ACCEPTED:
        return {
          status: 'DISPATCHING',
          eventType: 'DISPATCH_ACCEPTED',
          timestampField: 'dispatchedAt',
        };
      case GatewaySmsEventType.SENT:
        return { status: 'SENT', eventType: 'SENT', timestampField: 'sentAt' };
      case GatewaySmsEventType.DELIVERED:
        return { status: 'DELIVERED', eventType: 'DELIVERED', timestampField: 'deliveredAt' };
      case GatewaySmsEventType.FAILED:
        return { status: 'FAILED', eventType: 'FAILED', timestampField: 'failedAt' };
      case GatewaySmsEventType.EXPIRED:
        return { status: 'EXPIRED', eventType: 'EXPIRED', timestampField: 'failedAt' };
      default:
        throw new BadRequestException(`Unsupported outbound event type: ${type}`);
    }
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private normalizeOptionalPhone(value?: string) {
    if (!value?.trim()) {
      return null;
    }
    try {
      return this.phone.normalize(value);
    } catch {
      return null;
    }
  }
}
