import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WmsInventoryMovementType,
  WmsInventoryUnitStatus,
  WmsLocationKind,
  WmsTransferStatus,
  WmsWarehouseStatus,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWmsInventoryTransferDto } from './dto/create-wms-inventory-transfer.dto';
import { GetWmsInventoryOverviewDto } from './dto/get-wms-inventory-overview.dto';
import { RecordWmsInventoryUnitLabelPrintDto } from './dto/record-wms-inventory-unit-label-print.dto';

const UNIT_STATUS_ORDER: WmsInventoryUnitStatus[] = [
  WmsInventoryUnitStatus.RECEIVED,
  WmsInventoryUnitStatus.STAGED,
  WmsInventoryUnitStatus.PUTAWAY,
  WmsInventoryUnitStatus.RESERVED,
  WmsInventoryUnitStatus.PICKED,
  WmsInventoryUnitStatus.PACKED,
  WmsInventoryUnitStatus.DISPATCHED,
  WmsInventoryUnitStatus.RTS,
  WmsInventoryUnitStatus.DAMAGED,
  WmsInventoryUnitStatus.ARCHIVED,
];

type InventoryUnitRecord = Prisma.WmsInventoryUnitGetPayload<{
  include: {
    store: {
      select: {
        id: true;
        name: true;
        shopName: true;
      };
    };
    warehouse: {
      select: {
        id: true;
        code: true;
        name: true;
      };
    };
    currentLocation: {
      select: {
        id: true;
        code: true;
        name: true;
        kind: true;
      };
    };
    posProduct: {
      select: {
        id: true;
        name: true;
        customId: true;
        productSnapshot: true;
      };
    };
  };
}>;

type InventoryMovementRecord = Prisma.WmsInventoryMovementGetPayload<{
  include: {
    fromLocation: {
      select: {
        id: true;
        code: true;
        name: true;
        kind: true;
      };
    };
    toLocation: {
      select: {
        id: true;
        code: true;
        name: true;
        kind: true;
      };
    };
    actor: {
      select: {
        firstName: true;
        lastName: true;
        email: true;
      };
    };
  };
}>;

type TransferableUnitRecord = Prisma.WmsInventoryUnitGetPayload<{
  include: {
    warehouse: {
      select: {
        id: true;
        code: true;
        name: true;
      };
    };
    currentLocation: {
      select: {
        id: true;
        code: true;
        name: true;
        kind: true;
        warehouseId: true;
        parentId: true;
        isActive: true;
      };
    };
  };
}>;

type TransferLocationRecord = {
  id: string;
  warehouseId: string;
  parentId: string | null;
  kind: WmsLocationKind;
  code: string;
  name: string;
  capacity: number | null;
};

type TransferStructureMaps = {
  sections: TransferLocationRecord[];
  locationMap: Map<string, TransferLocationRecord>;
  racksBySectionId: Map<string, TransferLocationRecord[]>;
  binsByRackId: Map<string, TransferLocationRecord[]>;
};

const TRANSFERABLE_UNIT_STATUSES = new Set<WmsInventoryUnitStatus>([
  WmsInventoryUnitStatus.RECEIVED,
  WmsInventoryUnitStatus.STAGED,
  WmsInventoryUnitStatus.PUTAWAY,
  WmsInventoryUnitStatus.RTS,
  WmsInventoryUnitStatus.DAMAGED,
]);

const STRUCTURAL_LOCATION_KINDS = [WmsLocationKind.SECTION, WmsLocationKind.RACK, WmsLocationKind.BIN] as const;

const TRANSFER_OPERATIONAL_LOCATION_KINDS = [
  WmsLocationKind.RECEIVING_STAGING,
  WmsLocationKind.RTS,
  WmsLocationKind.DAMAGE,
  WmsLocationKind.QUARANTINE,
] as const;

@Injectable()
export class WmsInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async getOverview(query: GetWmsInventoryOverviewDto) {
    const scope = await this.resolveTenantScope(query.tenantId);

    if (!scope.activeTenantId) {
      return {
        tenantReady: false,
        summary: {
          units: 0,
          locatedUnits: 0,
          unlocatedUnits: 0,
        },
        filters: {
          tenants: scope.tenants,
          stores: [],
          warehouses: [],
          statuses: UNIT_STATUS_ORDER.map((status) => ({
            value: status,
            label: this.formatStatusLabel(status),
            unitCount: 0,
          })),
          activeTenantId: null,
          activeStoreId: null,
          activeWarehouseId: null,
          activeStatus: null,
        },
        units: [],
      };
    }

