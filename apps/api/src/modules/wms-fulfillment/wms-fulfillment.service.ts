import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  WmsFulfillmentOrderStatus,
  WmsFulfillmentScanResult,
  WmsFulfillmentScanStage,
  WmsInventoryMovementType,
  WmsInventoryUnitStatus,
} from "@prisma/client";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  AssignWmsPackingDto,
  CreateWmsPackingStationDto,
  ListWmsFulfillmentOrdersDto,
  ScanWmsFulfillmentUnitDto,
  SetWmsFulfillmentOrderStatusDto,
  StartWmsFulfillmentSessionDto,
  SyncWmsFulfillmentIntakeDto,
  UpdateWmsPackingStationDto,
} from "./dto";

type TxClient = Prisma.TransactionClient;

type ParsedOrderItem = {
  lineNo: number;
  sourceProductId: string | null;
  variationId: string | null;
  productName: string;
  variationName: string | null;
  displayCode: string | null;
  quantity: number;
};

type AvailabilityMaps = {
  byWarehouseVariation: Map<string, number>;
  byVariation: Map<string, number>;
};

type OrderMutationRecord = Prisma.WmsFulfillmentOrderGetPayload<{
  include: {
    items: {
      orderBy: { lineNo: "asc" };
    };
    unitAssignments: {
      include: {
        unit: true;
      };
    };
    packingStation: {
      include: {
        assignedUsers: {
          include: {
            user: {
              select: {
                id: true;
                firstName: true;
                lastName: true;
                email: true;
              };
            };
          };
        };
      };
    };
  };
}>;

const FULFILLMENT_EXCLUDED_POS_STATUSES = new Set([7, 4, 5, 6, 2, 3]);
const PICKING_VIEW_STATUSES: WmsFulfillmentOrderStatus[] = [
  "PENDING",
  "WAITING_FOR_STOCK",
  "PICKING",
  "PICKED",
  "HOLD",
];
const PACKING_VIEW_STATUSES: WmsFulfillmentOrderStatus[] = [
  "PACKING_PENDING",
  "PACKING_ASSIGNED",
  "PACKING",
  "PACKED",
];
const DISPATCH_VIEW_STATUSES: WmsFulfillmentOrderStatus[] = [
  "PACKED",
  "DISPATCHED",
];
const PICKABLE_STATUSES: WmsFulfillmentOrderStatus[] = [
  "PENDING",
  "WAITING_FOR_STOCK",
  "PICKING",
  "HOLD",
];
const PACKABLE_STATUSES: WmsFulfillmentOrderStatus[] = [
  "PACKING_PENDING",
  "PACKING_ASSIGNED",
  "PACKING",
];
const ACTIVE_FULFILLMENT_STATUSES: WmsFulfillmentOrderStatus[] = [
  "PENDING",
  "WAITING_FOR_STOCK",
  "PICKING",
  "PICKED",
  "PACKING_PENDING",
  "PACKING_ASSIGNED",
  "PACKING",
  "PACKED",
  "HOLD",
];
const DISPATCHABLE_UNIT_STATUSES: WmsInventoryUnitStatus[] = [
  WmsInventoryUnitStatus.PICKED,
  WmsInventoryUnitStatus.PACKED,
];

