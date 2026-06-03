import { Injectable } from '@nestjs/common';
import {
  NotificationDomain,
  NotificationSystem,
  Prisma,
  WmsPurchasingBatchStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PURCHASING_ENTITY_TYPE = 'PURCHASING_BATCH';

const WMS_PURCHASING_UNREAD_STATUSES = new Set<WmsPurchasingBatchStatus>([
  WmsPurchasingBatchStatus.UNDER_REVIEW,
  WmsPurchasingBatchStatus.PAYMENT_REVIEW,
  WmsPurchasingBatchStatus.SHIPPED,
]);

const ERP_PURCHASING_UNREAD_STATUSES = new Set<WmsPurchasingBatchStatus>([
  WmsPurchasingBatchStatus.REVISION,
  WmsPurchasingBatchStatus.PENDING_PAYMENT,
  WmsPurchasingBatchStatus.AWAITING_PRODUCTS,
  WmsPurchasingBatchStatus.RECEIVING_EXCEPTION,
]);

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class NotificationStateService {
  constructor(private readonly prisma: PrismaService) {}

  async syncPurchasingBatchEvent(
    client: PrismaClientLike,
    params: {
      tenantId: string;
      batchId: string;
      sourceEventId: string;
      sourceEventType: string;
      fromStatus?: WmsPurchasingBatchStatus | null;
      toStatus?: WmsPurchasingBatchStatus | null;
      context?: Prisma.InputJsonValue;
    },
  ) {
    const routing = this.resolvePurchasingRouting(params);
    if (!routing.shouldProcess) {
      return;
    }

    const now = new Date();
    const baseWhere = {
      tenantId: params.tenantId,
      domain: NotificationDomain.PURCHASING,
      entityType: PURCHASING_ENTITY_TYPE,
      entityId: params.batchId,
    };

    await client.notificationState.updateMany({
      where: baseWhere,
      data: {
        isUnread: false,
        readAt: now,
        readByUserId: null,
      },
    });

    for (const system of routing.targets) {
      await client.notificationState.upsert({
        where: {
          tenantId_system_domain_entityType_entityId: {
            tenantId: params.tenantId,
            system,
            domain: NotificationDomain.PURCHASING,
            entityType: PURCHASING_ENTITY_TYPE,
            entityId: params.batchId,
          },
        },
        create: {
          ...baseWhere,
          system,
          sourceEventId: params.sourceEventId,
          sourceEventType: params.sourceEventType,
          fromState: params.fromStatus ?? null,
          toState: params.toStatus ?? null,
          context: params.context ?? Prisma.JsonNull,
          isUnread: true,
        },
        update: {
          sourceEventId: params.sourceEventId,
          sourceEventType: params.sourceEventType,
          fromState: params.fromStatus ?? null,
          toState: params.toStatus ?? null,
          context: params.context ?? Prisma.JsonNull,
          isUnread: true,
          readAt: null,
          readByUserId: null,
        },
      });
    }
  }

  async getUnreadCount(params: {
    tenantId: string;
    system: NotificationSystem;
    domain: NotificationDomain;
  }) {
    return this.prisma.notificationState.count({
      where: {
        tenantId: params.tenantId,
        system: params.system,
        domain: params.domain,
        isUnread: true,
      },
    });
  }

  async markEntityRead(params: {
    tenantId: string;
    system: NotificationSystem;
    domain: NotificationDomain;
    entityType: string;
    entityId: string;
    readByUserId?: string | null;
  }) {
    const result = await this.prisma.notificationState.updateMany({
      where: {
        tenantId: params.tenantId,
        system: params.system,
        domain: params.domain,
        entityType: params.entityType,
        entityId: params.entityId,
        isUnread: true,
      },
      data: {
        isUnread: false,
        readAt: new Date(),
        readByUserId: params.readByUserId ?? null,
      },
    });

    return result.count;
  }

  getPurchasingEntityType() {
    return PURCHASING_ENTITY_TYPE;
  }

  private resolvePurchasingRouting(params: {
    sourceEventType: string;
    fromStatus?: WmsPurchasingBatchStatus | null;
    toStatus?: WmsPurchasingBatchStatus | null;
  }) {
    if (params.sourceEventType === 'PAYMENT_PROOF_SUBMITTED') {
      return {
        shouldProcess: true,
        targets: [NotificationSystem.WMS],
      };
    }

    if (!params.toStatus || params.toStatus === params.fromStatus) {
      return {
        shouldProcess: false,
        targets: [] as NotificationSystem[],
      };
    }

    const targets: NotificationSystem[] = [];

    if (WMS_PURCHASING_UNREAD_STATUSES.has(params.toStatus)) {
      targets.push(NotificationSystem.WMS);
    }

    if (ERP_PURCHASING_UNREAD_STATUSES.has(params.toStatus)) {
      targets.push(NotificationSystem.ERP);
    }

    return {
      shouldProcess: true,
      targets,
    };
  }
}
