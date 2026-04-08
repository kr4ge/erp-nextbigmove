import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListWmsInventoryBalancesDto } from './dto/list-wms-inventory-balances.dto';
import { ListWmsInventoryLedgerDto } from './dto/list-wms-inventory-ledger.dto';
import { ListWmsInventoryLotsDto } from './dto/list-wms-inventory-lots.dto';
import { ListWmsInventoryUnitsDto } from './dto/list-wms-inventory-units.dto';

@Injectable()
export class WmsInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: Prisma.Decimal | number | string | null | undefined) {
    if (value == null) {
      return null;
    }

    return Number(value);
  }

  private normalizeSearch(value?: string) {
    const next = value?.trim();
    return next ? next : undefined;
  }

  private buildSearchWhere(search?: string): Prisma.WmsInventoryBalanceWhereInput[] {
    const normalized = this.normalizeSearch(search);

    if (!normalized) {
      return [];
    }

    return [
      { sku: { contains: normalized, mode: 'insensitive' } },
      { productName: { contains: normalized, mode: 'insensitive' } },
      { variationName: { contains: normalized, mode: 'insensitive' } },
      { barcode: { contains: normalized, mode: 'insensitive' } },
    ];
  }

  private buildUnitSearchWhere(search?: string): Prisma.WmsInventoryUnitWhereInput[] {
    const normalized = this.normalizeSearch(search);

    if (!normalized) {
      return [];
    }

    return [
      { unitBarcode: { contains: normalized, mode: 'insensitive' } },
      { sku: { contains: normalized, mode: 'insensitive' } },
      { productName: { contains: normalized, mode: 'insensitive' } },
      { variationName: { contains: normalized, mode: 'insensitive' } },
      { lot: { lotCode: { contains: normalized, mode: 'insensitive' } } },
      { lastReferenceId: { contains: normalized, mode: 'insensitive' } },
    ];
  }

  async getOverview() {
    const [warehousesCount, locationsCount, lotsCount, balancesCount, ledgerCount, defaultWarehouse] =
      await Promise.all([
        this.prisma.wmsWarehouse.count(),
        this.prisma.wmsLocation.count(),
        this.prisma.wmsInventoryLot.count(),
        this.prisma.wmsInventoryBalance.count(),
        this.prisma.wmsInventoryLedger.count(),
        this.prisma.wmsWarehouse.findFirst({
          where: { isDefault: true },
          include: {
            _count: {
              select: {
                locations: true,
                inventoryLots: true,
                inventoryBalances: true,
                inventoryLedgerEntries: true,
              },
            },
          },
        }),
      ]);

    return {
      warehousesCount,
      locationsCount,
      lotsCount,
      balancesCount,
      ledgerCount,
      defaultWarehouse: defaultWarehouse
        ? {
            id: defaultWarehouse.id,
            code: defaultWarehouse.code,
            name: defaultWarehouse.name,
            status: defaultWarehouse.status,
            locationsCount: defaultWarehouse._count.locations,
            lotsCount: defaultWarehouse._count.inventoryLots,
            balancesCount: defaultWarehouse._count.inventoryBalances,
            ledgerCount: defaultWarehouse._count.inventoryLedgerEntries,
          }
        : null,
    };
  }

  async listBalances(query: ListWmsInventoryBalancesDto) {
    const searchWhere = this.buildSearchWhere(query.search);

    const balances = await this.prisma.wmsInventoryBalance.findMany({
      where: {
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.locationId ? { locationId: query.locationId } : {}),
        ...(searchWhere.length > 0 ? { OR: searchWhere } : {}),
      },
      orderBy: [{ warehouse: { name: 'asc' } }, { location: { sortOrder: 'asc' } }, { sku: 'asc' }],
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
      },
    });

    return balances.map((balance) => ({
      id: balance.id,
      sku: balance.sku,
      productName: balance.productName,
      variationId: balance.variationId,
      variationName: balance.variationName,
      barcode: balance.barcode,
      onHandQuantity: this.toNumber(balance.onHandQuantity) || 0,
      reservedQuantity: this.toNumber(balance.reservedQuantity) || 0,
      availableQuantity: this.toNumber(balance.availableQuantity) || 0,
      latestUnitCost: this.toNumber(balance.latestUnitCost),
      inventoryValue: this.toNumber(balance.inventoryValue),
      updatedAt: balance.updatedAt,
      warehouse: balance.warehouse,
      location: balance.location,
    }));
  }

  async listLots(query: ListWmsInventoryLotsDto) {
    const normalizedSearch = this.normalizeSearch(query.search);

    const lots = await this.prisma.wmsInventoryLot.findMany({
      where: {
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(normalizedSearch
          ? {
              OR: [
                { lotCode: { contains: normalizedSearch, mode: 'insensitive' } },
                { sku: { contains: normalizedSearch, mode: 'insensitive' } },
                { productName: { contains: normalizedSearch, mode: 'insensitive' } },
                { variationName: { contains: normalizedSearch, mode: 'insensitive' } },
                { barcode: { contains: normalizedSearch, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: query.limit || 100,
      orderBy: [{ receivedAt: 'desc' }, { lotCode: 'asc' }],
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        receivedLocation: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            costLayers: true,
            ledgerEntries: true,
          },
        },
      },
    });

    return lots.map((lot) => ({
      id: lot.id,
      lotCode: lot.lotCode,
      sku: lot.sku,
      productName: lot.productName,
      variationId: lot.variationId,
      variationName: lot.variationName,
      barcode: lot.barcode,
      supplierBatchNo: lot.supplierBatchNo,
      status: lot.status,
      receivedAt: lot.receivedAt,
      expiresAt: lot.expiresAt,
      initialQuantity: this.toNumber(lot.initialQuantity) || 0,
      remainingQuantity: this.toNumber(lot.remainingQuantity) || 0,
      unitCost: this.toNumber(lot.unitCost) || 0,
      currency: lot.currency,
      warehouse: lot.warehouse,
      receivedLocation: lot.receivedLocation,
      costLayerCount: lot._count.costLayers,
      ledgerEntryCount: lot._count.ledgerEntries,
    }));
  }

  async listUnits(query: ListWmsInventoryUnitsDto) {
    const searchWhere = this.buildUnitSearchWhere(query.search);

    const units = await this.prisma.wmsInventoryUnit.findMany({
      where: {
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.locationId ? { locationId: query.locationId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(searchWhere.length > 0 ? { OR: searchWhere } : {}),
      },
      take: 300,
      orderBy: [{ receivedAt: 'desc' }, { batchSequence: 'asc' }, { serialNo: 'asc' }],
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
        lot: {
          select: {
            id: true,
            lotCode: true,
            unitCost: true,
            supplierBatchNo: true,
          },
        },
        skuProfile: {
          select: {
            id: true,
            code: true,
            barcode: true,
            isSerialized: true,
          },
        },
        receiptItem: {
          select: {
            id: true,
            lineNo: true,
            receipt: {
              select: {
                id: true,
                receiptCode: true,
              },
            },
          },
        },
        sourceAdjustmentItem: {
          select: {
            id: true,
            lineNo: true,
            adjustment: {
              select: {
                id: true,
                adjustmentCode: true,
              },
            },
          },
        },
      },
    });

    return units.map((unit) => ({
      id: unit.id,
      serialNo: unit.serialNo.toString(),
      batchSequence: unit.batchSequence,
      unitBarcode: unit.unitBarcode,
      sku: unit.sku,
      productName: unit.productName,
      variationId: unit.variationId,
      variationName: unit.variationName,
      barcode: unit.barcode,
      status: unit.status,
      lastMovementType: unit.lastMovementType,
      lastReferenceType: unit.lastReferenceType,
      lastReferenceId: unit.lastReferenceId,
      receivedAt: unit.receivedAt,
      consumedAt: unit.consumedAt,
      warehouse: unit.warehouse,
      location: unit.location,
      lot: {
        id: unit.lot.id,
        lotCode: unit.lot.lotCode,
        unitCost: this.toNumber(unit.lot.unitCost) || 0,
        supplierBatchNo: unit.lot.supplierBatchNo,
      },
      skuProfile: unit.skuProfile,
      receiptSource: unit.receiptItem
        ? {
            id: unit.receiptItem.receipt.id,
            receiptCode: unit.receiptItem.receipt.receiptCode,
            lineNo: unit.receiptItem.lineNo,
          }
        : null,
      adjustmentSource: unit.sourceAdjustmentItem
        ? {
            id: unit.sourceAdjustmentItem.adjustment.id,
            adjustmentCode: unit.sourceAdjustmentItem.adjustment.adjustmentCode,
            lineNo: unit.sourceAdjustmentItem.lineNo,
          }
        : null,
    }));
  }

  async listLedger(query: ListWmsInventoryLedgerDto) {
    const normalizedSearch = this.normalizeSearch(query.search);

    const ledger = await this.prisma.wmsInventoryLedger.findMany({
      where: {
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.locationId ? { locationId: query.locationId } : {}),
        ...(query.movementType ? { movementType: query.movementType } : {}),
        ...(normalizedSearch
          ? {
              OR: [
                { sku: { contains: normalizedSearch, mode: 'insensitive' } },
                { productName: { contains: normalizedSearch, mode: 'insensitive' } },
                { variationName: { contains: normalizedSearch, mode: 'insensitive' } },
                { referenceId: { contains: normalizedSearch, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: query.limit || 100,
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
        lot: {
          select: {
            id: true,
            lotCode: true,
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
      },
    });

    return ledger.map((entry) => ({
      id: entry.id,
      movementType: entry.movementType,
      sku: entry.sku,
      productName: entry.productName,
      variationId: entry.variationId,
      variationName: entry.variationName,
      barcode: entry.barcode,
      quantityDelta: this.toNumber(entry.quantityDelta) || 0,
      quantityBefore: this.toNumber(entry.quantityBefore) || 0,
      quantityAfter: this.toNumber(entry.quantityAfter) || 0,
      reservedDelta: this.toNumber(entry.reservedDelta) || 0,
      unitCost: this.toNumber(entry.unitCost),
      totalCost: this.toNumber(entry.totalCost),
      currency: entry.currency,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      notes: entry.notes,
      happenedAt: entry.happenedAt,
      warehouse: entry.warehouse,
      location: entry.location,
      lot: entry.lot,
      actorUser: entry.actorUser
        ? {
            id: entry.actorUser.id,
            name: [entry.actorUser.firstName, entry.actorUser.lastName].filter(Boolean).join(' ') || entry.actorUser.email,
            email: entry.actorUser.email,
          }
        : null,
    }));
  }
}
