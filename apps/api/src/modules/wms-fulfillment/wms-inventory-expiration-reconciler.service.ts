import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  WmsInventoryMovementType,
  WmsInventoryUnitStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getManilaTodayDate } from '../wms-inventory/wms-inventory-expiration.utils';
import { WmsFulfillmentSyncService } from './wms-fulfillment-sync.service';

const EXPIRATION_RECONCILE_BATCH_SIZE = 500;

@Injectable()
export class WmsInventoryExpirationReconcilerService implements OnModuleInit {
  private readonly logger = new Logger(WmsInventoryExpirationReconcilerService.name);
  private readonly enabled =
    process.env.WMS_INVENTORY_EXPIRATION_RECONCILE_ENABLED !== 'false';

  constructor(
    private readonly prisma: PrismaService,
    private readonly fulfillmentSyncService: WmsFulfillmentSyncService,
  ) {}

  onModuleInit() {
    if (this.enabled) {
      void this.reconcileExpiredUnits('startup');
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileExpiredUnitsCron() {
    await this.reconcileExpiredUnits('cron');
  }

  private async reconcileExpiredUnits(source: 'startup' | 'cron') {
    if (!this.enabled) {
      return;
    }

    try {
      const today = getManilaTodayDate();
      const now = new Date();
      const expiredUnits = await this.prisma.$transaction(async (tx) => {
        const candidates = await tx.wmsInventoryUnit.findMany({
          where: {
            status: WmsInventoryUnitStatus.PUTAWAY,
            expirationDate: {
              lt: today,
            },
          },
          select: {
            id: true,
            tenantId: true,
            storeId: true,
            warehouseId: true,
            currentLocationId: true,
            variationId: true,
            code: true,
            expirationDate: true,
          },
          orderBy: [
            { expirationDate: 'asc' },
            { id: 'asc' },
          ],
          take: EXPIRATION_RECONCILE_BATCH_SIZE,
        });

        if (candidates.length === 0) {
          return [];
        }

        await tx.wmsInventoryUnit.updateMany({
          where: {
            id: {
              in: candidates.map((unit) => unit.id),
            },
            status: WmsInventoryUnitStatus.PUTAWAY,
            expirationDate: {
              lt: today,
            },
          },
          data: {
            status: WmsInventoryUnitStatus.EXPIRED,
            expiredAt: now,
          },
        });

        const updatedUnits = await tx.wmsInventoryUnit.findMany({
          where: {
            id: {
              in: candidates.map((unit) => unit.id),
            },
            status: WmsInventoryUnitStatus.EXPIRED,
            expiredAt: now,
          },
          select: {
            id: true,
            tenantId: true,
            storeId: true,
            warehouseId: true,
            currentLocationId: true,
            variationId: true,
            code: true,
            expirationDate: true,
          },
        });

        if (updatedUnits.length > 0) {
          await tx.wmsInventoryMovement.createMany({
            data: updatedUnits.map((unit) => ({
              tenantId: unit.tenantId,
              inventoryUnitId: unit.id,
              warehouseId: unit.warehouseId,
              fromLocationId: unit.currentLocationId,
              toLocationId: unit.currentLocationId,
              fromStatus: WmsInventoryUnitStatus.PUTAWAY,
              toStatus: WmsInventoryUnitStatus.EXPIRED,
              movementType: WmsInventoryMovementType.ADJUSTMENT,
              referenceType: 'EXPIRATION',
              referenceId: unit.id,
              referenceCode: unit.code,
              notes: `Expired after ${unit.expirationDate?.toISOString().slice(0, 10) ?? 'configured expiration date'}`,
              actorId: null,
              createdAt: now,
            })),
          });
        }

        return updatedUnits;
      });

      if (expiredUnits.length === 0) {
        return;
      }

      const scopes = expiredUnits.reduce((map, unit) => {
        const key = `${unit.tenantId}:${unit.storeId}`;
        const scope = map.get(key) ?? {
          tenantId: unit.tenantId,
          storeId: unit.storeId,
          variationIds: new Set<string>(),
        };
        scope.variationIds.add(unit.variationId);
        map.set(key, scope);
        return map;
      }, new Map<string, {
        tenantId: string;
        storeId: string;
        variationIds: Set<string>;
      }>());

      for (const scope of scopes.values()) {
        await this.fulfillmentSyncService.refreshDemandQueueForScope({
          tenantId: scope.tenantId,
          storeId: scope.storeId,
          variationIds: Array.from(scope.variationIds),
          limit: null,
        });
      }

      this.logger.log(
        `WMS inventory expiration reconcile (${source}) expired ${expiredUnits.length} unit${expiredUnits.length === 1 ? '' : 's'}`,
      );
    } catch (error) {
      this.logger.warn(
        `WMS inventory expiration reconcile (${source}) failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
