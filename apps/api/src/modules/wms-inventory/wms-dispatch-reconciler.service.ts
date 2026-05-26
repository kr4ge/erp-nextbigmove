import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WmsFulfillmentOrderStatus, WmsInventoryUnitStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WmsInventoryService } from './wms-inventory.service';

@Injectable()
export class WmsDispatchReconcilerService implements OnModuleInit {
  private readonly logger = new Logger(WmsDispatchReconcilerService.name);
  private readonly enabled = process.env.WMS_DISPATCH_RECONCILE_ENABLED !== 'false';

  constructor(
    private readonly prisma: PrismaService,
    private readonly wmsInventoryService: WmsInventoryService,
  ) {}

  onModuleInit() {
    if (!this.enabled) {
      return;
    }

    void this.reconcilePackedUnitsToDispatch('startup');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcilePackedUnitsToDispatchCron() {
    await this.reconcilePackedUnitsToDispatch('cron');
  }

  private async reconcilePackedUnitsToDispatch(source: 'startup' | 'cron') {
    if (!this.enabled) {
      return;
    }

    try {
      const candidates = await this.prisma.wmsFulfillmentOrder.findMany({
        where: {
          status: WmsFulfillmentOrderStatus.PACKED,
          posOrder: {
            is: {
              status: {
                in: [2, 3],
              },
            },
          },
          reservations: {
            some: {
              inventoryUnit: {
                status: WmsInventoryUnitStatus.PACKED,
              },
            },
          },
        },
        select: {
          tenantId: true,
          storeId: true,
        },
        distinct: ['tenantId', 'storeId'],
      });

      if (candidates.length === 0) {
        return;
      }

      let dispatchedUnits = 0;
      let deliveredOrders = 0;

      for (const candidate of candidates) {
        const result = await this.wmsInventoryService.syncPackedUnitsToDispatchedForPosOrders({
          tenantId: candidate.tenantId,
          storeId: candidate.storeId,
        });
        dispatchedUnits += result.dispatchedUnits;
        deliveredOrders += result.deliveredOrders;
      }

      if (dispatchedUnits > 0 || deliveredOrders > 0) {
        this.logger.log(
          `WMS dispatch reconcile (${source}) repaired ${dispatchedUnits} dispatched units and ${deliveredOrders} delivered orders`,
        );
      }
    } catch (error) {
      this.logger.warn(`WMS dispatch reconcile (${source}) failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
