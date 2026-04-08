import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  WmsInventoryMovementType,
  WmsInventoryUnitStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { generateWmsInventoryUnitBarcodeFromSerial } from "../../common/utils/wms-barcode.util";

type TxClient = Prisma.TransactionClient;

type ProfiledProductContext = {
  posProductId: string;
  skuProfileId: string;
  isSerialized: boolean;
};

type CreateInboundUnitsInput = {
  tx: TxClient;
  quantity: Prisma.Decimal;
  warehouseId: string;
  locationId: string;
  lotId: string;
  sku: string;
  productName: string;
  variationId?: string | null;
  variationName?: string | null;
  barcode?: string | null;
  receivedAt: Date;
  movementType: WmsInventoryMovementType;
  referenceType: string;
  referenceId: string;
  skuProfileId?: string | null;
  isSerialized?: boolean;
  receiptItemId?: string | null;
  sourceAdjustmentItemId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type ConsumeUnitsInput = {
  tx: TxClient;
  quantity: Prisma.Decimal;
  warehouseId: string;
  locationId: string;
  sku: string;
  happenedAt: Date;
  movementType: WmsInventoryMovementType;
  status: WmsInventoryUnitStatus;
  referenceType: string;
  referenceId: string;
  skuProfileId?: string | null;
  isSerialized?: boolean;
};

@Injectable()
export class WmsInventoryUnitsService {
  private async reserveNextUnitSerial(tx: TxClient) {
    const rows = await tx.$queryRaw<Array<{ next_value: bigint | number | string }>>`
      SELECT nextval('"wms_inventory_units_serialNo_seq"')::bigint AS next_value
    `;

    const nextValue = rows[0]?.next_value;
    if (nextValue == null) {
      throw new ConflictException("Unable to reserve the next unit serial number");
    }

    return BigInt(`${nextValue}`);
  }

  private normalizeText(value?: string | null) {
    const next = value?.trim();
    return next ? next : null;
  }

  private ensureWholeUnitQuantity(quantity: Prisma.Decimal, contextLabel: string) {
    if (!quantity.mod(1).eq(0)) {
      throw new ConflictException(
        `${contextLabel} must use a whole-number quantity for serialized stock`,
      );
    }

    if (quantity.lte(0)) {
      throw new ConflictException(
        `${contextLabel} must use a quantity greater than zero`,
      );
    }
  }

  async resolveProfiledProductContext(
    tx: TxClient,
    sourceProductId?: string | null,
    options?: { allowMissingProfile?: boolean },
  ): Promise<ProfiledProductContext | null> {
    const nextSourceProductId = this.normalizeText(sourceProductId);
    if (!nextSourceProductId) {
      return null;
    }

    const product = await tx.posProduct.findUnique({
      where: { id: nextSourceProductId },
      select: {
        id: true,
        wmsSkuProfile: {
          select: {
            id: true,
            status: true,
            isSerialized: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException("Profiled product not found");
    }

    if (!product.wmsSkuProfile) {
      if (options?.allowMissingProfile) {
        return null;
      }
      throw new ConflictException("Selected product has no WMS SKU profile");
    }

    if (product.wmsSkuProfile.status !== "ACTIVE") {
      throw new ConflictException(
        "Selected product is not active for warehouse execution",
      );
    }

    return {
      posProductId: product.id,
      skuProfileId: product.wmsSkuProfile.id,
      isSerialized: product.wmsSkuProfile.isSerialized,
    };
  }

  async createInboundUnits(input: CreateInboundUnitsInput) {
    if (!input.skuProfileId || !input.isSerialized) {
      return [];
    }

    this.ensureWholeUnitQuantity(
      input.quantity,
      `Inbound posting for ${input.sku}`,
    );

    const count = input.quantity.toNumber();
    const createdUnitIds: string[] = [];

    for (let unitIndex = 0; unitIndex < count; unitIndex += 1) {
      const id = randomUUID();
      const serialNo = await this.reserveNextUnitSerial(input.tx);
      const batchSequence = unitIndex + 1;
      const unitBarcode = generateWmsInventoryUnitBarcodeFromSerial(serialNo);

      await input.tx.wmsInventoryUnit.create({
        data: {
          id,
          serialNo,
          batchSequence,
          unitBarcode,
          warehouseId: input.warehouseId,
          locationId: input.locationId,
          lotId: input.lotId,
          skuProfileId: input.skuProfileId,
          receiptItemId: input.receiptItemId || null,
          sourceAdjustmentItemId: input.sourceAdjustmentItemId || null,
          sku: input.sku,
          productName: input.productName,
          variationId: this.normalizeText(input.variationId),
          variationName: this.normalizeText(input.variationName),
          barcode: this.normalizeText(input.barcode),
          status: "AVAILABLE",
          lastMovementType: input.movementType,
          lastReferenceType: input.referenceType,
          lastReferenceId: input.referenceId,
          receivedAt: input.receivedAt,
          metadata: {
            ...(typeof input.metadata === "object" && input.metadata
              ? (input.metadata as Record<string, unknown>)
              : {}),
            serialNo: serialNo.toString(),
            batchSequence,
          },
        },
        select: { id: true },
      });

      createdUnitIds.push(id);
    }

    return createdUnitIds;
  }

  async consumeAvailableUnits(input: ConsumeUnitsInput) {
    if (!input.skuProfileId || !input.isSerialized) {
      return [];
    }

    this.ensureWholeUnitQuantity(
      input.quantity,
      `Outbound posting for ${input.sku}`,
    );

    const requestedCount = input.quantity.toNumber();
    const units = await input.tx.wmsInventoryUnit.findMany({
      where: {
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        skuProfileId: input.skuProfileId,
        status: "AVAILABLE",
      },
      orderBy: [{ receivedAt: "asc" }, { serialNo: "asc" }],
      take: requestedCount,
      select: {
        id: true,
        unitBarcode: true,
      },
    });

    if (units.length < requestedCount) {
      throw new ConflictException(
        `Not enough serialized units available for SKU ${input.sku}`,
      );
    }

    await input.tx.wmsInventoryUnit.updateMany({
      where: {
        id: {
          in: units.map((unit) => unit.id),
        },
      },
      data: {
        status: input.status,
        lastMovementType: input.movementType,
        lastReferenceType: input.referenceType,
        lastReferenceId: input.referenceId,
        consumedAt: input.happenedAt,
      },
    });

    return units;
  }
}
