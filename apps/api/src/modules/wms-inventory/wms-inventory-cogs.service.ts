import { Injectable } from '@nestjs/common';
import {
  WmsBasketUnitStatus,
  WmsPickReservationStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WmsInventoryCogsService {
  constructor(private readonly prisma: PrismaService) {}

  async syncPosOrderCogsFromMatchedInventoryUnits(params: {
    tenantId?: string | null;
    storeId?: string | null;
    fulfillmentOrderIds?: string[];
    posOrderRefs?: Array<{
      shopId: string;
      posOrderId: string;
    }>;
  }) {
    const fulfillmentOrderIds = Array.from(new Set(params.fulfillmentOrderIds ?? []));
    const refs = Array.from(
      new Map(
        (params.posOrderRefs ?? [])
          .filter((ref) => ref.shopId && ref.posOrderId)
          .map((ref) => [`${ref.shopId}::${ref.posOrderId}`, ref] as const),
      ).values(),
    );

    if (fulfillmentOrderIds.length === 0 && !params.tenantId) {
      return {
        updatedOrders: 0,
        skippedOrders: 0,
      };
    }

    const orders = await this.prisma.wmsFulfillmentOrder.findMany({
      where: {
        ...(fulfillmentOrderIds.length
          ? { id: { in: fulfillmentOrderIds } }
          : {
              ...(params.tenantId ? { tenantId: params.tenantId } : {}),
              ...(params.storeId ? { storeId: params.storeId } : {}),
              ...(refs.length > 0
                ? {
                    OR: refs.map((ref) => ({
                      shopId: ref.shopId,
                      posOrderId: ref.posOrderId,
                    })),
                  }
                : {}),
            }),
      },
      select: {
        id: true,
        assignmentMode: true,
        posOrderDbId: true,
        totalQuantity: true,
        reservations: {
          where: {
            status: {
              in: [WmsPickReservationStatus.RESERVED, WmsPickReservationStatus.PICKED],
            },
          },
          select: {
            inventoryUnit: {
              select: {
                unitCost: true,
              },
            },
          },
        },
        basketUnits: {
          where: {
            OR: [
              {
                status: {
                  in: [WmsBasketUnitStatus.PICKED, WmsBasketUnitStatus.PACKED],
                },
              },
              {
                status: WmsBasketUnitStatus.REMOVED,
                packedAt: {
                  not: null,
                },
              },
            ],
          },
          select: {
            inventoryUnit: {
              select: {
                unitCost: true,
              },
            },
          },
        },
      },
    });

    let updatedOrders = 0;
    let skippedOrders = 0;

    for (const order of orders) {
      const matchedUnits = order.assignmentMode === 'BASKET_DEMAND'
        ? order.basketUnits
        : order.reservations;

      if (matchedUnits.length === 0) {
        continue;
      }

      if (order.totalQuantity > 0 && matchedUnits.length < order.totalQuantity) {
        skippedOrders += 1;
        continue;
      }

      const hasMissingUnitCost = matchedUnits.some(
        (matchedUnit) => matchedUnit.inventoryUnit.unitCost === null,
      );
      if (hasMissingUnitCost) {
        skippedOrders += 1;
        continue;
      }

      const actualCogs = matchedUnits.reduce(
        (sum, matchedUnit) => sum + Number(matchedUnit.inventoryUnit.unitCost ?? 0),
        0,
      );

      await this.prisma.posOrder.update({
        where: { id: order.posOrderDbId },
        data: {
          cogs: new Decimal(actualCogs.toFixed(2)),
        },
      });

      updatedOrders += 1;
    }

    return {
      updatedOrders,
      skippedOrders,
    };
  }
}
