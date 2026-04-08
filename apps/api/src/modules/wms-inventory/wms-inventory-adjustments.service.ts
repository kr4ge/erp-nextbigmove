import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWmsInventoryAdjustmentDto } from './dto/create-wms-inventory-adjustment.dto';
import { ListWmsInventoryAdjustmentsDto } from './dto/list-wms-inventory-adjustments.dto';
import { WmsInventoryUnitsService } from './wms-inventory-units.service';

type ConsumedLayer = {
  costLayerId: string;
  lotId: string;
  lotCode: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
};

@Injectable()
export class WmsInventoryAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly wmsInventoryUnitsService: WmsInventoryUnitsService,
  ) {}

  private normalizeText(value?: string | null) {
    const next = value?.trim();
    return next ? next : null;
  }

  private toDecimal(value: number | string | Prisma.Decimal) {
    return new Prisma.Decimal(value);
  }

  private toNumber(value: Prisma.Decimal | null | undefined) {
    return value == null ? null : Number(value);
  }

  private isPositiveAdjustment(adjustmentType: string) {
    return adjustmentType === 'OPENING' || adjustmentType === 'INCREASE';
  }

  private movementTypeFor(adjustmentType: string) {
    if (adjustmentType === 'WRITE_OFF') {
      return 'DAMAGE' as const;
    }

    return this.isPositiveAdjustment(adjustmentType)
      ? ('ADJUSTMENT_IN' as const)
      : ('ADJUSTMENT_OUT' as const);
  }

  private buildAdjustmentCode() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `ADJ-${yyyy}${mm}${dd}-${suffix}`;
  }

  private buildLotCode(adjustmentCode: string, lineNo: number) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${adjustmentCode}-L${String(lineNo).padStart(2, '0')}-${suffix}`;
  }

  private async getWarehouseLocationOrThrow(warehouseId: string, locationId: string) {
    const warehouse = await this.prisma.wmsWarehouse.findUnique({
      where: { id: warehouseId },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
      },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    const location = await this.prisma.wmsLocation.findFirst({
      where: {
        id: locationId,
        warehouseId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        type: true,
      },
    });

    if (!location) {
      throw new NotFoundException('Location not found in this warehouse');
    }

    if (warehouse.status !== 'ACTIVE') {
      throw new ConflictException('Warehouse is not active');
    }

    if (location.status !== 'ACTIVE') {
      throw new ConflictException('Location is not active');
    }

    return { warehouse, location };
  }

  private async consumeCostLayersFifo(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    sku: string,
    requestedQuantity: Prisma.Decimal,
  ) {
    const layers = await tx.wmsInventoryCostLayer.findMany({
      where: {
        warehouseId,
        sku,
        remainingQuantity: {
          gt: new Prisma.Decimal(0),
        },
      },
      orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        lot: {
          select: {
            id: true,
            lotCode: true,
          },
        },
      },
    });

    let remaining = requestedQuantity;
    const consumed: ConsumedLayer[] = [];

    for (const layer of layers) {
      if (remaining.lte(0)) {
        break;
      }

      const available = layer.remainingQuantity;
      if (available.lte(0)) {
        continue;
      }

      const quantity = available.gte(remaining) ? remaining : available;
      const nextRemaining = available.sub(quantity);
      const totalCost = quantity.mul(layer.unitCost);

      await tx.wmsInventoryCostLayer.update({
        where: { id: layer.id },
        data: {
          remainingQuantity: nextRemaining,
        },
      });

      await tx.wmsInventoryLot.update({
        where: { id: layer.lotId },
        data: {
          remainingQuantity: {
            decrement: quantity,
          },
        },
      });

      consumed.push({
        costLayerId: layer.id,
        lotId: layer.lotId,
        lotCode: layer.lot.lotCode,
        quantity,
        unitCost: layer.unitCost,
        totalCost,
      });

      remaining = remaining.sub(quantity);
    }

    if (remaining.gt(0)) {
      throw new ConflictException(`Not enough FIFO cost layers for SKU ${sku}`);
    }

    return consumed;
  }

  async listAdjustments(query: ListWmsInventoryAdjustmentsDto) {
    const adjustments = await this.prisma.wmsInventoryAdjustment.findMany({
      where: {
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.adjustmentType ? { adjustmentType: query.adjustmentType } : {}),
      },
      take: query.limit || 50,
      orderBy: [{ happenedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
        actorUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          orderBy: { lineNo: 'asc' },
          select: {
            id: true,
            lineNo: true,
            sku: true,
            productName: true,
            variationName: true,
            quantity: true,
            quantityDelta: true,
            unitCost: true,
            totalCostDelta: true,
            resultLotCode: true,
          },
        },
      },
    });

    return adjustments.map((adjustment) => ({
      id: adjustment.id,
      adjustmentCode: adjustment.adjustmentCode,
      adjustmentType: adjustment.adjustmentType,
      status: adjustment.status,
      reason: adjustment.reason,
      notes: adjustment.notes,
      happenedAt: adjustment.happenedAt,
      totalItems: adjustment.totalItems,
      totalQuantityDelta: this.toNumber(adjustment.totalQuantityDelta) || 0,
      totalCostDelta: this.toNumber(adjustment.totalCostDelta) || 0,
      currency: adjustment.currency,
      warehouse: adjustment.warehouse,
      location: adjustment.location,
      actorUser: adjustment.actorUser
        ? {
            id: adjustment.actorUser.id,
            name:
              [adjustment.actorUser.firstName, adjustment.actorUser.lastName]
                .filter(Boolean)
                .join(' ') || adjustment.actorUser.email,
            email: adjustment.actorUser.email,
          }
        : null,
      items: adjustment.items.map((item) => ({
        ...item,
        quantity: this.toNumber(item.quantity) || 0,
        quantityDelta: this.toNumber(item.quantityDelta) || 0,
        unitCost: this.toNumber(item.unitCost),
        totalCostDelta: this.toNumber(item.totalCostDelta) || 0,
      })),
    }));
  }

  async createAdjustment(dto: CreateWmsInventoryAdjustmentDto) {
    const actorUserId = this.cls.get('userId') as string | undefined;
    await this.getWarehouseLocationOrThrow(dto.warehouseId, dto.locationId);

    const adjustmentCode = this.buildAdjustmentCode();
    const happenedAt = dto.happenedAt ? new Date(dto.happenedAt) : new Date();
    const currency = this.normalizeText(dto.currency)?.toUpperCase() || 'PHP';
    const isPositive = this.isPositiveAdjustment(dto.adjustmentType);

    const created = await this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.wmsInventoryAdjustment.create({
        data: {
          adjustmentCode,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          actorUserId: actorUserId || null,
          adjustmentType: dto.adjustmentType,
          status: 'POSTED',
          reason: dto.reason.trim(),
          notes: this.normalizeText(dto.notes),
          happenedAt,
          totalItems: dto.items.length,
          currency,
        },
        select: { id: true, adjustmentCode: true },
      });

      let totalQuantityDelta = new Prisma.Decimal(0);
      let totalCostDelta = new Prisma.Decimal(0);

      for (const [index, item] of dto.items.entries()) {
        const sku = item.sku.trim();
        const productName = item.productName.trim();
        const profiledProduct = await this.wmsInventoryUnitsService.resolveProfiledProductContext(
          tx,
          item.sourceProductId,
        );
        const quantity = this.toDecimal(item.quantity);
        const quantityDelta = isPositive ? quantity : quantity.neg();
        totalQuantityDelta = totalQuantityDelta.add(quantityDelta);

        const existingBalance = await tx.wmsInventoryBalance.findUnique({
          where: {
            warehouseId_locationId_sku: {
              warehouseId: dto.warehouseId,
              locationId: dto.locationId,
              sku,
            },
          },
        });

        const onHandBefore = existingBalance?.onHandQuantity || new Prisma.Decimal(0);
        const reservedQuantity = existingBalance?.reservedQuantity || new Prisma.Decimal(0);
        const availableBefore = existingBalance?.availableQuantity || new Prisma.Decimal(0);
        let currentInventoryValue = existingBalance?.inventoryValue || new Prisma.Decimal(0);

        if (!isPositive) {
          if (!existingBalance) {
            throw new ConflictException(`No balance found for SKU ${sku}`);
          }
          if (availableBefore.lt(quantity)) {
            throw new ConflictException(`Not enough available stock for SKU ${sku}`);
          }
        }

        let lineCostDelta = new Prisma.Decimal(0);
        let resultLotId: string | null = null;
        let resultLotCode: string | null = null;

        if (isPositive) {
          const unitCost =
            item.unitCost != null ? this.toDecimal(item.unitCost) : new Prisma.Decimal(0);

          if (unitCost.lte(0)) {
            throw new ConflictException(`Unit cost is required for positive adjustment on SKU ${sku}`);
          }

          lineCostDelta = quantity.mul(unitCost);
          totalCostDelta = totalCostDelta.add(lineCostDelta);

          resultLotCode =
            this.normalizeText(item.lotCode) || this.buildLotCode(adjustment.adjustmentCode, index + 1);

          const lot = await tx.wmsInventoryLot.create({
            data: {
              lotCode: resultLotCode,
              warehouseId: dto.warehouseId,
              receivedLocationId: dto.locationId,
              sku,
              productName,
              variationId: this.normalizeText(item.variationId),
              variationName: this.normalizeText(item.variationName),
              barcode: this.normalizeText(item.barcode),
              status: 'ACTIVE',
              receivedAt: happenedAt,
              initialQuantity: quantity,
              remainingQuantity: quantity,
              unitCost,
              currency,
            },
            select: { id: true, lotCode: true },
          });
          resultLotId = lot.id;

          const costLayer = await tx.wmsInventoryCostLayer.create({
            data: {
              warehouseId: dto.warehouseId,
              lotId: lot.id,
              sku,
              originalQuantity: quantity,
              remainingQuantity: quantity,
              unitCost,
              totalCost: lineCostDelta,
              currency,
              receivedAt: happenedAt,
            },
            select: { id: true },
          });

          const onHandAfter = onHandBefore.add(quantity);
          const availableAfter = onHandAfter.sub(reservedQuantity);
          currentInventoryValue = currentInventoryValue.add(lineCostDelta);

          await tx.wmsInventoryBalance.upsert({
            where: {
              warehouseId_locationId_sku: {
                warehouseId: dto.warehouseId,
                locationId: dto.locationId,
                sku,
              },
            },
            update: {
              productName,
              variationId: this.normalizeText(item.variationId),
              variationName: this.normalizeText(item.variationName),
              barcode: this.normalizeText(item.barcode),
              onHandQuantity: onHandAfter,
              availableQuantity: availableAfter,
              latestUnitCost: unitCost,
              inventoryValue: currentInventoryValue,
            },
            create: {
              warehouseId: dto.warehouseId,
              locationId: dto.locationId,
              sku,
              productName,
              variationId: this.normalizeText(item.variationId),
              variationName: this.normalizeText(item.variationName),
              barcode: this.normalizeText(item.barcode),
              onHandQuantity: quantity,
              reservedQuantity: new Prisma.Decimal(0),
              availableQuantity: quantity,
              latestUnitCost: unitCost,
              inventoryValue: lineCostDelta,
            },
          });

          await tx.wmsInventoryLedger.create({
            data: {
              warehouseId: dto.warehouseId,
              locationId: dto.locationId,
              lotId: lot.id,
              costLayerId: costLayer.id,
              actorUserId: actorUserId || null,
              movementType: this.movementTypeFor(dto.adjustmentType),
              sku,
              productName,
              variationId: this.normalizeText(item.variationId),
              variationName: this.normalizeText(item.variationName),
              barcode: this.normalizeText(item.barcode),
              quantityDelta,
              quantityBefore: onHandBefore,
              quantityAfter: onHandAfter,
              reservedDelta: new Prisma.Decimal(0),
              unitCost,
              totalCost: lineCostDelta,
              currency,
              referenceType: 'INVENTORY_ADJUSTMENT',
              referenceId: adjustment.adjustmentCode,
              notes: this.normalizeText(item.notes) || this.normalizeText(dto.notes),
              happenedAt,
            },
          });

          const adjustmentItem = await tx.wmsInventoryAdjustmentItem.create({
            data: {
              adjustmentId: adjustment.id,
              lineNo: index + 1,
              sku,
              productName,
              variationId: this.normalizeText(item.variationId),
              variationName: this.normalizeText(item.variationName),
              barcode: this.normalizeText(item.barcode),
              quantity,
              quantityDelta,
              unitCost,
              totalCostDelta: lineCostDelta,
              resultLotCode: lot.lotCode,
              resultLotId: lot.id,
              notes: this.normalizeText(item.notes),
            },
            select: { id: true },
          });

          await this.wmsInventoryUnitsService.createInboundUnits({
            tx,
            quantity,
            warehouseId: dto.warehouseId,
            locationId: dto.locationId,
            lotId: lot.id,
            skuProfileId: profiledProduct?.skuProfileId,
            isSerialized: profiledProduct?.isSerialized,
            sourceAdjustmentItemId: adjustmentItem.id,
            sku,
            productName,
            variationId: this.normalizeText(item.variationId),
            variationName: this.normalizeText(item.variationName),
            barcode: this.normalizeText(item.barcode),
            receivedAt: happenedAt,
            movementType: this.movementTypeFor(dto.adjustmentType),
            referenceType: 'INVENTORY_ADJUSTMENT',
            referenceId: adjustment.adjustmentCode,
            metadata: {
              source: 'INVENTORY_ADJUSTMENT',
              adjustmentCode: adjustment.adjustmentCode,
              lineNo: index + 1,
            },
          });
        } else {
          await this.wmsInventoryUnitsService.consumeAvailableUnits({
            tx,
            quantity,
            warehouseId: dto.warehouseId,
            locationId: dto.locationId,
            sku,
            skuProfileId: profiledProduct?.skuProfileId,
            isSerialized: profiledProduct?.isSerialized,
            happenedAt,
            movementType: this.movementTypeFor(dto.adjustmentType),
            status:
              dto.adjustmentType === 'WRITE_OFF' ? 'DAMAGED' : 'ADJUSTED_OUT',
            referenceType: 'INVENTORY_ADJUSTMENT',
            referenceId: adjustment.adjustmentCode,
          });

          const consumedLayers = await this.consumeCostLayersFifo(tx, dto.warehouseId, sku, quantity);
          lineCostDelta = consumedLayers.reduce(
            (sum, layer) => sum.add(layer.totalCost),
            new Prisma.Decimal(0),
          ).neg();
          totalCostDelta = totalCostDelta.add(lineCostDelta);

          const onHandAfter = onHandBefore.sub(quantity);
          const availableAfter = onHandAfter.sub(reservedQuantity);
          currentInventoryValue = currentInventoryValue.sub(lineCostDelta.abs());

          await tx.wmsInventoryBalance.update({
            where: {
              warehouseId_locationId_sku: {
                warehouseId: dto.warehouseId,
                locationId: dto.locationId,
                sku,
              },
            },
            data: {
              productName,
              variationId: this.normalizeText(item.variationId),
              variationName: this.normalizeText(item.variationName),
              barcode: this.normalizeText(item.barcode),
              onHandQuantity: onHandAfter,
              availableQuantity: availableAfter,
              inventoryValue: currentInventoryValue,
            },
          });

          let runningBefore = onHandBefore;
          for (const layer of consumedLayers) {
            const runningAfter = runningBefore.sub(layer.quantity);
            await tx.wmsInventoryLedger.create({
              data: {
                warehouseId: dto.warehouseId,
                locationId: dto.locationId,
                lotId: layer.lotId,
                costLayerId: layer.costLayerId,
                actorUserId: actorUserId || null,
                movementType: this.movementTypeFor(dto.adjustmentType),
                sku,
                productName,
                variationId: this.normalizeText(item.variationId),
                variationName: this.normalizeText(item.variationName),
                barcode: this.normalizeText(item.barcode),
                quantityDelta: layer.quantity.neg(),
                quantityBefore: runningBefore,
                quantityAfter: runningAfter,
                reservedDelta: new Prisma.Decimal(0),
                unitCost: layer.unitCost,
                totalCost: layer.totalCost.neg(),
                currency,
                referenceType: 'INVENTORY_ADJUSTMENT',
                referenceId: adjustment.adjustmentCode,
                notes: this.normalizeText(item.notes) || this.normalizeText(dto.notes),
                happenedAt,
              },
            });
            runningBefore = runningAfter;
          }

          const weightedUnitCost = quantity.gt(0)
            ? lineCostDelta.abs().div(quantity)
            : null;

          await tx.wmsInventoryAdjustmentItem.create({
            data: {
              adjustmentId: adjustment.id,
              lineNo: index + 1,
              sku,
              productName,
              variationId: this.normalizeText(item.variationId),
              variationName: this.normalizeText(item.variationName),
              barcode: this.normalizeText(item.barcode),
              quantity,
              quantityDelta,
              unitCost: weightedUnitCost,
              totalCostDelta: lineCostDelta,
              notes: this.normalizeText(item.notes),
            },
          });
        }
      }

      await tx.wmsInventoryAdjustment.update({
        where: { id: adjustment.id },
        data: {
          totalQuantityDelta,
          totalCostDelta,
        },
      });

      return adjustment.id;
    });

    return this.prisma.wmsInventoryAdjustment.findUniqueOrThrow({
      where: { id: created },
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
        items: {
          orderBy: { lineNo: 'asc' },
          select: {
            id: true,
            lineNo: true,
            sku: true,
            productName: true,
            variationName: true,
            quantity: true,
            quantityDelta: true,
            unitCost: true,
            totalCostDelta: true,
            resultLotCode: true,
          },
        },
      },
    }).then((adjustment) => ({
      id: adjustment.id,
      adjustmentCode: adjustment.adjustmentCode,
      adjustmentType: adjustment.adjustmentType,
      status: adjustment.status,
      reason: adjustment.reason,
      notes: adjustment.notes,
      happenedAt: adjustment.happenedAt,
      totalItems: adjustment.totalItems,
      totalQuantityDelta: this.toNumber(adjustment.totalQuantityDelta) || 0,
      totalCostDelta: this.toNumber(adjustment.totalCostDelta) || 0,
      currency: adjustment.currency,
      warehouse: adjustment.warehouse,
      location: adjustment.location,
      items: adjustment.items.map((item) => ({
        ...item,
        quantity: this.toNumber(item.quantity) || 0,
        quantityDelta: this.toNumber(item.quantityDelta) || 0,
        unitCost: this.toNumber(item.unitCost),
        totalCostDelta: this.toNumber(item.totalCostDelta) || 0,
      })),
    }));
  }
}