    const stores = await this.prisma.posStore.findMany({
      where: { tenantId: scope.activeTenantId },
      select: {
        id: true,
        name: true,
        shopName: true,
        _count: {
          select: {
            wmsInventoryUnits: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const activeStoreId =
      query.storeId && stores.some((store) => store.id === query.storeId)
        ? query.storeId
        : null;

    const warehouseCountScope: Prisma.WmsInventoryUnitWhereInput = {
      tenantId: scope.activeTenantId,
      ...(activeStoreId ? { storeId: activeStoreId } : {}),
    };

    const [warehouses, warehouseCounts] = await Promise.all([
      this.prisma.wmsWarehouse.findMany({
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: [{ code: 'asc' }],
      }),
      this.prisma.wmsInventoryUnit.groupBy({
        by: ['warehouseId'],
        where: warehouseCountScope,
        _count: {
          _all: true,
        },
      }),
    ]);

    const activeWarehouseId =
      query.warehouseId && warehouses.some((warehouse) => warehouse.id === query.warehouseId)
        ? query.warehouseId
        : null;

    const where: Prisma.WmsInventoryUnitWhereInput = {
      tenantId: scope.activeTenantId,
      ...(activeStoreId ? { storeId: activeStoreId } : {}),
      ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { barcode: { contains: query.search, mode: 'insensitive' } },
              { variationId: { contains: query.search, mode: 'insensitive' } },
              { productId: { contains: query.search, mode: 'insensitive' } },
              { posProduct: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const statusCountScope: Prisma.WmsInventoryUnitWhereInput = {
      tenantId: scope.activeTenantId,
      ...(activeStoreId ? { storeId: activeStoreId } : {}),
      ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
    };

    const [units, totalUnits, locatedUnits, unlocatedUnits, statusCounts] = await Promise.all([
      this.prisma.wmsInventoryUnit.findMany({
        where,
        include: {
          store: {
            select: {
              id: true,
              name: true,
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
          currentLocation: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
            },
          },
          posProduct: {
            select: {
              id: true,
              name: true,
              customId: true,
              productSnapshot: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
      }),
      this.prisma.wmsInventoryUnit.count({ where }),
      this.prisma.wmsInventoryUnit.count({
        where: {
          ...where,
          currentLocationId: { not: null },
        },
      }),
      this.prisma.wmsInventoryUnit.count({
        where: {
          ...where,
          currentLocationId: null,
        },
      }),
      this.prisma.wmsInventoryUnit.groupBy({
        by: ['status'],
        where: statusCountScope,
        _count: {
          _all: true,
        },
      }),
    ]);

    const warehouseCountMap = new Map(
      warehouseCounts.map((record) => [record.warehouseId, record._count._all]),
    );
    const statusCountMap = new Map(
      statusCounts.map((record) => [record.status, record._count._all]),
    );

    return {
      tenantReady: true,
      summary: {
        units: totalUnits,
        locatedUnits,
        unlocatedUnits,
      },
      filters: {
        tenants: scope.tenants,
        stores: stores.map((store) => ({
          id: store.id,
          label: store.shopName || store.name,
          unitCount: store._count.wmsInventoryUnits,
        })),
        warehouses: warehouses.map((warehouse) => ({
          id: warehouse.id,
          code: warehouse.code,
          label: warehouse.name,
          unitCount: warehouseCountMap.get(warehouse.id) ?? 0,
        })),
        statuses: UNIT_STATUS_ORDER.map((status) => ({
          value: status,
          label: this.formatStatusLabel(status),
          unitCount: statusCountMap.get(status) ?? 0,
        })),
        activeTenantId: scope.activeTenantId,
        activeStoreId,
        activeWarehouseId,
        activeStatus: query.status ?? null,
      },
      units: units.map((unit) => this.mapUnit(unit)),
    };
  }

  async getUnitMovements(id: string, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const unit = await this.prisma.wmsInventoryUnit.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Inventory unit was not found');
    }

    if (unit.tenantId !== scope.activeTenantId) {
      throw new ForbiddenException('Selected tenant is outside your WMS scope');
    }

    const movements = await this.prisma.wmsInventoryMovement.findMany({
      where: {
        inventoryUnitId: unit.id,
      },
      include: {
        fromLocation: {
          select: {
            id: true,
            code: true,
            name: true,
            kind: true,
          },
        },
        toLocation: {
          select: {
            id: true,
            code: true,
            name: true,
            kind: true,
          },
        },
        actor: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      movements: movements.map((movement) => this.mapMovement(movement)),
    };
  }

  async getUnitTransferOptions(id: string, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const unit = await this.prisma.wmsInventoryUnit.findUnique({
      where: { id },
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        currentLocation: {
          select: {
            id: true,
            code: true,
            name: true,
            kind: true,
            parentId: true,
            warehouseId: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Inventory unit was not found');
    }

    if (unit.tenantId !== scope.activeTenantId) {
      throw new ForbiddenException('Selected tenant is outside your WMS scope');
    }

    const [structuralLocations, operationalLocations] = await Promise.all([
      this.getActiveStructuralLocationsByWarehouse(unit.warehouseId),
      this.prisma.wmsLocation.findMany({
        where: {
          warehouseId: unit.warehouseId,
          isActive: true,
          kind: {
            in: [...TRANSFER_OPERATIONAL_LOCATION_KINDS],
          },
        },
        select: {
          id: true,
          code: true,
          name: true,
          kind: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
    ]);

    const structure = this.buildTransferStructureMaps(structuralLocations);
    const binOccupancyMap = await this.getBinOccupancyMap(
      structuralLocations
        .filter((location) => location.kind === WmsLocationKind.BIN)
        .map((location) => location.id),
    );

    return {
      unit: {
        id: unit.id,
        code: unit.code,
        status: unit.status,
        warehouse: unit.warehouse,
        currentLocation: unit.currentLocation
          ? {
              id: unit.currentLocation.id,
              code: unit.currentLocation.code,
              name: unit.currentLocation.name,
              kind: unit.currentLocation.kind,
              label: `${unit.warehouse.code} · ${unit.currentLocation.code}`,
            }
          : null,
      },
      sections: structure.sections.map((section) => ({
        id: section.id,
        code: section.code,
        name: section.name,
        label: `${section.code} · ${section.name}`,
        racks: (structure.racksBySectionId.get(section.id) ?? []).map((rack) => ({
          id: rack.id,
          code: rack.code,
          name: rack.name,
          label: `${rack.code} · ${rack.name}`,
          bins: (structure.binsByRackId.get(rack.id) ?? []).map((bin) => {
            const occupiedUnits = binOccupancyMap.get(bin.id) ?? 0;
            const availableUnits =
              bin.capacity === null ? null : Math.max(bin.capacity - occupiedUnits, 0);

            return {
              id: bin.id,
              code: bin.code,
              name: bin.name,
              label: `${bin.code} · ${bin.name}`,
              capacity: bin.capacity,
              occupiedUnits,
              availableUnits,
              isFull: bin.capacity !== null ? occupiedUnits >= bin.capacity : false,
            };
          }),
        })),
      })),
      operationalLocations: operationalLocations.map((location) => ({
        id: location.id,
        code: location.code,
        name: location.name,
        kind: location.kind,
        label: `${location.code} · ${location.name}`,
      })),
    };
  }

  async createTransfer(body: CreateWmsInventoryTransferDto, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const notes = this.cleanOptionalText(body.notes);

    const units = await this.prisma.wmsInventoryUnit.findMany({
      where: {
        id: {
          in: body.unitIds,
        },
      },
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        currentLocation: {
          select: {
            id: true,
            code: true,
            name: true,
            kind: true,
            warehouseId: true,
            parentId: true,
            isActive: true,
          },
        },
      },
    });

    if (units.length !== body.unitIds.length) {
      throw new BadRequestException('One or more selected units no longer exist');
    }

    units.forEach((unit) => {
      if (unit.tenantId !== scope.activeTenantId) {
        throw new ForbiddenException('One or more selected units are outside your WMS scope');
      }

      if (!unit.currentLocationId || !unit.currentLocation) {
        throw new BadRequestException(`Unit ${unit.code} is missing a current location`);
      }

      if (!TRANSFERABLE_UNIT_STATUSES.has(unit.status)) {
        throw new BadRequestException(`Unit ${unit.code} cannot be transferred from status ${unit.status}`);
      }
    });

    const sourceLocationId = units[0].currentLocationId!;
    const warehouseId = units[0].warehouseId;
    const teamId = units[0].teamId;

    if (units.some((unit) => unit.currentLocationId !== sourceLocationId)) {
      throw new BadRequestException('Selected units must come from the same source location');
    }

    if (units.some((unit) => unit.warehouseId !== warehouseId)) {
      throw new BadRequestException('Selected units must belong to the same warehouse');
    }

    const targetLocation = await this.prisma.wmsLocation.findFirst({
      where: {
        id: body.targetLocationId,
        warehouseId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        warehouseId: true,
        capacity: true,
      },
    });

    if (!targetLocation) {
      throw new BadRequestException('Target location is not valid for the warehouse');
    }

    if (targetLocation.id === sourceLocationId) {
      throw new BadRequestException('Target location must be different from the source location');
    }

    if (!this.isTransferDestinationKindAllowed(targetLocation.kind)) {
      throw new BadRequestException('Target location kind is not supported for internal transfer');
    }

    const nextStatus = this.resolveTransferTargetStatus(units[0].status, targetLocation.kind);

    if (targetLocation.kind === WmsLocationKind.BIN && targetLocation.capacity === null) {
      throw new BadRequestException(`Bin ${targetLocation.code} is missing a capacity setting`);
    }

    const transferCode = this.buildTransferCode();
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      if (targetLocation.kind === WmsLocationKind.BIN) {
        const occupiedUnits = await tx.wmsInventoryUnit.count({
          where: {
            currentLocationId: targetLocation.id,
          },
        });
        const availableUnits = Math.max((targetLocation.capacity ?? 0) - occupiedUnits, 0);

        if (units.length > availableUnits) {
          throw new BadRequestException(
            `Bin ${targetLocation.code} has space for ${availableUnits} more unit${availableUnits === 1 ? '' : 's'}, but ${units.length} were selected`,
          );
        }
      }

      const transfer = await tx.wmsTransfer.create({
        data: {
          code: transferCode,
          tenantId: scope.activeTenantId!,
          teamId,
          warehouseId,
          fromLocationId: sourceLocationId,
          toLocationId: targetLocation.id,
          status: WmsTransferStatus.COMPLETED,
          notes,
          createdById: actorId,
          updatedById: actorId,
        },
      });

      await tx.wmsTransferItem.createMany({
        data: units.map((unit, index) => ({
          transferId: transfer.id,
          inventoryUnitId: unit.id,
          lineNo: index + 1,
        })),
      });

      for (const unit of units) {
        await tx.wmsInventoryUnit.update({
          where: { id: unit.id },
          data: {
            currentLocationId: targetLocation.id,
            status: nextStatus,
            ...(actorId ? { updatedById: actorId } : {}),
          },
        });
      }

      await tx.wmsInventoryMovement.createMany({
        data: units.map((unit) => ({
          tenantId: scope.activeTenantId!,
          teamId: unit.teamId,
          inventoryUnitId: unit.id,
          warehouseId: unit.warehouseId,
          fromLocationId: unit.currentLocationId,
          toLocationId: targetLocation.id,
          fromStatus: unit.status,
          toStatus: nextStatus,
          movementType: WmsInventoryMovementType.TRANSFER,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          referenceCode: transfer.code,
          notes,
          actorId,
          createdAt: now,
        })),
      });

      const updatedUnits = await tx.wmsInventoryUnit.findMany({
        where: {
          id: {
            in: units.map((unit) => unit.id),
          },
        },
        include: {
          store: {
            select: {
              id: true,
              name: true,
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
          currentLocation: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
            },
          },
          posProduct: {
            select: {
              id: true,
              name: true,
              customId: true,
              productSnapshot: true,
            },
          },
        },
        orderBy: [{ code: 'asc' }],
      });

      return {
        transfer,
        units: updatedUnits.map((unit) => this.mapUnit(unit)),
      };
    });

    return result;
  }

  async recordUnitLabelPrint(
    id: string,
    body: RecordWmsInventoryUnitLabelPrintDto,
    requestedTenantId?: string,
  ) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const action = body.action ?? 'PRINT';
    const now = new Date();

    const unit = await this.prisma.wmsInventoryUnit.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        firstLabelPrintedAt: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Inventory unit was not found');
    }

    if (unit.tenantId !== scope.activeTenantId) {
      throw new ForbiddenException('Selected tenant is outside your WMS scope');
    }

    const nextUnit = await this.prisma.$transaction(async (tx) => {
      await tx.wmsInventoryUnit.update({
        where: { id: unit.id },
        data: {
          labelPrintCount: {
            increment: 1,
          },
          ...(unit.firstLabelPrintedAt ? {} : { firstLabelPrintedAt: now }),
          lastLabelPrintedAt: now,
          ...(actorId ? { updatedById: actorId } : {}),
        },
      });

      await tx.wmsLabelPrintLog.create({
        data: {
          tenantId: scope.activeTenantId!,
          actorId,
          scope: 'INVENTORY_UNIT',
          action,
          inventoryUnitId: unit.id,
          itemCount: 1,
        },
      });

      return tx.wmsInventoryUnit.findUnique({
        where: { id: unit.id },
        include: {
          store: {
            select: {
              id: true,
              name: true,
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
          currentLocation: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
            },
          },
          posProduct: {
            select: {
              id: true,
              name: true,
              customId: true,
              productSnapshot: true,
            },
          },
        },
      });
    });

    if (!nextUnit) {
      throw new NotFoundException('Inventory unit was not found');
    }

    return {
      print: {
        action,
        itemCount: 1,
      },
      unit: this.mapUnit(nextUnit),
    };
  }

  private async resolveTenantScope(requestedTenantId?: string) {
    const clsTenantId = this.cls.get('tenantId') as string | undefined;
    const userRole = this.cls.get('userRole') as string | undefined;
    const isPlatformUser = userRole === 'SUPER_ADMIN';

    if (isPlatformUser) {
      const tenants = await this.prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
        orderBy: [{ name: 'asc' }],
      });

      const activeTenantId =
        requestedTenantId && tenants.some((tenant) => tenant.id === requestedTenantId)
          ? requestedTenantId
          : tenants[0]?.id ?? null;

      return {
        activeTenantId,
        tenants: tenants.map((tenant) => ({
          id: tenant.id,
          label: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
        })),
      };
    }

    if (!clsTenantId) {
      return {
        activeTenantId: null,
        tenants: [],
      };
    }

    if (requestedTenantId && requestedTenantId !== clsTenantId) {
      throw new ForbiddenException('Selected tenant is outside your WMS scope');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: clsTenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });

    return {
      activeTenantId: clsTenantId,
      tenants: tenant
        ? [
            {
              id: tenant.id,
              label: tenant.name,
              slug: tenant.slug,
              status: tenant.status,
            },
          ]
        : [],
    };
  }

  private mapUnit(unit: InventoryUnitRecord) {
    const snapshot = unit.posProduct.productSnapshot as
      | {
          display_id?: string | null;
          product?: {
            display_id?: string | null;
          } | null;
        }
      | null;
    const variationDisplayId =
      typeof snapshot?.display_id === 'string'
        ? snapshot.display_id
        : typeof snapshot?.product?.display_id === 'string'
          ? snapshot.product.display_id
          : null;

    return {
      id: unit.id,
      code: unit.code,
      barcode: unit.barcode,
      status: unit.status,
      labelPrintCount: unit.labelPrintCount,
      firstLabelPrintedAt: unit.firstLabelPrintedAt,
      lastLabelPrintedAt: unit.lastLabelPrintedAt,
      productId: unit.productId,
      productCustomId: unit.posProduct.customId,
      variationId: unit.variationId,
      variationDisplayId,
      name: unit.posProduct.name,
      store: {
        id: unit.store.id,
        name: unit.store.shopName || unit.store.name,
      },
      warehouse: {
        id: unit.warehouse.id,
        code: unit.warehouse.code,
        name: unit.warehouse.name,
      },
      currentLocation: unit.currentLocation
        ? {
            id: unit.currentLocation.id,
            code: unit.currentLocation.code,
            name: unit.currentLocation.name,
            kind: unit.currentLocation.kind,
            label: `${unit.warehouse.code} · ${unit.currentLocation.code}`,
          }
        : null,
      source: unit.sourceType
        ? {
            type: unit.sourceType,
            refId: unit.sourceRefId,
            label: unit.sourceRefLabel,
          }
        : null,
      notes: unit.notes,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    };
  }

  private mapMovement(movement: InventoryMovementRecord) {
    return {
      id: movement.id,
      movementType: movement.movementType,
      fromStatus: movement.fromStatus,
      fromStatusLabel: movement.fromStatus ? this.formatStatusLabel(movement.fromStatus) : null,
      toStatus: movement.toStatus,
      toStatusLabel: movement.toStatus ? this.formatStatusLabel(movement.toStatus) : null,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      referenceCode: movement.referenceCode,
      notes: movement.notes,
      fromLocation: movement.fromLocation
        ? {
            id: movement.fromLocation.id,
            code: movement.fromLocation.code,
            name: movement.fromLocation.name,
            kind: movement.fromLocation.kind,
          }
        : null,
      toLocation: movement.toLocation
        ? {
            id: movement.toLocation.id,
            code: movement.toLocation.code,
            name: movement.toLocation.name,
            kind: movement.toLocation.kind,
          }
        : null,
      actor: movement.actor
        ? {
            name:
              `${movement.actor.firstName ?? ''} ${movement.actor.lastName ?? ''}`.trim()
              || movement.actor.email,
            email: movement.actor.email,
          }
        : null,
      createdAt: movement.createdAt,
    };
  }

  private async getActiveStructuralLocationsByWarehouse(warehouseId: string) {
    return this.prisma.wmsLocation.findMany({
      where: {
        warehouseId,
        isActive: true,
        kind: {
          in: [...STRUCTURAL_LOCATION_KINDS],
        },
      },
      select: {
        id: true,
        warehouseId: true,
        parentId: true,
        kind: true,
        code: true,
        name: true,
        capacity: true,
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  private async getBinOccupancyMap(binIds: string[]) {
    if (!binIds.length) {
      return new Map<string, number>();
    }

    const counts = await this.prisma.wmsInventoryUnit.groupBy({
      by: ['currentLocationId'],
      where: {
        currentLocationId: {
          in: binIds,
        },
      },
      _count: {
        _all: true,
      },
    });

    return new Map(
      counts.flatMap((record) =>
        record.currentLocationId ? [[record.currentLocationId, record._count._all] as const] : [],
      ),
    );
  }

  private buildTransferStructureMaps(locations: TransferLocationRecord[]): TransferStructureMaps {
    const locationMap = new Map<string, TransferLocationRecord>(
      locations.map((location) => [location.id, location]),
    );
    const sections = locations
      .filter((location) => location.kind === WmsLocationKind.SECTION)
      .sort((left, right) => left.code.localeCompare(right.code));

    const racksBySectionId = new Map<string, TransferLocationRecord[]>();
    const binsByRackId = new Map<string, TransferLocationRecord[]>();

    locations.forEach((location) => {
      if (location.kind === WmsLocationKind.RACK && location.parentId) {
        const racks = racksBySectionId.get(location.parentId) ?? [];
        racks.push(location);
        racksBySectionId.set(location.parentId, racks);
        return;
      }

      if (location.kind === WmsLocationKind.BIN && location.parentId) {
        const bins = binsByRackId.get(location.parentId) ?? [];
        bins.push(location);
        binsByRackId.set(location.parentId, bins);
      }
    });

    racksBySectionId.forEach((racks, sectionId) => {
      racksBySectionId.set(
        sectionId,
        racks.slice().sort((left, right) => left.code.localeCompare(right.code)),
      );
    });

    binsByRackId.forEach((bins, rackId) => {
      binsByRackId.set(
        rackId,
        bins.slice().sort((left, right) => left.code.localeCompare(right.code)),
      );
    });

    return {
      sections,
      locationMap,
      racksBySectionId,
      binsByRackId,
    };
  }

  private isTransferDestinationKindAllowed(kind: WmsLocationKind) {
    return (
      kind === WmsLocationKind.BIN
      || TRANSFER_OPERATIONAL_LOCATION_KINDS.includes(
        kind as (typeof TRANSFER_OPERATIONAL_LOCATION_KINDS)[number],
      )
    );
  }

  private resolveTransferTargetStatus(
    currentStatus: WmsInventoryUnitStatus,
    targetKind: WmsLocationKind,
  ) {
    switch (targetKind) {
      case WmsLocationKind.BIN:
        return WmsInventoryUnitStatus.PUTAWAY;
      case WmsLocationKind.RECEIVING_STAGING:
        return WmsInventoryUnitStatus.STAGED;
      case WmsLocationKind.RTS:
        return WmsInventoryUnitStatus.RTS;
      case WmsLocationKind.DAMAGE:
      case WmsLocationKind.QUARANTINE:
        return WmsInventoryUnitStatus.DAMAGED;
      default:
        return currentStatus;
    }
  }

  private buildTransferCode() {
    return `TRF-${Date.now().toString(36).toUpperCase()}`;
  }

  private cleanOptionalText(value?: string | null) {
    const normalized = value?.trim() ?? null;
    return normalized ? normalized : null;
  }

  private formatStatusLabel(status: WmsInventoryUnitStatus) {
    return status
      .toLowerCase()
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }
}