@Injectable()
export class WmsFulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  private getActorUserId() {
    return this.cls.get("userId") as string | undefined;
  }

  private getReader(client?: TxClient) {
    return client || this.prisma;
  }

  private normalizeText(value?: string | null) {
    const next = value?.trim();
    return next ? next : null;
  }

  private toObject(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private toText(value: unknown) {
    if (typeof value === "string") {
      const next = value.trim();
      return next || null;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    return null;
  }

  private toCount(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value));
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    }

    return 0;
  }

  private toNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ) {
    if (value == null) {
      return null;
    }

    return Number(value);
  }

  private extractStatusTimestampFromHistory(
    statusHistory: Prisma.JsonValue | null | undefined,
    targetStatus: number,
  ) {
    if (!Array.isArray(statusHistory) || statusHistory.length === 0) {
      return null;
    }

    let earliestRaw: string | null = null;
    let earliestTs = Number.POSITIVE_INFINITY;
    let fallbackRaw: string | null = null;

    for (const entry of statusHistory) {
      const item = this.toObject(entry as Prisma.JsonValue | null);
      if (!item) {
        continue;
      }

      const rawStatus =
        typeof item.status === "number"
          ? item.status
          : Number(this.toText(item.status));

      if (!Number.isFinite(rawStatus) || rawStatus !== targetStatus) {
        continue;
      }

      const updatedRaw = this.toText(item.updated_at || item.updatedAt);
      if (!updatedRaw) {
        continue;
      }

      fallbackRaw = fallbackRaw ?? updatedRaw;
      const updatedAt = Date.parse(updatedRaw);
      if (!Number.isNaN(updatedAt) && updatedAt < earliestTs) {
        earliestTs = updatedAt;
        earliestRaw = updatedRaw;
      }
    }

    const pickedRaw = earliestRaw ?? fallbackRaw;
    if (!pickedRaw) {
      return null;
    }

    const parsed = new Date(pickedRaw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private resolveDispatchTimestamp(input: {
    posStatus?: number | null;
    statusHistory?: Prisma.JsonValue | null;
    posUpdatedAt?: Date | null;
  }) {
    const statusHistoryTimestamp = this.extractStatusTimestampFromHistory(
      input.statusHistory,
      2,
    );

    if (statusHistoryTimestamp) {
      return statusHistoryTimestamp;
    }

    if (input.posStatus === 2) {
      return input.posUpdatedAt || new Date();
    }

    return null;
  }

  private buildFulfillmentCode() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `FUL-${stamp}-${suffix}`;
  }

  private buildStationCode(input: string) {
    return input
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase();
  }

  private buildWarehouseVariationKey(
    warehouseId?: string | null,
    variationId?: string | null,
  ) {
    if (!warehouseId || !variationId) {
      return null;
    }

    return `${warehouseId}::${variationId}`;
  }

  private formatUserName(user?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null) {
    if (!user) {
      return null;
    }

    return (
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.email
    );
  }

  private extractWarehouseId(snapshot: Prisma.JsonValue | null | undefined) {
    const value = this.toObject(snapshot);
    const rawWarehouseId = value?.warehouse_id ?? value?.warehouseId;
    return this.toText(rawWarehouseId);
  }

  private extractVariationLabel(value: unknown) {
    if (!Array.isArray(value)) {
      return null;
    }

    const parts = value
      .map((entry) => {
        const item = this.toObject(entry as Prisma.JsonValue | null);
        if (!item) {
          return null;
        }

        return this.toText(item.value || item.keyValue || item.name);
      })
      .filter((entry): entry is string => Boolean(entry));

    return parts.length ? parts.join(" / ") : null;
  }

  private parseSnapshotItems(value: unknown): ParsedOrderItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry, index) => {
        const item = this.toObject(entry as Prisma.JsonValue | null);
        if (!item) {
          return null;
        }

        const variation = this.toObject(
          (item.variation_info || item.variationInfo) as Prisma.JsonValue | null,
        );
        const quantity = this.toCount(item.quantity);
        const variationName =
          this.toText(variation?.detail) ||
          this.extractVariationLabel(variation?.fields) ||
          null;
        const productName =
          this.toText(variation?.name) ||
          this.toText(item.note_product || item.noteProduct) ||
          this.toText(item.name) ||
          "Unlabeled item";

        return {
          lineNo: index + 1,
          sourceProductId: this.toText(item.product_id || item.productId),
          variationId: this.toText(item.variation_id || item.variationId),
          productName,
          variationName,
          displayCode:
            this.toText(variation?.display_id || variation?.displayId) ||
            this.toText(variation?.product_display_id || variation?.productDisplayId) ||
            null,
          quantity,
        } satisfies ParsedOrderItem;
      })
      .filter(
        (entry): entry is ParsedOrderItem =>
          Boolean(entry && entry.quantity > 0 && entry.productName),
      );
  }

  private async listEligibleOrders(limit: number) {
    return this.prisma.posOrder.findMany({
      where: {
        tracking: {
          not: null,
        },
        NOT: {
          tracking: "",
        },
        isVoid: false,
        isAbandoned: false,
        OR: [
          {
            wmsFulfillmentOrder: {
              isNot: null,
            },
          },
          { status: null },
          {
            status: {
              notIn: Array.from(FULFILLMENT_EXCLUDED_POS_STATUSES),
            },
          },
        ],
      },
      orderBy: [{ insertedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        tenantId: true,
        shopId: true,
        status: true,
        statusName: true,
        tracking: true,
        dateLocal: true,
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        orderSnapshot: true,
        statusHistory: true,
        updatedAt: true,
      },
    });
  }

  private async buildAvailabilityMaps(
    orders: Array<{
      warehouseId?: string | null;
      items: Array<{ variationId: string | null }>;
    }>,
  ): Promise<AvailabilityMaps> {
    const variationIds = Array.from(
      new Set(
        orders
          .flatMap((order) => order.items.map((item) => item.variationId))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (variationIds.length === 0) {
      return {
        byWarehouseVariation: new Map(),
        byVariation: new Map(),
      };
    }

    const warehouseIds = Array.from(
      new Set(
        orders
          .map((order) => order.warehouseId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const [warehouseRows, globalRows] = await Promise.all([
      this.prisma.wmsInventoryUnit.groupBy({
        by: ["warehouseId", "variationId"],
        where: {
          status: "AVAILABLE",
          variationId: { in: variationIds },
          ...(warehouseIds.length ? { warehouseId: { in: warehouseIds } } : {}),
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.wmsInventoryUnit.groupBy({
        by: ["variationId"],
        where: {
          status: "AVAILABLE",
          variationId: { in: variationIds },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const byWarehouseVariation = new Map<string, number>();
    for (const row of warehouseRows) {
      const key = this.buildWarehouseVariationKey(
        row.warehouseId,
        row.variationId,
      );
      if (key) {
        byWarehouseVariation.set(key, row._count._all);
      }
    }

    const byVariation = new Map<string, number>();
    for (const row of globalRows) {
      if (row.variationId) {
        byVariation.set(row.variationId, row._count._all);
      }
    }

    return {
      byWarehouseVariation,
      byVariation,
    };
  }

  private getAvailableUnitsForItem(
    maps: AvailabilityMaps,
    warehouseId: string | null | undefined,
    variationId: string | null | undefined,
  ) {
    if (!variationId) {
      return 0;
    }

    const warehouseKey = this.buildWarehouseVariationKey(warehouseId, variationId);
    if (warehouseKey && maps.byWarehouseVariation.has(warehouseKey)) {
      return maps.byWarehouseVariation.get(warehouseKey) || 0;
    }

    return maps.byVariation.get(variationId) || 0;
  }

  private mapOrder(
    order: any,
    availabilityMaps: AvailabilityMaps,
    includeScans = false,
  ) {
    const items = order.items.map((item) => {
      const availableUnits = this.getAvailableUnitsForItem(
        availabilityMaps,
        order.warehouseId,
        item.variationId,
      );
      const remainingToPick = Math.max(item.quantity - item.pickedQuantity, 0);
      const shortageQuantity = Math.max(remainingToPick - availableUnits, 0);
      const remainingToPack = Math.max(item.quantity - item.packedQuantity, 0);
      const assignedUnits = order.unitAssignments
        .filter((assignment) => assignment.orderItemId === item.id)
        .sort((left, right) =>
          left.unit.serialNo > right.unit.serialNo ? 1 : -1,
        )
        .map((assignment) => ({
          id: assignment.id,
          pickedAt: assignment.pickedAt?.toISOString() || null,
          packedAt: assignment.packedAt?.toISOString() || null,
          unit: {
            id: assignment.unit.id,
            serialNo: assignment.unit.serialNo.toString(),
            batchSequence: assignment.unit.batchSequence,
            unitBarcode: assignment.unit.unitBarcode,
            sku: assignment.unit.sku,
            productName: assignment.unit.productName,
            variationName: assignment.unit.variationName,
            status: assignment.unit.status,
            warehouse: assignment.unit.warehouse,
            location: assignment.unit.location,
            lot: assignment.unit.lot,
          },
        }));

      return {
        id: item.id,
        lineNo: item.lineNo,
        sourceProductId: item.sourceProductId,
        variationId: item.variationId,
        productName: item.productName,
        variationName: item.variationName,
        displayCode: item.displayCode,
        quantity: item.quantity,
        pickedQuantity: item.pickedQuantity,
        packedQuantity: item.packedQuantity,
        remainingToPick,
        remainingToPack,
        availableUnits,
        shortageQuantity,
        assignedUnits,
      };
    });

    const totalPicked = items.reduce(
      (sum, item) => sum + item.pickedQuantity,
      0,
    );
    const totalPacked = items.reduce(
      (sum, item) => sum + item.packedQuantity,
      0,
    );
    const totalShortage = items.reduce(
      (sum, item) => sum + item.shortageQuantity,
      0,
    );

    return {
      id: order.id,
      fulfillmentCode: order.fulfillmentCode,
      status: order.status,
      trackingNumber: order.trackingNumber,
      posStatus: order.posStatus,
      posStatusName: order.posStatusName,
      orderDateLocal: order.orderDateLocal,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      totalLines: order.totalLines,
      totalQuantity: order.totalQuantity,
      pickedAt: order.pickedAt?.toISOString() || null,
      packedAt: order.packedAt?.toISOString() || null,
      dispatchedAt: order.dispatchedAt?.toISOString() || null,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      tenant: order.tenant,
      store: order.store,
      warehouse: order.warehouse,
      pickerUser: order.pickerUser
        ? {
            id: order.pickerUser.id,
            name: this.formatUserName(order.pickerUser),
            email: order.pickerUser.email,
          }
        : null,
      packerUser: order.packerUser
        ? {
            id: order.packerUser.id,
            name: this.formatUserName(order.packerUser),
            email: order.packerUser.email,
          }
        : null,
      packingStation: order.packingStation
        ? {
            id: order.packingStation.id,
            code: order.packingStation.code,
            name: order.packingStation.name,
            status: order.packingStation.status,
            warehouse: order.packingStation.warehouse,
            assignedUsers: order.packingStation.assignedUsers.map((entry) => ({
              id: entry.user.id,
              name: this.formatUserName(entry.user),
              email: entry.user.email,
            })),
          }
        : null,
      progress: {
        picked: totalPicked,
        packed: totalPacked,
        required: order.totalQuantity,
      },
      shortageQuantity: totalShortage,
      items,
      scans: includeScans
        ? (order.scanLogs || []).map((log) => ({
            id: log.id,
            stage: log.stage,
            result: log.result,
            action: log.action,
            scannedValue: log.scannedValue,
            message: log.message,
            createdAt: log.createdAt.toISOString(),
            actorUser: log.actorUser
              ? {
                  id: log.actorUser.id,
                  name: this.formatUserName(log.actorUser),
                  email: log.actorUser.email,
                }
              : null,
          }))
        : [],
    };
  }

  private async createScanLog(
    tx: TxClient,
    input: {
      fulfillmentOrderId: string;
      orderItemId?: string | null;
      unitId?: string | null;
      stationId?: string | null;
      stage: WmsFulfillmentScanStage;
      result: WmsFulfillmentScanResult;
      action: string;
      scannedValue: string;
      message?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const actorUserId = this.getActorUserId();

    await tx.wmsFulfillmentScanLog.create({
      data: {
        fulfillmentOrderId: input.fulfillmentOrderId,
        orderItemId: input.orderItemId || null,
        unitId: input.unitId || null,
        stationId: input.stationId || null,
        actorUserId: actorUserId || null,
        stage: input.stage,
        result: input.result,
        action: input.action,
        scannedValue: input.scannedValue,
        message: this.normalizeText(input.message),
        metadata: input.metadata || {},
      },
    });
  }

  private async loadOrderForMutation(
    client: TxClient | PrismaService,
    id: string,
  ): Promise<OrderMutationRecord> {
    const order = await client.wmsFulfillmentOrder.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { lineNo: "asc" },
        },
        unitAssignments: {
          include: {
            unit: true,
          },
        },
        packingStation: {
          include: {
            assignedUsers: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Fulfillment order not found");
    }

    return order;
  }

  private async createReserveLedgerEntry(
    tx: TxClient,
    input: {
      warehouseId: string;
      locationId: string;
      lotId: string;
      actorUserId?: string | null;
      sku: string;
      productName: string;
      variationId?: string | null;
      variationName?: string | null;
      barcode?: string | null;
      referenceId: string;
      notes: string;
      reservedDelta: Prisma.Decimal;
    },
  ) {
    const balance = await tx.wmsInventoryBalance.findUnique({
      where: {
        warehouseId_locationId_sku: {
          warehouseId: input.warehouseId,
          locationId: input.locationId,
          sku: input.sku,
        },
      },
      select: {
        onHandQuantity: true,
      },
    });

    const onHand = balance?.onHandQuantity || new Prisma.Decimal(0);

    await tx.wmsInventoryLedger.create({
      data: {
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        lotId: input.lotId,
        actorUserId: input.actorUserId || null,
        movementType:
          input.reservedDelta.gte(0)
            ? WmsInventoryMovementType.PICK
            : WmsInventoryMovementType.RELEASE,
        sku: input.sku,
        productName: input.productName,
        variationId: input.variationId || null,
        variationName: input.variationName || null,
        barcode: input.barcode || null,
        quantityDelta: new Prisma.Decimal(0),
        quantityBefore: onHand,
        quantityAfter: onHand,
        reservedDelta: input.reservedDelta,
        referenceType: "WMS_FULFILLMENT_ORDER",
        referenceId: input.referenceId,
        notes: input.notes,
        happenedAt: new Date(),
      },
    });
  }

  private async createPackLedgerEntry(
    tx: TxClient,
    input: {
      warehouseId: string;
      locationId: string;
      lotId: string;
      actorUserId?: string | null;
      sku: string;
      productName: string;
      variationId?: string | null;
      variationName?: string | null;
      barcode?: string | null;
      referenceId: string;
      notes: string;
    },
  ) {
    const balance = await tx.wmsInventoryBalance.findUnique({
      where: {
        warehouseId_locationId_sku: {
          warehouseId: input.warehouseId,
          locationId: input.locationId,
          sku: input.sku,
        },
      },
      select: {
        onHandQuantity: true,
      },
    });

    const onHand = balance?.onHandQuantity || new Prisma.Decimal(0);

    await tx.wmsInventoryLedger.create({
      data: {
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        lotId: input.lotId,
        actorUserId: input.actorUserId || null,
        movementType: WmsInventoryMovementType.PACK,
        sku: input.sku,
        productName: input.productName,
        variationId: input.variationId || null,
        variationName: input.variationName || null,
        barcode: input.barcode || null,
        quantityDelta: new Prisma.Decimal(0),
        quantityBefore: onHand,
        quantityAfter: onHand,
        reservedDelta: new Prisma.Decimal(0),
        referenceType: "WMS_FULFILLMENT_ORDER",
        referenceId: input.referenceId,
        notes: input.notes,
        happenedAt: new Date(),
      },
    });
  }

  private async releaseAssignedUnits(
    tx: TxClient,
    order: OrderMutationRecord,
  ) {
    const actorUserId = this.getActorUserId();
    const releasableAssignments = order.unitAssignments.filter((assignment) =>
      ["PICKED", "PACKED"].includes(assignment.unit.status),
    );

    if (!releasableAssignments.length) {
      return;
    }

    const grouped = new Map<
      string,
      {
        warehouseId: string;
        locationId: string;
        sku: string;
        lotId: string;
        count: number;
        firstUnit: OrderMutationRecord["unitAssignments"][number]["unit"];
      }
    >();

    for (const assignment of releasableAssignments) {
      const key = [
        assignment.unit.warehouseId,
        assignment.unit.locationId,
        assignment.unit.sku,
      ].join("::");
      const existing = grouped.get(key);

      if (existing) {
        existing.count += 1;
        continue;
      }

      grouped.set(key, {
        warehouseId: assignment.unit.warehouseId,
        locationId: assignment.unit.locationId,
        sku: assignment.unit.sku,
        lotId: assignment.unit.lotId,
        count: 1,
        firstUnit: assignment.unit,
      });
    }

    await tx.wmsInventoryUnit.updateMany({
      where: {
        id: {
          in: releasableAssignments.map((assignment) => assignment.unitId),
        },
      },
      data: {
        status: WmsInventoryUnitStatus.AVAILABLE,
        lastMovementType: WmsInventoryMovementType.RELEASE,
        lastReferenceType: "WMS_FULFILLMENT_ORDER",
        lastReferenceId: order.id,
      },
    });

    for (const group of grouped.values()) {
      await tx.wmsInventoryBalance.update({
        where: {
          warehouseId_locationId_sku: {
            warehouseId: group.warehouseId,
            locationId: group.locationId,
            sku: group.sku,
          },
        },
        data: {
          reservedQuantity: {
            decrement: new Prisma.Decimal(group.count),
          },
          availableQuantity: {
            increment: new Prisma.Decimal(group.count),
          },
        },
      });

      await this.createReserveLedgerEntry(tx, {
        warehouseId: group.warehouseId,
        locationId: group.locationId,
        lotId: group.lotId,
        actorUserId,
        sku: group.firstUnit.sku,
        productName: group.firstUnit.productName,
        variationId: group.firstUnit.variationId,
        variationName: group.firstUnit.variationName,
        barcode: group.firstUnit.barcode,
        referenceId: order.id,
        notes: `Release ${group.count} unit(s) from fulfillment ${order.fulfillmentCode}`,
        reservedDelta: new Prisma.Decimal(group.count).mul(-1),
      });
    }
  }

  private async consumeDispatchCostLayersForLot(
    tx: TxClient,
    lotId: string,
    requestedQuantity: Prisma.Decimal,
  ) {
    if (requestedQuantity.lte(0)) {
      return [];
    }

    const layers = await tx.wmsInventoryCostLayer.findMany({
      where: {
        lotId,
        remainingQuantity: {
          gt: new Prisma.Decimal(0),
        },
      },
      orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        lotId: true,
        unitCost: true,
        remainingQuantity: true,
      },
    });

    let remaining = requestedQuantity;
    const consumed: Array<{
      costLayerId: string;
      lotId: string;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      totalCost: Prisma.Decimal;
    }> = [];

    for (const layer of layers) {
      if (remaining.lte(0)) {
        break;
      }

      const quantity = layer.remainingQuantity.gte(remaining)
        ? remaining
        : layer.remainingQuantity;
      const nextRemaining = layer.remainingQuantity.sub(quantity);

      await tx.wmsInventoryCostLayer.update({
        where: { id: layer.id },
        data: {
          remainingQuantity: nextRemaining,
        },
      });

      consumed.push({
        costLayerId: layer.id,
        lotId: layer.lotId,
        quantity,
        unitCost: layer.unitCost,
        totalCost: quantity.mul(layer.unitCost),
      });

      remaining = remaining.sub(quantity);
    }

    if (remaining.gt(0)) {
      throw new ConflictException(
        `Not enough remaining cost layers for lot ${lotId}`,
      );
    }

    await tx.wmsInventoryLot.update({
      where: { id: lotId },
      data: {
        remainingQuantity: {
          decrement: requestedQuantity,
        },
      },
    });

    return consumed;
  }

  private async markOrderDispatchedFromPosSync(
    tx: TxClient,
    order: OrderMutationRecord,
    input: {
      posStatus: number | null;
      posStatusName?: string | null;
      statusHistory?: Prisma.JsonValue | null;
      posUpdatedAt?: Date | null;
    },
  ) {
    if (order.status === WmsFulfillmentOrderStatus.DISPATCHED) {
      return false;
    }

    const dispatchedAt = this.resolveDispatchTimestamp(input);
    if (!dispatchedAt) {
      return false;
    }

    const actorUserId = this.getActorUserId();
    const dispatchableAssignments = order.unitAssignments.filter((assignment) =>
      DISPATCHABLE_UNIT_STATUSES.includes(assignment.unit.status),
    );
    const incompleteLineCount = order.items.filter(
      (item) => item.packedQuantity < item.quantity,
    ).length;

    const grouped = new Map<
      string,
      {
        warehouseId: string;
        locationId: string;
        sku: string;
        productName: string;
        variationId: string | null;
        variationName: string | null;
        barcode: string | null;
        lotQuantities: Map<string, number>;
      }
    >();

    for (const assignment of dispatchableAssignments) {
      const key = [
        assignment.unit.warehouseId,
        assignment.unit.locationId,
        assignment.unit.sku,
      ].join("::");
      const existing = grouped.get(key);

      if (existing) {
        existing.lotQuantities.set(
          assignment.unit.lotId,
          (existing.lotQuantities.get(assignment.unit.lotId) || 0) + 1,
        );
        continue;
      }

      grouped.set(key, {
        warehouseId: assignment.unit.warehouseId,
        locationId: assignment.unit.locationId,
        sku: assignment.unit.sku,
        productName: assignment.unit.productName,
        variationId: assignment.unit.variationId,
        variationName: assignment.unit.variationName,
        barcode: assignment.unit.barcode,
        lotQuantities: new Map([[assignment.unit.lotId, 1]]),
      });
    }

    for (const group of grouped.values()) {
      const quantity = new Prisma.Decimal(
        Array.from(group.lotQuantities.values()).reduce(
          (sum, value) => sum + value,
          0,
        ),
      );

      const balance = await tx.wmsInventoryBalance.findUnique({
        where: {
          warehouseId_locationId_sku: {
            warehouseId: group.warehouseId,
            locationId: group.locationId,
            sku: group.sku,
          },
        },
        select: {
          id: true,
          onHandQuantity: true,
          reservedQuantity: true,
          inventoryValue: true,
        },
      });

      if (!balance) {
        throw new ConflictException(
          `No inventory balance found for SKU ${group.sku}`,
        );
      }

      if (balance.onHandQuantity.lt(quantity)) {
        throw new ConflictException(
          `On-hand balance is lower than dispatch quantity for SKU ${group.sku}`,
        );
      }

      if (balance.reservedQuantity.lt(quantity)) {
        throw new ConflictException(
          `Reserved balance is lower than dispatch quantity for SKU ${group.sku}`,
        );
      }

      const consumedLayers: Array<{
        costLayerId: string;
        lotId: string;
        quantity: Prisma.Decimal;
        unitCost: Prisma.Decimal;
        totalCost: Prisma.Decimal;
      }> = [];

      for (const [lotId, lotQuantity] of group.lotQuantities.entries()) {
        consumedLayers.push(
          ...(await this.consumeDispatchCostLayersForLot(
            tx,
            lotId,
            new Prisma.Decimal(lotQuantity),
          )),
        );
      }

      const totalCost = consumedLayers.reduce(
        (sum, layer) => sum.add(layer.totalCost),
        new Prisma.Decimal(0),
      );
      const onHandBefore = balance.onHandQuantity;
      const onHandAfter = onHandBefore.sub(quantity);
      const reservedAfter = balance.reservedQuantity.sub(quantity);
      const availableAfter = onHandAfter.sub(reservedAfter);
      const inventoryValueBefore =
        balance.inventoryValue || new Prisma.Decimal(0);
      const inventoryValueAfter = inventoryValueBefore.sub(totalCost);

      await tx.wmsInventoryBalance.update({
        where: { id: balance.id },
        data: {
          onHandQuantity: onHandAfter,
          reservedQuantity: reservedAfter,
          availableQuantity: availableAfter,
          inventoryValue: inventoryValueAfter,
        },
      });

      let runningBefore = onHandBefore;
      for (const layer of consumedLayers) {
        const runningAfter = runningBefore.sub(layer.quantity);
        await tx.wmsInventoryLedger.create({
          data: {
            warehouseId: group.warehouseId,
            locationId: group.locationId,
            lotId: layer.lotId,
            costLayerId: layer.costLayerId,
            actorUserId: actorUserId || null,
            movementType: WmsInventoryMovementType.DISPATCH,
            sku: group.sku,
            productName: group.productName,
            variationId: group.variationId,
            variationName: group.variationName,
            barcode: group.barcode,
            quantityDelta: layer.quantity.neg(),
            quantityBefore: runningBefore,
            quantityAfter: runningAfter,
            reservedDelta: layer.quantity.neg(),
            unitCost: layer.unitCost,
            totalCost: layer.totalCost.neg(),
            currency: "PHP",
            referenceType: "WMS_FULFILLMENT_ORDER",
            referenceId: order.id,
            notes: `Dispatched ${layer.quantity.toString()} unit(s) from ${order.fulfillmentCode}`,
            happenedAt: dispatchedAt,
            metadata: {
              trackingNumber: order.trackingNumber,
              posStatus: input.posStatus,
              posStatusName: input.posStatusName || null,
            },
          },
        });
        runningBefore = runningAfter;
      }
    }

    if (dispatchableAssignments.length) {
      await tx.wmsInventoryUnit.updateMany({
        where: {
          id: {
            in: dispatchableAssignments.map((assignment) => assignment.unitId),
          },
          status: {
            in: DISPATCHABLE_UNIT_STATUSES,
          },
        },
        data: {
          status: WmsInventoryUnitStatus.DISPATCHED,
          lastMovementType: WmsInventoryMovementType.DISPATCH,
          lastReferenceType: "WMS_FULFILLMENT_ORDER",
          lastReferenceId: order.id,
          consumedAt: dispatchedAt,
        },
      });
    }

    await tx.wmsFulfillmentOrder.update({
      where: { id: order.id },
      data: {
        status: WmsFulfillmentOrderStatus.DISPATCHED,
        dispatchedAt,
      },
    });

    await this.createScanLog(tx, {
      fulfillmentOrderId: order.id,
      stage: WmsFulfillmentScanStage.DISPATCH,
      result: WmsFulfillmentScanResult.ACCEPTED,
      action: "POS_STATUS_SYNC",
      scannedValue: order.trackingNumber,
      message: "Order auto-dispatched from POS courier pickup status.",
      metadata: {
        posStatus: input.posStatus,
        posStatusName: input.posStatusName || null,
        dispatchedAt: dispatchedAt.toISOString(),
        dispatchedUnitCount: dispatchableAssignments.length,
        incompleteLineCount,
      },
    });

    return true;
  }

  async syncIntake(dto: SyncWmsFulfillmentIntakeDto) {
    const limit = dto.limit || 200;
    const eligibleOrders = await this.listEligibleOrders(limit);

    const storeKeys = eligibleOrders.map((order) => ({
      tenantId: order.tenantId,
      shopId: order.shopId,
    }));
    const uniqueStoreTenantIds = Array.from(
      new Set(storeKeys.map((entry) => entry.tenantId)),
    );
    const uniqueShopIds = Array.from(new Set(storeKeys.map((entry) => entry.shopId)));

    const warehouseIds = Array.from(
      new Set(
        eligibleOrders
          .map((order) => this.extractWarehouseId(order.orderSnapshot))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const [stores, existingOrders, warehouses] = await Promise.all([
      this.prisma.posStore.findMany({
        where: {
          tenantId: { in: uniqueStoreTenantIds },
          shopId: { in: uniqueShopIds },
        },
        select: {
          id: true,
          tenantId: true,
          shopId: true,
        },
      }),
      this.prisma.wmsFulfillmentOrder.findMany({
        where: {
          posOrderId: {
            in: eligibleOrders.map((order) => order.id),
          },
        },
        select: {
          id: true,
          posOrderId: true,
          status: true,
          totalLines: true,
          totalQuantity: true,
          unitAssignments: {
            select: {
              id: true,
            },
            take: 1,
          },
        },
      }),
      this.prisma.wmsWarehouse.findMany({
        where: {
          id: {
            in: warehouseIds,
          },
        },
        select: {
          id: true,
        },
      }),
    ]);

    const storeMap = new Map(
      stores.map((store) => [`${store.tenantId}::${store.shopId}`, store.id]),
    );
    const existingOrderMap = new Map(
      existingOrders.map((order) => [order.posOrderId, order]),
    );
    const warehouseSet = new Set(warehouses.map((warehouse) => warehouse.id));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const order of eligibleOrders) {
        const parsedItems = this.parseSnapshotItems(
          this.toObject(order.orderSnapshot)?.items,
        );
        const existing = existingOrderMap.get(order.id);

        if (!parsedItems.length && !existing) {
          skipped += 1;
          continue;
        }
        const storeId =
          storeMap.get(`${order.tenantId}::${order.shopId}`) || null;
        const warehouseIdCandidate = this.extractWarehouseId(order.orderSnapshot);
        const warehouseId =
          warehouseIdCandidate && warehouseSet.has(warehouseIdCandidate)
            ? warehouseIdCandidate
            : null;
        const baseData = {
          tenantId: order.tenantId,
          storeId,
          warehouseId,
          trackingNumber: this.normalizeText(order.tracking) || "UNKNOWN",
          posStatus: order.status,
          posStatusName: this.normalizeText(order.statusName),
          orderDateLocal: this.normalizeText(order.dateLocal),
          customerName: this.normalizeText(order.customerName),
          customerPhone: this.normalizeText(order.customerPhone),
          customerAddress: this.normalizeText(order.customerAddress),
          totalLines: parsedItems.length || existing?.totalLines || 0,
          totalQuantity:
            parsedItems.reduce((sum, item) => sum + item.quantity, 0) ||
            existing?.totalQuantity ||
            0,
        };

        if (!existing) {
          await tx.wmsFulfillmentOrder.create({
            data: {
              ...baseData,
              fulfillmentCode: this.buildFulfillmentCode(),
              posOrderId: order.id,
              items: {
                create: parsedItems.map((item) => ({
                  lineNo: item.lineNo,
                  sourceProductId: item.sourceProductId,
                  variationId: item.variationId,
                  productName: item.productName,
                  variationName: item.variationName,
                  displayCode: item.displayCode,
                  quantity: item.quantity,
                })),
              },
            },
          });
          created += 1;
          continue;
        }

        const canRefreshLines =
          parsedItems.length > 0 &&
          !existing.unitAssignments.length &&
          ["PENDING", "WAITING_FOR_STOCK", "HOLD"].includes(existing.status);

        await tx.wmsFulfillmentOrder.update({
          where: { id: existing.id },
          data: {
            ...baseData,
            ...(existing.status === "CANCELED"
              ? { status: WmsFulfillmentOrderStatus.PENDING }
              : {}),
          },
        });

        if (canRefreshLines) {
          await tx.wmsFulfillmentOrderItem.deleteMany({
            where: {
              fulfillmentOrderId: existing.id,
            },
          });

          await tx.wmsFulfillmentOrderItem.createMany({
            data: parsedItems.map((item) => ({
              fulfillmentOrderId: existing.id,
              lineNo: item.lineNo,
              sourceProductId: item.sourceProductId,
              variationId: item.variationId,
              productName: item.productName,
              variationName: item.variationName,
              displayCode: item.displayCode,
              quantity: item.quantity,
            })),
          });
        }

        const refreshedOrder = await this.loadOrderForMutation(tx, existing.id);
        await this.markOrderDispatchedFromPosSync(tx, refreshedOrder, {
          posStatus: order.status,
          posStatusName: order.statusName,
          statusHistory: order.statusHistory,
          posUpdatedAt: order.updatedAt,
        });

        updated += 1;
      }
    });

    return {
      syncedAt: new Date().toISOString(),
      totalEligible: eligibleOrders.length,
      created,
      updated,
      skipped,
    };
  }

  async listOperators() {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: null,
        status: "ACTIVE",
        OR: [
          { role: "SUPER_ADMIN" },
          {
            userRoleAssignments: {
              some: {
                tenantId: null,
                teamId: null,
                role: {
                  scope: "GLOBAL",
                  rolePermissions: {
                    some: {
                      permission: {
                        key: "wms.fulfillment.update",
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      orderBy: [{ firstName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userRoleAssignments: {
          where: {
            tenantId: null,
            teamId: null,
          },
          include: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      name: this.formatUserName(user),
      email: user.email,
      roleName: user.userRoleAssignments[0]?.role.name || null,
    }));
  }

  async listStations(query?: { warehouseId?: string }) {
    const stations = await this.prisma.wmsPackingStation.findMany({
      where: {
        ...(query?.warehouseId ? { warehouseId: query.warehouseId } : {}),
      },
      orderBy: [{ warehouse: { name: "asc" } }, { name: "asc" }],
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        assignedUsers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: [{ user: { firstName: "asc" } }],
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    return stations.map((station) => ({
      id: station.id,
      code: station.code,
      name: station.name,
      status: station.status,
      notes: station.notes,
      warehouse: station.warehouse,
      activeOrders: station._count.orders,
      assignedUsers: station.assignedUsers.map((entry) => ({
        id: entry.user.id,
        name: this.formatUserName(entry.user),
        email: entry.user.email,
      })),
    }));
  }

  async createStation(dto: CreateWmsPackingStationDto) {
    const code = this.buildStationCode(dto.code);

    const createdId = await this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.wmsWarehouse.findUnique({
        where: { id: dto.warehouseId },
        select: { id: true, status: true },
      });

      if (!warehouse) {
        throw new NotFoundException("Warehouse not found");
      }

      if (warehouse.status !== "ACTIVE") {
        throw new ConflictException("Warehouse must be active for packing stations");
      }

      const station = await tx.wmsPackingStation.create({
        data: {
          warehouseId: dto.warehouseId,
          code,
          name: dto.name.trim(),
          status: dto.status || "ACTIVE",
          notes: this.normalizeText(dto.notes),
          assignedUsers:
            dto.assignedUserIds && dto.assignedUserIds.length
              ? {
                  create: dto.assignedUserIds.map((userId) => ({
                    userId,
                  })),
                }
              : undefined,
        },
        select: { id: true },
      });

      return station.id;
    });

    const stations = await this.listStations();
    const created = stations.find((station) => station.id === createdId);
    if (!created) {
      throw new NotFoundException("Packing station could not be loaded");
    }
    return created;
  }

  async updateStation(id: string, dto: UpdateWmsPackingStationDto) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.wmsPackingStation.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException("Packing station not found");
      }

      await tx.wmsPackingStation.update({
        where: { id },
        data: {
          ...(dto.warehouseId ? { warehouseId: dto.warehouseId } : {}),
          ...(dto.code ? { code: this.buildStationCode(dto.code) } : {}),
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.notes !== undefined ? { notes: this.normalizeText(dto.notes) } : {}),
        },
      });

      if (dto.assignedUserIds) {
        await tx.wmsPackingStationUser.deleteMany({
          where: { stationId: id },
        });

        if (dto.assignedUserIds.length) {
          await tx.wmsPackingStationUser.createMany({
            data: dto.assignedUserIds.map((userId) => ({
              stationId: id,
              userId,
            })),
          });
        }
      }
    });

    const stations = await this.listStations();
    const updated = stations.find((station) => station.id === id);
    if (!updated) {
      throw new NotFoundException("Updated packing station could not be loaded");
    }
    return updated;
  }

  async listOrders(query: ListWmsFulfillmentOrdersDto) {
    const limit = query.limit || 120;
    const statuses =
      query.status
        ? [query.status]
        : query.view === "PACKING"
          ? PACKING_VIEW_STATUSES
          : query.view === "DISPATCH"
            ? DISPATCH_VIEW_STATUSES
          : PICKING_VIEW_STATUSES;

    const orders = await this.prisma.wmsFulfillmentOrder.findMany({
      where: {
        status: {
          in: statuses,
        },
        ...(query.tenantId ? { tenantId: query.tenantId } : {}),
        ...(query.storeId ? { storeId: query.storeId } : {}),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  fulfillmentCode: {
                    contains: query.search,
                    mode: "insensitive",
                  },
                },
                {
                  trackingNumber: {
                    contains: query.search,
                    mode: "insensitive",
                  },
                },
                {
                  customerName: {
                    contains: query.search,
                    mode: "insensitive",
                  },
                },
                {
                  tenant: {
                    name: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                },
                {
                  store: {
                    name: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                },
              ],
            }
          : {}),
      },
      take: limit,
      orderBy: [{ createdAt: "desc" }],
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            shopId: true,
            shopName: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        packingStation: {
          include: {
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            assignedUsers: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        pickerUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        packerUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          orderBy: {
            lineNo: "asc",
          },
        },
        unitAssignments: {
          include: {
            unit: {
              select: {
                id: true,
                serialNo: true,
                batchSequence: true,
                unitBarcode: true,
                sku: true,
                productName: true,
                variationName: true,
                status: true,
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
              },
            },
          },
        },
      },
    });

    const availabilityMaps = await this.buildAvailabilityMaps(orders);

    return orders.map((order) => this.mapOrder(order, availabilityMaps));
  }

  async getOrder(id: string) {
    const order = await this.prisma.wmsFulfillmentOrder.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            shopId: true,
            shopName: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        packingStation: {
          include: {
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            assignedUsers: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        pickerUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        packerUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          orderBy: {
            lineNo: "asc",
          },
        },
        unitAssignments: {
          include: {
            unit: {
              select: {
                id: true,
                serialNo: true,
                batchSequence: true,
                unitBarcode: true,
                sku: true,
                productName: true,
                variationName: true,
                status: true,
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
              },
            },
          },
        },
        scanLogs: {
          take: 18,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            actorUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Fulfillment order not found");
    }

    const availabilityMaps = await this.buildAvailabilityMaps([order]);
    return this.mapOrder(order, availabilityMaps, true);
  }

  async setOrderStatus(id: string, dto: SetWmsFulfillmentOrderStatusDto) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.loadOrderForMutation(tx, id);

      if (dto.status === "CANCELED") {
        await this.releaseAssignedUnits(tx, order);
      }

      await tx.wmsFulfillmentOrder.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === "CANCELED" ? { packingStationId: null, packerUserId: null } : {}),
        },
      });

      await this.createScanLog(tx, {
        fulfillmentOrderId: id,
        stage:
          order.status === "PACKING" || order.status === "PACKING_ASSIGNED"
            ? WmsFulfillmentScanStage.PACKING
            : WmsFulfillmentScanStage.PICKING,
        result: WmsFulfillmentScanResult.ACCEPTED,
        action: "STATUS_UPDATE",
        scannedValue: dto.status,
        message: `Order moved to ${dto.status.replace(/_/g, " ").toLowerCase()}.`,
      });
    });

    return this.getOrder(id);
  }

  async startPicking(id: string, dto: StartWmsFulfillmentSessionDto) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.loadOrderForMutation(tx, id);
      const scannedTracking = dto.trackingNumber.trim();

      if (!PICKABLE_STATUSES.includes(order.status)) {
        throw new ConflictException("Order is not available in the picker queue");
      }

      if (scannedTracking !== order.trackingNumber) {
        await this.createScanLog(tx, {
          fulfillmentOrderId: id,
          stage: WmsFulfillmentScanStage.PICKING,
          result: WmsFulfillmentScanResult.REJECTED,
          action: "TRACKING_START",
          scannedValue: scannedTracking,
          message: "Tracking number does not match this order.",
        });
        throw new ConflictException("Tracking number does not match this order");
      }

      await tx.wmsFulfillmentOrder.update({
        where: { id },
        data: {
          status: WmsFulfillmentOrderStatus.PICKING,
          pickerUserId: this.getActorUserId() || order.pickerUserId || null,
        },
      });

      await this.createScanLog(tx, {
        fulfillmentOrderId: id,
        stage: WmsFulfillmentScanStage.PICKING,
        result: WmsFulfillmentScanResult.ACCEPTED,
        action: "TRACKING_START",
        scannedValue: scannedTracking,
        message: "Picker session started.",
      });
    });

    return this.getOrder(id);
  }

  async scanPickUnit(id: string, dto: ScanWmsFulfillmentUnitDto) {
    await this.prisma.$transaction(async (tx) => {
      const actorUserId = this.getActorUserId();
      const order = await this.loadOrderForMutation(tx, id);
      const scannedValue = dto.unitBarcode.trim();

      if (!PICKABLE_STATUSES.includes(order.status)) {
        throw new ConflictException("Order is not currently pickable");
      }

      const unit = await tx.wmsInventoryUnit.findUnique({
        where: {
          unitBarcode: scannedValue,
        },
      });

      if (!unit) {
        await this.createScanLog(tx, {
          fulfillmentOrderId: id,
          stage: WmsFulfillmentScanStage.PICKING,
          result: WmsFulfillmentScanResult.REJECTED,
          action: "UNIT_SCAN",
          scannedValue,
          message: "Serialized unit barcode was not found.",
        });
        throw new ConflictException("Serialized unit barcode was not found");
      }

      if (order.warehouseId && unit.warehouseId !== order.warehouseId) {
        await this.createScanLog(tx, {
          fulfillmentOrderId: id,
          unitId: unit.id,
          stage: WmsFulfillmentScanStage.PICKING,
          result: WmsFulfillmentScanResult.REJECTED,
          action: "UNIT_SCAN",
          scannedValue,
          message: "Unit belongs to a different warehouse.",
        });
        throw new ConflictException("Unit belongs to a different warehouse");
      }

      if (unit.status !== WmsInventoryUnitStatus.AVAILABLE) {
        await this.createScanLog(tx, {
          fulfillmentOrderId: id,
          unitId: unit.id,
          stage: WmsFulfillmentScanStage.PICKING,
          result: WmsFulfillmentScanResult.REJECTED,
          action: "UNIT_SCAN",
          scannedValue,
          message: "This unit is not available for picking.",
        });
        throw new ConflictException("This unit is not available for picking");
      }

      const usedElsewhere = await tx.wmsFulfillmentUnitAssignment.findFirst({
        where: {
          unitId: unit.id,
          NOT: {
            fulfillmentOrderId: id,
          },
          fulfillmentOrder: {
            status: {
              in: ACTIVE_FULFILLMENT_STATUSES,
            },
          },
        },
        select: { id: true },
      });

      if (usedElsewhere) {
        await this.createScanLog(tx, {
          fulfillmentOrderId: id,
          unitId: unit.id,
          stage: WmsFulfillmentScanStage.PICKING,
          result: WmsFulfillmentScanResult.REJECTED,
          action: "UNIT_SCAN",
          scannedValue,
          message: "This unit is already assigned to another order.",
        });
        throw new ConflictException("This unit is already assigned to another order");
      }

      const matchingItem = order.items.find((item) => {
        const byVariation =
          item.variationId &&
          unit.variationId &&
          item.variationId === unit.variationId;
        const byDisplayCode =
          !byVariation &&
          item.displayCode &&
          item.displayCode === unit.sku;

        return (
          (byVariation || byDisplayCode) && item.pickedQuantity < item.quantity
        );
      });

      if (!matchingItem) {
        await this.createScanLog(tx, {
          fulfillmentOrderId: id,
          unitId: unit.id,
          stage: WmsFulfillmentScanStage.PICKING,
          result: WmsFulfillmentScanResult.REJECTED,
          action: "UNIT_SCAN",
          scannedValue,
          message: "This unit is not part of the order requirement.",
        });
        throw new ConflictException("This unit is not part of the order requirement");
      }

      const claimed = await tx.wmsInventoryUnit.updateMany({
        where: {
          id: unit.id,
          status: WmsInventoryUnitStatus.AVAILABLE,
        },
        data: {
          status: WmsInventoryUnitStatus.PICKED,
          lastMovementType: WmsInventoryMovementType.PICK,
          lastReferenceType: "WMS_FULFILLMENT_ORDER",
          lastReferenceId: id,
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException("The unit was already claimed by another scan");
      }

      await tx.wmsFulfillmentUnitAssignment.create({
        data: {
          fulfillmentOrderId: id,
          orderItemId: matchingItem.id,
          unitId: unit.id,
          pickedByUserId: actorUserId || null,
          pickedAt: new Date(),
        },
      });

      await tx.wmsFulfillmentOrderItem.update({
        where: {
          fulfillmentOrderId_lineNo: {
            fulfillmentOrderId: id,
            lineNo: matchingItem.lineNo,
          },
        },
        data: {
          pickedQuantity: {
            increment: 1,
          },
        },
      });

      await tx.wmsInventoryBalance.update({
        where: {
          warehouseId_locationId_sku: {
            warehouseId: unit.warehouseId,
            locationId: unit.locationId,
            sku: unit.sku,
          },
        },
        data: {
          reservedQuantity: {
            increment: new Prisma.Decimal(1),
          },
          availableQuantity: {
            decrement: new Prisma.Decimal(1),
          },
        },
      });

      await this.createReserveLedgerEntry(tx, {
        warehouseId: unit.warehouseId,
        locationId: unit.locationId,
        lotId: unit.lotId,
        actorUserId,
        sku: unit.sku,
        productName: unit.productName,
        variationId: unit.variationId,
        variationName: unit.variationName,
        barcode: unit.barcode,
        referenceId: id,
        notes: `Picked unit ${unit.unitBarcode} for ${order.fulfillmentCode}`,
        reservedDelta: new Prisma.Decimal(1),
      });

      const allPicked = order.items.every((item) => {
        const nextPicked =
          item.id === matchingItem.id ? item.pickedQuantity + 1 : item.pickedQuantity;
        return nextPicked >= item.quantity;
      });

      await tx.wmsFulfillmentOrder.update({
        where: { id },
        data: {
          status: allPicked
            ? WmsFulfillmentOrderStatus.PICKED
            : WmsFulfillmentOrderStatus.PICKING,
          pickerUserId: actorUserId || order.pickerUserId || null,
          ...(allPicked ? { pickedAt: new Date() } : {}),
        },
      });

      await this.createScanLog(tx, {
        fulfillmentOrderId: id,
        orderItemId: matchingItem.id,
        unitId: unit.id,
        stage: WmsFulfillmentScanStage.PICKING,
        result: WmsFulfillmentScanResult.ACCEPTED,
        action: "UNIT_SCAN",
        scannedValue,
        message: `${unit.productName} assigned to the order.`,
      });
    });

    return this.getOrder(id);
  }

  async assignPacking(id: string, dto: AssignWmsPackingDto) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.loadOrderForMutation(tx, id);

      if (!order.items.every((item) => item.pickedQuantity >= item.quantity)) {
        throw new ConflictException("Every required unit must be picked before packing assignment");
      }

      const station = await tx.wmsPackingStation.findUnique({
        where: { id: dto.stationId },
        include: {
          assignedUsers: {
            select: {
              userId: true,
            },
          },
        },
      });

      if (!station) {
        throw new NotFoundException("Packing station not found");
      }

      if (station.status !== "ACTIVE") {
        throw new ConflictException("Packing station is not active");
      }

      if (order.warehouseId && station.warehouseId !== order.warehouseId) {
        throw new ConflictException("Packing station belongs to a different warehouse");
      }

      if (!station.assignedUsers.some((entry) => entry.userId === dto.packerUserId)) {
        throw new ConflictException("Selected packer is not assigned to this station");
      }

      await tx.wmsFulfillmentOrder.update({
        where: { id },
        data: {
          packingStationId: dto.stationId,
          packerUserId: dto.packerUserId,
          status: WmsFulfillmentOrderStatus.PACKING_ASSIGNED,
        },
      });

      await this.createScanLog(tx, {
        fulfillmentOrderId: id,
        stationId: dto.stationId,
        stage: WmsFulfillmentScanStage.PACKING,
        result: WmsFulfillmentScanResult.ACCEPTED,
        action: "ASSIGN_PACKING",
        scannedValue: station.code,
        message: `Order assigned to packing station ${station.name}.`,
      });
    });

    return this.getOrder(id);
  }

  async startPacking(id: string, dto: StartWmsFulfillmentSessionDto) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.loadOrderForMutation(tx, id);
      const scannedTracking = dto.trackingNumber.trim();

      if (!PACKABLE_STATUSES.includes(order.status)) {
        throw new ConflictException("Order is not available in the packing queue");
      }

      if (!order.packingStationId || !order.packerUserId) {
        throw new ConflictException("Order must be assigned to a packing station first");
      }

      if (scannedTracking !== order.trackingNumber) {
        await this.createScanLog(tx, {
          fulfillmentOrderId: id,
          stage: WmsFulfillmentScanStage.PACKING,
          result: WmsFulfillmentScanResult.REJECTED,
          action: "TRACKING_START",
          scannedValue: scannedTracking,
          message: "Tracking number does not match this order.",
        });
        throw new ConflictException("Tracking number does not match this order");
      }

      await tx.wmsFulfillmentOrder.update({
        where: { id },
        data: {
          status: WmsFulfillmentOrderStatus.PACKING,
        },
      });

      await this.createScanLog(tx, {
        fulfillmentOrderId: id,
        stationId: order.packingStationId,
        stage: WmsFulfillmentScanStage.PACKING,
        result: WmsFulfillmentScanResult.ACCEPTED,
        action: "TRACKING_START",
        scannedValue: scannedTracking,
        message: "Packing session started.",
      });
    });

    return this.getOrder(id);
  }

  async scanPackUnit(id: string, dto: ScanWmsFulfillmentUnitDto) {
    await this.prisma.$transaction(async (tx) => {
      const actorUserId = this.getActorUserId();
      const order = await this.loadOrderForMutation(tx, id);
      const scannedValue = dto.unitBarcode.trim();

      if (!PACKABLE_STATUSES.includes(order.status)) {
        throw new ConflictException("Order is not currently packable");
      }

      const assignment = order.unitAssignments.find(
        (entry) => entry.unit.unitBarcode === scannedValue,
      );

      if (!assignment) {
        await this.createScanLog(tx, {
          fulfillmentOrderId: id,
          stationId: order.packingStationId,
          stage: WmsFulfillmentScanStage.PACKING,
          result: WmsFulfillmentScanResult.REJECTED,
          action: "UNIT_SCAN",
          scannedValue,
          message: "Unit was not picked for this order.",
        });
        throw new ConflictException("Unit was not picked for this order");
      }

      if (assignment.packedAt) {
        await this.createScanLog(tx, {
          fulfillmentOrderId: id,
          orderItemId: assignment.orderItemId,
          unitId: assignment.unitId,
          stationId: order.packingStationId,
          stage: WmsFulfillmentScanStage.PACKING,
          result: WmsFulfillmentScanResult.REJECTED,
          action: "UNIT_SCAN",
          scannedValue,
          message: "Unit was already packed for this order.",
        });
        throw new ConflictException("Unit was already packed for this order");
      }

      if (assignment.unit.status !== WmsInventoryUnitStatus.PICKED) {
        throw new ConflictException("Picked unit is no longer available for packing");
      }

      const packed = await tx.wmsFulfillmentUnitAssignment.updateMany({
        where: {
          id: assignment.id,
          packedAt: null,
        },
        data: {
          packedAt: new Date(),
          packedByUserId: actorUserId || order.packerUserId || null,
        },
      });

      if (packed.count !== 1) {
        throw new ConflictException("The unit was already processed by another pack scan");
      }

      await tx.wmsInventoryUnit.updateMany({
        where: {
          id: assignment.unitId,
          status: WmsInventoryUnitStatus.PICKED,
        },
        data: {
          status: WmsInventoryUnitStatus.PACKED,
          lastMovementType: WmsInventoryMovementType.PACK,
          lastReferenceType: "WMS_FULFILLMENT_ORDER",
          lastReferenceId: id,
        },
      });

      const line = order.items.find((item) => item.id === assignment.orderItemId);
      if (!line) {
        throw new ConflictException("Fulfillment line was not found for the packed unit");
      }

      await tx.wmsFulfillmentOrderItem.update({
        where: {
          fulfillmentOrderId_lineNo: {
            fulfillmentOrderId: id,
            lineNo: line.lineNo,
          },
        },
        data: {
          packedQuantity: {
            increment: 1,
          },
        },
      });

      await this.createPackLedgerEntry(tx, {
        warehouseId: assignment.unit.warehouseId,
        locationId: assignment.unit.locationId,
        lotId: assignment.unit.lotId,
        actorUserId,
        sku: assignment.unit.sku,
        productName: assignment.unit.productName,
        variationId: assignment.unit.variationId,
        variationName: assignment.unit.variationName,
        barcode: assignment.unit.barcode,
        referenceId: id,
        notes: `Packed unit ${assignment.unit.unitBarcode} for ${order.fulfillmentCode}`,
      });

      const allPacked = order.items.every((item) => {
        const nextPacked =
          item.id === line.id ? item.packedQuantity + 1 : item.packedQuantity;
        return nextPacked >= item.quantity;
      });

      await tx.wmsFulfillmentOrder.update({
        where: { id },
        data: {
          status: allPacked
            ? WmsFulfillmentOrderStatus.PACKED
            : WmsFulfillmentOrderStatus.PACKING,
          ...(allPacked ? { packedAt: new Date() } : {}),
        },
      });

      await this.createScanLog(tx, {
        fulfillmentOrderId: id,
        orderItemId: assignment.orderItemId,
        unitId: assignment.unitId,
        stationId: order.packingStationId,
        stage: WmsFulfillmentScanStage.PACKING,
        result: WmsFulfillmentScanResult.ACCEPTED,
        action: "UNIT_SCAN",
        scannedValue,
        message: `${assignment.unit.productName} validated in packing.`,
      });
    });

    return this.getOrder(id);
  }
}
