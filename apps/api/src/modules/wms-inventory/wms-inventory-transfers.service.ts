import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { Prisma, WmsLocationType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateWmsInventoryTransferDto } from "./dto/create-wms-inventory-transfer.dto";
import { ListWmsInventoryTransfersDto } from "./dto/list-wms-inventory-transfers.dto";

type TransferGroupUnit = {
  id: string;
  serialNo: bigint;
  batchSequence: number;
  unitBarcode: string;
  sku: string;
  productName: string;
  variationId: string | null;
  variationName: string | null;
  barcode: string | null;
  lotId: string;
  lotCode: string;
  unitCost: Prisma.Decimal;
};

@Injectable()
export class WmsInventoryTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  private normalizeText(value?: string | null) {
    const next = value?.trim();
    return next ? next : null;
  }

  private toDecimal(value: number | string | Prisma.Decimal) {
    return new Prisma.Decimal(value);
  }

  private toNumber(value: Prisma.Decimal | number | string | null | undefined) {
    if (value == null) {
      return null;
    }

    return Number(value);
  }

  private buildTransferCode(transferType: "PUT_AWAY" | "RELOCATION") {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const prefix = transferType === "PUT_AWAY" ? "PUT" : "XFR";
    return `${prefix}-${yyyy}${mm}${dd}-${suffix}`;
  }

  private deriveTransferType(
    fromType: WmsLocationType,
    toType: WmsLocationType,
  ) {
    return fromType === WmsLocationType.RECEIVING &&
      toType === WmsLocationType.STORAGE
      ? "PUT_AWAY"
      : "RELOCATION";
  }

  private async getWarehouseLocationsOrThrow(
    warehouseId: string,
    fromLocationId: string,
    toLocationId: string,
  ) {
    if (fromLocationId === toLocationId) {
      throw new ConflictException(
        "Source and destination locations must be different",
      );
    }

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
      throw new NotFoundException("Warehouse not found");
    }

    if (warehouse.status !== "ACTIVE") {
      throw new ConflictException("Warehouse is not active");
    }

    const [fromLocation, toLocation] = await Promise.all([
      this.prisma.wmsLocation.findFirst({
        where: {
          id: fromLocationId,
          warehouseId,
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          status: true,
        },
      }),
      this.prisma.wmsLocation.findFirst({
        where: {
          id: toLocationId,
          warehouseId,
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          status: true,
        },
      }),
    ]);

    if (!fromLocation) {
      throw new NotFoundException("Source location not found in this warehouse");
    }

    if (!toLocation) {
      throw new NotFoundException(
        "Destination location not found in this warehouse",
      );
    }

    if (fromLocation.status !== "ACTIVE") {
      throw new ConflictException("Source location is not active");
    }

    if (toLocation.status !== "ACTIVE") {
      throw new ConflictException("Destination location is not active");
    }

    return { warehouse, fromLocation, toLocation };
  }

  private mapTransfer(transfer: {
    id: string;
    transferCode: string;
    transferType: "PUT_AWAY" | "RELOCATION";
    notes: string | null;
    happenedAt: Date;
    totalUnits: number;
    warehouse: { id: string; code: string; name: string };
    fromLocation: { id: string; code: string; name: string; type: string };
    toLocation: { id: string; code: string; name: string; type: string };
    actorUser:
      | {
          id: string;
          firstName: string | null;
          lastName: string | null;
          email: string;
        }
      | null;
    items: Array<{
      id: string;
      unitId: string;
      serialNo: bigint;
      batchSequence: number;
      unitBarcode: string;
      sku: string;
      productName: string;
      variationName: string | null;
      lotCode: string | null;
      unitCost: Prisma.Decimal | null;
    }>;
  }) {
    return {
      id: transfer.id,
      transferCode: transfer.transferCode,
      transferType: transfer.transferType,
      notes: transfer.notes,
      happenedAt: transfer.happenedAt,
      totalUnits: transfer.totalUnits,
      warehouse: transfer.warehouse,
      fromLocation: transfer.fromLocation,
      toLocation: transfer.toLocation,
      actorUser: transfer.actorUser
        ? {
            id: transfer.actorUser.id,
            name:
              [transfer.actorUser.firstName, transfer.actorUser.lastName]
                .filter(Boolean)
                .join(" ") || transfer.actorUser.email,
            email: transfer.actorUser.email,
          }
        : null,
      items: transfer.items.map((item) => ({
        id: item.id,
        unitId: item.unitId,
        serialNo: item.serialNo.toString(),
        batchSequence: item.batchSequence,
        unitBarcode: item.unitBarcode,
        sku: item.sku,
        productName: item.productName,
        variationName: item.variationName,
        lotCode: item.lotCode,
        unitCost: this.toNumber(item.unitCost),
      })),
    };
  }

  async listTransfers(query: ListWmsInventoryTransfersDto) {
    const transfers = await this.prisma.wmsInventoryTransfer.findMany({
      where: {
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.fromLocationId
          ? { fromLocationId: query.fromLocationId }
          : {}),
        ...(query.toLocationId ? { toLocationId: query.toLocationId } : {}),
      },
      take: query.limit || 50,
      orderBy: [{ happenedAt: "desc" }, { createdAt: "desc" }],
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        fromLocation: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
        toLocation: {
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
          take: 5,
          orderBy: [{ lineNo: "asc" }],
          select: {
            id: true,
            unitId: true,
            serialNo: true,
            batchSequence: true,
            unitBarcode: true,
            sku: true,
            productName: true,
            variationName: true,
            lotCode: true,
            unitCost: true,
          },
        },
      },
    });

    return transfers.map((transfer) => this.mapTransfer(transfer));
  }

  async createTransfer(dto: CreateWmsInventoryTransferDto) {
    const actorUserId = this.cls.get("userId") as string | undefined;
    const { warehouse, fromLocation, toLocation } =
      await this.getWarehouseLocationsOrThrow(
        dto.warehouseId,
        dto.fromLocationId,
        dto.toLocationId,
      );

    const transferType = this.deriveTransferType(
      fromLocation.type,
      toLocation.type,
    );
    const transferCode = this.buildTransferCode(transferType);
    const happenedAt = new Date();
    const notes = this.normalizeText(dto.notes);

    const createdTransferId = await this.prisma.$transaction(async (tx) => {
      const units = await tx.wmsInventoryUnit.findMany({
        where: {
          id: { in: dto.unitIds },
          warehouseId: dto.warehouseId,
          locationId: dto.fromLocationId,
          status: "AVAILABLE",
        },
        include: {
          lot: {
            select: {
              id: true,
              lotCode: true,
              unitCost: true,
            },
          },
        },
        orderBy: [{ serialNo: "asc" }],
      });

      if (units.length !== dto.unitIds.length) {
        throw new ConflictException(
          "Some selected units are no longer available in the source location",
        );
      }

      const transfer = await tx.wmsInventoryTransfer.create({
        data: {
          transferCode,
          warehouseId: warehouse.id,
          fromLocationId: fromLocation.id,
          toLocationId: toLocation.id,
          actorUserId: actorUserId || null,
          transferType,
          notes,
          happenedAt,
          totalUnits: units.length,
          metadata: {
            sourceLocationType: fromLocation.type,
            destinationLocationType: toLocation.type,
          },
        },
        select: { id: true, transferCode: true },
      });

      const grouped = new Map<
        string,
        {
          sku: string;
          productName: string;
          variationId: string | null;
          variationName: string | null;
          barcode: string | null;
          lotId: string;
          lotCode: string;
          unitCost: Prisma.Decimal;
          units: TransferGroupUnit[];
        }
      >();

      for (const unit of units) {
        const key = unit.lotId;
        const existing = grouped.get(key);
        const nextUnit: TransferGroupUnit = {
          id: unit.id,
          serialNo: unit.serialNo,
          batchSequence: unit.batchSequence,
          unitBarcode: unit.unitBarcode,
          sku: unit.sku,
          productName: unit.productName,
          variationId: unit.variationId,
          variationName: unit.variationName,
          barcode: unit.barcode,
          lotId: unit.lot.id,
          lotCode: unit.lot.lotCode,
          unitCost: unit.lot.unitCost,
        };

        if (existing) {
          existing.units.push(nextUnit);
          continue;
        }

        grouped.set(key, {
          sku: unit.sku,
          productName: unit.productName,
          variationId: unit.variationId,
          variationName: unit.variationName,
          barcode: unit.barcode,
          lotId: unit.lot.id,
          lotCode: unit.lot.lotCode,
          unitCost: unit.lot.unitCost,
          units: [nextUnit],
        });
      }

      for (const [index, unit] of units.entries()) {
        await tx.wmsInventoryTransferItem.create({
          data: {
            transferId: transfer.id,
            lineNo: index + 1,
            unitId: unit.id,
            serialNo: unit.serialNo,
            batchSequence: unit.batchSequence,
            unitBarcode: unit.unitBarcode,
            sku: unit.sku,
            productName: unit.productName,
            variationId: unit.variationId,
            variationName: unit.variationName,
            barcode: unit.barcode,
            lotId: unit.lot.id,
            lotCode: unit.lot.lotCode,
            unitCost: unit.lot.unitCost,
            metadata: {
              fromLocationId: fromLocation.id,
              toLocationId: toLocation.id,
            },
          },
        });
      }

      for (const group of grouped.values()) {
        const quantity = this.toDecimal(group.units.length);
        const totalCost = quantity.mul(group.unitCost);

        const sourceBalance = await tx.wmsInventoryBalance.findUnique({
          where: {
            warehouseId_locationId_sku: {
              warehouseId: warehouse.id,
              locationId: fromLocation.id,
              sku: group.sku,
            },
          },
        });

        if (!sourceBalance) {
          throw new ConflictException(
            `No source balance found for SKU ${group.sku}`,
          );
        }

        if (sourceBalance.availableQuantity.lt(quantity)) {
          throw new ConflictException(
            `Not enough available stock in ${fromLocation.code} for SKU ${group.sku}`,
          );
        }

        const sourceBefore = sourceBalance.onHandQuantity;
        const sourceAfter = sourceBefore.sub(quantity);
        const sourceReserved = sourceBalance.reservedQuantity;
        const sourceAvailableAfter = sourceAfter.sub(sourceReserved);
        const sourceValueBefore =
          sourceBalance.inventoryValue || new Prisma.Decimal(0);
        const sourceValueAfter = sourceValueBefore.sub(totalCost);

        await tx.wmsInventoryBalance.update({
          where: { id: sourceBalance.id },
          data: {
            onHandQuantity: sourceAfter,
            availableQuantity: sourceAvailableAfter,
            inventoryValue: sourceValueAfter,
          },
        });

        const destinationBalance = await tx.wmsInventoryBalance.findUnique({
          where: {
            warehouseId_locationId_sku: {
              warehouseId: warehouse.id,
              locationId: toLocation.id,
              sku: group.sku,
            },
          },
        });

        const destinationBefore =
          destinationBalance?.onHandQuantity || new Prisma.Decimal(0);
        const destinationReserved =
          destinationBalance?.reservedQuantity || new Prisma.Decimal(0);
        const destinationAfter = destinationBefore.add(quantity);
        const destinationAvailableAfter =
          destinationAfter.sub(destinationReserved);
        const destinationValueBefore =
          destinationBalance?.inventoryValue || new Prisma.Decimal(0);
        const destinationValueAfter =
          destinationValueBefore.add(totalCost);

        await tx.wmsInventoryBalance.upsert({
          where: {
            warehouseId_locationId_sku: {
              warehouseId: warehouse.id,
              locationId: toLocation.id,
              sku: group.sku,
            },
          },
          update: {
            productName: group.productName,
            variationId: group.variationId,
            variationName: group.variationName,
            barcode: group.barcode,
            onHandQuantity: destinationAfter,
            availableQuantity: destinationAvailableAfter,
            latestUnitCost: group.unitCost,
            inventoryValue: destinationValueAfter,
          },
          create: {
            warehouseId: warehouse.id,
            locationId: toLocation.id,
            sku: group.sku,
            productName: group.productName,
            variationId: group.variationId,
            variationName: group.variationName,
            barcode: group.barcode,
            onHandQuantity: quantity,
            reservedQuantity: new Prisma.Decimal(0),
            availableQuantity: quantity,
            latestUnitCost: group.unitCost,
            inventoryValue: totalCost,
          },
        });

        await tx.wmsInventoryLedger.create({
          data: {
            warehouseId: warehouse.id,
            locationId: fromLocation.id,
            lotId: group.lotId,
            actorUserId: actorUserId || null,
            movementType: "TRANSFER_OUT",
            sku: group.sku,
            productName: group.productName,
            variationId: group.variationId,
            variationName: group.variationName,
            barcode: group.barcode,
            quantityDelta: quantity.neg(),
            quantityBefore: sourceBefore,
            quantityAfter: sourceAfter,
            reservedDelta: new Prisma.Decimal(0),
            unitCost: group.unitCost,
            totalCost: totalCost.neg(),
            currency: "PHP",
            referenceType: "INVENTORY_TRANSFER",
            referenceId: transfer.transferCode,
            notes,
            happenedAt,
            metadata: {
              transferType,
              fromLocationCode: fromLocation.code,
              toLocationCode: toLocation.code,
              totalUnits: group.units.length,
            },
          },
        });

        await tx.wmsInventoryLedger.create({
          data: {
            warehouseId: warehouse.id,
            locationId: toLocation.id,
            lotId: group.lotId,
            actorUserId: actorUserId || null,
            movementType: "TRANSFER_IN",
            sku: group.sku,
            productName: group.productName,
            variationId: group.variationId,
            variationName: group.variationName,
            barcode: group.barcode,
            quantityDelta: quantity,
            quantityBefore: destinationBefore,
            quantityAfter: destinationAfter,
            reservedDelta: new Prisma.Decimal(0),
            unitCost: group.unitCost,
            totalCost,
            currency: "PHP",
            referenceType: "INVENTORY_TRANSFER",
            referenceId: transfer.transferCode,
            notes,
            happenedAt,
            metadata: {
              transferType,
              fromLocationCode: fromLocation.code,
              toLocationCode: toLocation.code,
              totalUnits: group.units.length,
            },
          },
        });
      }

      await tx.wmsInventoryUnit.updateMany({
        where: {
          id: {
            in: units.map((unit) => unit.id),
          },
        },
        data: {
          locationId: toLocation.id,
          lastMovementType: "TRANSFER_IN",
          lastReferenceType: "INVENTORY_TRANSFER",
          lastReferenceId: transfer.transferCode,
        },
      });

      return transfer.id;
    });

    const transfer = await this.prisma.wmsInventoryTransfer.findUniqueOrThrow({
      where: { id: createdTransferId },
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        fromLocation: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
        toLocation: {
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
          take: 5,
          orderBy: [{ lineNo: "asc" }],
          select: {
            id: true,
            unitId: true,
            serialNo: true,
            batchSequence: true,
            unitBarcode: true,
            sku: true,
            productName: true,
            variationName: true,
            lotCode: true,
            unitCost: true,
          },
        },
      },
    });

    return this.mapTransfer(transfer);
  }
}
