import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Prisma, WmsLocationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWmsStockReceiptDto } from './dto/create-wms-stock-receipt.dto';
import { ListWmsStockReceiptsDto } from './dto/list-wms-stock-receipts.dto';
import { WmsInventoryUnitsService } from '../wms-inventory/wms-inventory-units.service';

@Injectable()
export class WmsPurchasingService {
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

  private buildReceiptCode() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `RCT-${yyyy}${mm}${dd}-${suffix}`;
  }

  private buildLotCode(receiptCode: string, lineNo: number) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${receiptCode}-L${String(lineNo).padStart(2, '0')}-${suffix}`;
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
        type: true,
        status: true,
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

    if (
      location.type !== WmsLocationType.RECEIVING &&
      location.type !== WmsLocationType.STORAGE
    ) {
      throw new ConflictException('Stock receipts can only be posted into receiving or storage locations');
    }

    return { warehouse, location };
  }

  private async getReceiptRequestContextOrThrow(
    tx: Prisma.TransactionClient,
    requestId?: string,
  ) {
    if (!requestId) {
      return null;
    }

    const request = await tx.wmsStockRequest.findUnique({
      where: { id: requestId },
      include: {
        items: {
          orderBy: { lineNo: 'asc' },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Stock request not found');
    }

    const allowedStatuses =
      request.requestType === 'PARTNER_SELF_BUY'
        ? ['AUDIT_ACCEPTED', 'PARTIALLY_RECEIVED']
        : ['PAYMENT_VERIFIED', 'IN_PROCUREMENT', 'PARTIALLY_RECEIVED'];

    if (!allowedStatuses.includes(request.status)) {
      throw new ConflictException(
        request.requestType === 'PARTNER_SELF_BUY'
          ? 'Only audit-accepted self-buy requests can be received'
          : 'Only payment-verified or in-procurement requests can be received',
      );
    }

    return request;
  }

  async listReceipts(query: ListWmsStockReceiptsDto) {
    const receipts = await this.prisma.wmsStockReceipt.findMany({
      where: {
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      take: query.limit || 50,
      orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
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
            unitCost: true,
            totalCost: true,
            lotCode: true,
          },
        },
      },
    });

    return receipts.map((receipt) => ({
      id: receipt.id,
      receiptCode: receipt.receiptCode,
      status: receipt.status,
      supplierName: receipt.supplierName,
      supplierReference: receipt.supplierReference,
      receivedAt: receipt.receivedAt,
      totalItems: receipt.totalItems,
      totalQuantity: this.toNumber(receipt.totalQuantity) || 0,
      totalCost: this.toNumber(receipt.totalCost) || 0,
      currency: receipt.currency,
      warehouse: receipt.warehouse,
      location: receipt.location,
      actorUser: receipt.actorUser
        ? {
            id: receipt.actorUser.id,
            name:
              [receipt.actorUser.firstName, receipt.actorUser.lastName].filter(Boolean).join(' ') ||
              receipt.actorUser.email,
            email: receipt.actorUser.email,
          }
        : null,
      items: receipt.items.map((item) => ({
        ...item,
        quantity: this.toNumber(item.quantity) || 0,
        unitCost: this.toNumber(item.unitCost) || 0,
        totalCost: this.toNumber(item.totalCost) || 0,
      })),
    }));
  }

  async createReceipt(dto: CreateWmsStockReceiptDto) {
    const actorUserId = this.cls.get('userId') as string | undefined;
    await this.getWarehouseLocationOrThrow(dto.warehouseId, dto.locationId);

    const currency = this.normalizeText(dto.currency)?.toUpperCase() || 'PHP';
    const receiptCode = this.buildReceiptCode();
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
    const totalItems = dto.items.length;
    const totalQuantity = dto.items.reduce(
      (sum, item) => sum.add(this.toDecimal(item.quantity)),
      new Prisma.Decimal(0),
    );
    const totalCost = dto.items.reduce(
      (sum, item) => sum.add(this.toDecimal(item.quantity).mul(this.toDecimal(item.unitCost))),
      new Prisma.Decimal(0),
    );

    const createdReceipt = await this.prisma.$transaction(async (tx) => {
      const requestContext = await this.getReceiptRequestContextOrThrow(tx, dto.requestId);
      const receipt = await tx.wmsStockReceipt.create({
        data: {
          receiptCode,
          requestId: dto.requestId || null,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          actorUserId: actorUserId || null,
          status: 'POSTED',
          supplierName: this.normalizeText(dto.supplierName),
          supplierReference: this.normalizeText(dto.supplierReference),
          notes: this.normalizeText(dto.notes),
          receivedAt,
          totalItems,
          totalQuantity,
          totalCost,
          currency,
        },
        select: { id: true, receiptCode: true },
      });

      for (const [index, item] of dto.items.entries()) {
        const requestLine = item.requestLineId
          ? requestContext?.items.find((entry) => entry.id === item.requestLineId)
          : null;

        if (requestContext && !item.requestLineId) {
          throw new BadRequestException('Request-driven receipts require a request line for every item');
        }

        if (item.requestLineId && !requestLine) {
          throw new BadRequestException('Receipt item references an invalid request line');
        }

        if (requestLine) {
          const receivableTarget =
            requestContext?.requestType === 'PARTNER_SELF_BUY'
              ? requestLine.acceptedQuantity
              : requestLine.requestedQuantity;
          const remainingReceivable = receivableTarget.sub(
            requestLine.receivedQuantity,
          );
          if (remainingReceivable.lessThan(this.toDecimal(item.quantity))) {
            throw new ConflictException(`Receipt quantity exceeds remaining request quantity for ${requestLine.productName}`);
          }
        }

        const profiledProduct = await this.wmsInventoryUnitsService.resolveProfiledProductContext(
          tx,
          item.sourceProductId,
        );
        const quantity = this.toDecimal(item.quantity);
        const unitCost = this.toDecimal(item.unitCost);
        const lineTotalCost = quantity.mul(unitCost);
        const lotCode = this.normalizeText(item.lotCode) || this.buildLotCode(receipt.receiptCode, index + 1);

        const lot = await tx.wmsInventoryLot.create({
          data: {
            lotCode,
            warehouseId: dto.warehouseId,
            receivedLocationId: dto.locationId,
            sku: item.sku.trim(),
            productName: item.productName.trim(),
            variationId: this.normalizeText(item.variationId),
            variationName: this.normalizeText(item.variationName),
            barcode: this.normalizeText(item.barcode),
            supplierBatchNo: this.normalizeText(item.supplierBatchNo),
            status: 'ACTIVE',
            receivedAt,
            initialQuantity: quantity,
            remainingQuantity: quantity,
            unitCost,
            currency,
          },
          select: { id: true, lotCode: true },
        });

        const costLayer = await tx.wmsInventoryCostLayer.create({
          data: {
            warehouseId: dto.warehouseId,
            lotId: lot.id,
            sku: item.sku.trim(),
            originalQuantity: quantity,
            remainingQuantity: quantity,
            unitCost,
            totalCost: lineTotalCost,
            currency,
            receivedAt,
          },
          select: { id: true },
        });

        const existingBalance = await tx.wmsInventoryBalance.findUnique({
          where: {
            warehouseId_locationId_sku: {
              warehouseId: dto.warehouseId,
              locationId: dto.locationId,
              sku: item.sku.trim(),
            },
          },
        });

        const quantityBefore = existingBalance?.onHandQuantity || new Prisma.Decimal(0);
        const quantityAfter = quantityBefore.add(quantity);
        const reservedQuantity = existingBalance?.reservedQuantity || new Prisma.Decimal(0);
        const availableQuantity = quantityAfter.sub(reservedQuantity);
        const currentValue = existingBalance?.inventoryValue || new Prisma.Decimal(0);
        const inventoryValue = currentValue.add(lineTotalCost);

        await tx.wmsInventoryBalance.upsert({
          where: {
            warehouseId_locationId_sku: {
              warehouseId: dto.warehouseId,
              locationId: dto.locationId,
              sku: item.sku.trim(),
            },
          },
          update: {
            productName: item.productName.trim(),
            variationId: this.normalizeText(item.variationId),
            variationName: this.normalizeText(item.variationName),
            barcode: this.normalizeText(item.barcode),
            onHandQuantity: quantityAfter,
            availableQuantity,
            latestUnitCost: unitCost,
            inventoryValue,
          },
          create: {
            warehouseId: dto.warehouseId,
            locationId: dto.locationId,
            sku: item.sku.trim(),
            productName: item.productName.trim(),
            variationId: this.normalizeText(item.variationId),
            variationName: this.normalizeText(item.variationName),
            barcode: this.normalizeText(item.barcode),
            onHandQuantity: quantity,
            reservedQuantity: new Prisma.Decimal(0),
            availableQuantity: quantity,
            latestUnitCost: unitCost,
            inventoryValue: lineTotalCost,
          },
        });

        const receiptItem = await tx.wmsStockReceiptItem.create({
          data: {
            receiptId: receipt.id,
            requestLineId: item.requestLineId || null,
            lineNo: index + 1,
            sku: item.sku.trim(),
            productName: item.productName.trim(),
            variationId: this.normalizeText(item.variationId),
            variationName: this.normalizeText(item.variationName),
            barcode: this.normalizeText(item.barcode),
            quantity,
            unitCost,
            totalCost: lineTotalCost,
            currency,
            lotCode: lot.lotCode,
            supplierBatchNo: this.normalizeText(item.supplierBatchNo),
            lotId: lot.id,
            costLayerId: costLayer.id,
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
          receiptItemId: receiptItem.id,
          sku: item.sku.trim(),
          productName: item.productName.trim(),
          variationId: this.normalizeText(item.variationId),
          variationName: this.normalizeText(item.variationName),
          barcode: this.normalizeText(item.barcode),
          receivedAt,
          movementType: 'RECEIPT',
          referenceType: 'STOCK_RECEIPT',
          referenceId: receipt.receiptCode,
          isSerialized: profiledProduct?.isSerialized,
          metadata: {
            source: 'RECEIPT',
            receiptCode: receipt.receiptCode,
            lineNo: index + 1,
          },
        });

        await tx.wmsInventoryLedger.create({
          data: {
            warehouseId: dto.warehouseId,
            locationId: dto.locationId,
            lotId: lot.id,
            costLayerId: costLayer.id,
            actorUserId: actorUserId || null,
            movementType: 'RECEIPT',
            sku: item.sku.trim(),
            productName: item.productName.trim(),
            variationId: this.normalizeText(item.variationId),
            variationName: this.normalizeText(item.variationName),
            barcode: this.normalizeText(item.barcode),
            quantityDelta: quantity,
            quantityBefore,
            quantityAfter,
            reservedDelta: new Prisma.Decimal(0),
            unitCost,
            totalCost: lineTotalCost,
            currency,
            referenceType: 'STOCK_RECEIPT',
            referenceId: receipt.receiptCode,
            notes: this.normalizeText(dto.notes),
            happenedAt: receivedAt,
          },
        });

        if (requestLine) {
          await tx.wmsStockRequestLine.update({
            where: { id: requestLine.id },
            data: {
              receivedQuantity: requestLine.receivedQuantity.add(quantity),
            },
          });
        }
      }

      if (requestContext) {
        const refreshedLines = await tx.wmsStockRequestLine.findMany({
          where: { requestId: requestContext.id, isActive: true },
          select: {
            id: true,
            requestedQuantity: true,
            acceptedQuantity: true,
            receivedQuantity: true,
          },
        });

        const isFullyReceived = refreshedLines.every((line) =>
          line.receivedQuantity.greaterThanOrEqualTo(
            requestContext.requestType === 'PARTNER_SELF_BUY'
              ? line.acceptedQuantity
              : line.requestedQuantity,
          ),
        );
        const hasAnyReceipt = refreshedLines.some((line) =>
          line.receivedQuantity.greaterThan(new Prisma.Decimal(0)),
        );

        await tx.wmsStockRequest.update({
          where: { id: requestContext.id },
          data: {
            status: isFullyReceived
              ? 'RECEIVED'
              : hasAnyReceipt
                ? 'PARTIALLY_RECEIVED'
                : requestContext.status,
            receivedAt: hasAnyReceipt ? receivedAt : null,
          },
        });
      }

      return receipt;
    });

    return this.prisma.wmsStockReceipt.findUniqueOrThrow({
      where: { id: createdReceipt.id },
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
            unitCost: true,
            totalCost: true,
            lotCode: true,
          },
        },
      },
    }).then((receipt) => ({
      id: receipt.id,
      receiptCode: receipt.receiptCode,
      status: receipt.status,
      supplierName: receipt.supplierName,
      supplierReference: receipt.supplierReference,
      receivedAt: receipt.receivedAt,
      totalItems: receipt.totalItems,
      totalQuantity: this.toNumber(receipt.totalQuantity) || 0,
      totalCost: this.toNumber(receipt.totalCost) || 0,
      currency: receipt.currency,
      warehouse: receipt.warehouse,
      location: receipt.location,
      items: receipt.items.map((item) => ({
        ...item,
        quantity: this.toNumber(item.quantity) || 0,
        unitCost: this.toNumber(item.unitCost) || 0,
        totalCost: this.toNumber(item.totalCost) || 0,
      })),
    }));
  }
}
