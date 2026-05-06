import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WmsInventoryMovementType,
  WmsInventoryUnitSourceType,
  WmsInventoryUnitStatus,
  WmsLocationKind,
  WmsProductProfileStatus,
  WmsPurchasingBatchStatus,
  WmsReceivingBatchStatus,
  WmsWarehouseStatus,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AssignWmsReceivingPutawayDto } from './dto/assign-wms-receiving-putaway.dto';
import { CreateWmsReceivingBatchDto } from './dto/create-wms-receiving-batch.dto';
import { GetWmsReceivingOverviewDto } from './dto/get-wms-receiving-overview.dto';
import { RecordWmsReceivingBatchLabelPrintDto } from './dto/record-wms-receiving-batch-label-print.dto';

type ReceivablePurchasingBatchRecord = Prisma.WmsPurchasingBatchGetPayload<{
  include: {
    store: {
      select: {
        id: true;
        name: true;
        shopName: true;
      };
    };
    lines: {
      orderBy: {
        lineNo: 'asc';
      };
      include: {
        resolvedPosProduct: {
          select: {
            id: true;
            productId: true;
            variationId: true;
            name: true;
            customId: true;
          };
        };
        resolvedProfile: {
          select: {
            id: true;
            productId: true;
            variationId: true;
            status: true;
            isSerialized: true;
            posWarehouseRef: true;
          };
        };
      };
    };
  };
}>;

type ReceivingBatchRecord = Prisma.WmsReceivingBatchGetPayload<{
  include: {
    store: {
      select: {
        id: true;
        name: true;
        shopName: true;
      };
    };
    purchasingBatch: {
      select: {
        id: true;
        sourceRequestId: true;
        requestTitle: true;
      };
    };
    warehouse: {
      select: {
        id: true;
        code: true;
        name: true;
      };
    };
    stagingLocation: {
      select: {
        id: true;
        code: true;
        name: true;
      };
    };
    lines: {
      select: {
        id: true;
        expectedQuantity: true;
        receivedQuantity: true;
      };
    };
    inventoryUnits: {
      select: {
        id: true;
      };
    };
  };
}>;

type ReceivingBatchDetailRecord = Prisma.WmsReceivingBatchGetPayload<{
  include: {
    store: {
      select: {
        id: true;
        name: true;
        shopName: true;
      };
    };
    purchasingBatch: {
      select: {
        id: true;
        sourceRequestId: true;
        requestTitle: true;
        requestType: true;
        status: true;
      };
    };
    warehouse: {
      select: {
        id: true;
        code: true;
        name: true;
      };
    };
    stagingLocation: {
      select: {
        id: true;
        code: true;
        name: true;
      };
    };
    lines: {
      orderBy: {
        lineNo: 'asc';
      };
      include: {
        resolvedPosProduct: {
          select: {
            id: true;
            productId: true;
            variationId: true;
            name: true;
            customId: true;
          };
        };
        resolvedProfile: {
          select: {
            id: true;
            productId: true;
            variationId: true;
            status: true;
            isSerialized: true;
          };
        };
      };
    };
    inventoryUnits: {
      orderBy: {
        createdAt: 'asc';
      };
      include: {
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
          };
        };
      };
    };
  };
}>;

type StructuralLocationRecord = {
  id: string;
  warehouseId: string;
  parentId: string | null;
  kind: WmsLocationKind;
  code: string;
  name: string;
  capacity: number | null;
};

type PutawayStructureMaps = {
  sections: StructuralLocationRecord[];
  locationMap: Map<string, StructuralLocationRecord>;
  racksBySectionId: Map<string, StructuralLocationRecord[]>;
  binsByRackId: Map<string, StructuralLocationRecord[]>;
};

@Injectable()
export class WmsReceivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async getOverview(query: GetWmsReceivingOverviewDto) {
    const scope = await this.resolveTenantScope(query.tenantId);

    if (!scope.activeTenantId) {
      return {
        tenantReady: false,
        summary: {
          receivableBatches: 0,
          receivingBatches: 0,
          stagedBatches: 0,
          stagedUnits: 0,
        },
        filters: {
          tenants: scope.tenants,
          stores: [],
          warehouses: [],
          activeTenantId: null,
          activeStoreId: null,
          activeWarehouseId: null,
        },
        warehouseOptions: [],
        receivableBatches: [],
        receivingBatches: [],
      };
    }

    const stores = await this.prisma.posStore.findMany({
      where: { tenantId: scope.activeTenantId },
      select: {
        id: true,
        name: true,
        shopName: true,
      },
      orderBy: [{ name: 'asc' }],
    });

    const activeStoreId =
      query.storeId && stores.some((store) => store.id === query.storeId)
        ? query.storeId
        : null;

    const search = this.cleanOptionalText(query.search);

    const [warehouses, stagingLocations] = await Promise.all([
      this.prisma.wmsWarehouse.findMany({
        where: { status: WmsWarehouseStatus.ACTIVE },
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: [{ code: 'asc' }],
      }),
      this.prisma.wmsLocation.findMany({
        where: {
          isActive: true,
          kind: WmsLocationKind.RECEIVING_STAGING,
        },
        select: {
          id: true,
          code: true,
          name: true,
          warehouseId: true,
        },
        orderBy: [{ warehouseId: 'asc' }, { code: 'asc' }],
      }),
    ]);

    const activeWarehouseId =
      query.warehouseId && warehouses.some((warehouse) => warehouse.id === query.warehouseId)
        ? query.warehouseId
        : null;

    const receivableWhere: Prisma.WmsPurchasingBatchWhereInput = {
      tenantId: scope.activeTenantId,
      status: {
        in: [
          WmsPurchasingBatchStatus.RECEIVING_READY,
          WmsPurchasingBatchStatus.RECEIVING,
        ],
      },
      ...(activeStoreId ? { storeId: activeStoreId } : {}),
      ...(search
        ? {
            OR: [
              { sourceRequestId: { contains: search, mode: 'insensitive' } },
              { requestTitle: { contains: search, mode: 'insensitive' } },
              {
                lines: {
                  some: {
                    OR: [
                      { requestedProductName: { contains: search, mode: 'insensitive' } },
                      { productId: { contains: search, mode: 'insensitive' } },
                      { variationId: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const receivingWhere: Prisma.WmsReceivingBatchWhereInput = {
      tenantId: scope.activeTenantId,
      ...(activeStoreId ? { storeId: activeStoreId } : {}),
      ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { purchasingBatch: { sourceRequestId: { contains: search, mode: 'insensitive' } } },
              { purchasingBatch: { requestTitle: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [receivableBatches, receivingBatches, receivableCount, receivingCount, stagedBatchCount, stagedUnitCount] =
      await Promise.all([
        this.prisma.wmsPurchasingBatch.findMany({
          where: receivableWhere,
          include: {
            store: {
              select: {
                id: true,
                name: true,
                shopName: true,
              },
            },
            lines: {
              orderBy: [{ lineNo: 'asc' }],
              include: {
                resolvedPosProduct: {
                  select: {
                    id: true,
                    productId: true,
                    variationId: true,
                    name: true,
                    customId: true,
                  },
                },
                resolvedProfile: {
                  select: {
                    id: true,
                    productId: true,
                    variationId: true,
                    status: true,
                    isSerialized: true,
                    posWarehouseRef: true,
                  },
                },
              },
            },
          },
          orderBy: [{ readyForReceivingAt: 'asc' }, { updatedAt: 'asc' }],
        }),
        this.prisma.wmsReceivingBatch.findMany({
          where: receivingWhere,
          include: {
            store: {
              select: {
                id: true,
                name: true,
                shopName: true,
              },
            },
            purchasingBatch: {
              select: {
                id: true,
                sourceRequestId: true,
                requestTitle: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            stagingLocation: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            lines: {
              select: {
                id: true,
                expectedQuantity: true,
                receivedQuantity: true,
              },
            },
            inventoryUnits: {
              select: {
                id: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 20,
        }),
        this.prisma.wmsPurchasingBatch.count({ where: receivableWhere }),
        this.prisma.wmsReceivingBatch.count({ where: receivingWhere }),
        this.prisma.wmsReceivingBatch.count({
          where: {
            tenantId: scope.activeTenantId,
            status: {
              in: [
                WmsReceivingBatchStatus.ARRIVED,
                WmsReceivingBatchStatus.COUNTED,
                WmsReceivingBatchStatus.STAGED,
                WmsReceivingBatchStatus.PUTAWAY_PENDING,
              ],
            },
            ...(activeStoreId ? { storeId: activeStoreId } : {}),
            ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
          },
        }),
        this.prisma.wmsInventoryUnit.count({
          where: {
            tenantId: scope.activeTenantId,
            status: WmsInventoryUnitStatus.STAGED,
            ...(activeStoreId ? { storeId: activeStoreId } : {}),
            ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
          },
        }),
      ]);

    return {
      tenantReady: true,
      summary: {
        receivableBatches: receivableCount,
        receivingBatches: receivingCount,
        stagedBatches: stagedBatchCount,
        stagedUnits: stagedUnitCount,
      },
      filters: {
        tenants: scope.tenants,
        stores: stores.map((store) => ({
          id: store.id,
          label: store.shopName || store.name,
        })),
        warehouses: warehouses.map((warehouse) => ({
          id: warehouse.id,
          code: warehouse.code,
          label: warehouse.name,
        })),
        activeTenantId: scope.activeTenantId,
        activeStoreId,
        activeWarehouseId,
      },
      warehouseOptions: warehouses.map((warehouse) => ({
        id: warehouse.id,
        code: warehouse.code,
        label: warehouse.name,
        stagingLocations: stagingLocations
          .filter((location) => location.warehouseId === warehouse.id)
          .map((location) => ({
            id: location.id,
            code: location.code,
            label: location.name,
          })),
      })),
      receivableBatches: receivableBatches
        .map((batch) => this.mapReceivableBatch(batch))
        .filter((batch) => batch.remainingQuantity > 0),
      receivingBatches: receivingBatches.map((batch) => this.mapReceivingBatchRow(batch)),
    };
  }

  async getBatchById(id: string, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const batch = await this.prisma.wmsReceivingBatch.findUnique({
      where: { id },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            shopName: true,
          },
        },
        purchasingBatch: {
          select: {
            id: true,
            sourceRequestId: true,
            requestTitle: true,
            requestType: true,
            status: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        stagingLocation: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        lines: {
          orderBy: [{ lineNo: 'asc' }],
          include: {
            resolvedPosProduct: {
              select: {
                id: true,
                productId: true,
                variationId: true,
                name: true,
                customId: true,
              },
            },
            resolvedProfile: {
              select: {
                id: true,
                productId: true,
                variationId: true,
                status: true,
                isSerialized: true,
              },
            },
          },
        },
        inventoryUnits: {
          orderBy: [{ createdAt: 'asc' }],
          include: {
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
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Receiving batch was not found');
    }

    this.assertTenantScope(batch.tenantId, scope.activeTenantId);

    return {
      batch: this.mapReceivingBatchDetail(batch),
    };
  }

  async getPutawayOptions(id: string, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const batch = await this.prisma.wmsReceivingBatch.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        tenantId: true,
        status: true,
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        inventoryUnits: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            code: true,
            barcode: true,
            status: true,
            currentLocation: {
              select: {
                id: true,
                parentId: true,
                code: true,
                name: true,
                kind: true,
              },
            },
            productProfile: {
              select: {
                preferredLocationId: true,
              },
            },
            posProduct: {
              select: {
                name: true,
                customId: true,
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Receiving batch was not found');
    }

    this.assertTenantScope(batch.tenantId, scope.activeTenantId);

    const structuralLocations = await this.getActiveStructuralLocationsByWarehouse(batch.warehouse.id);
    const structure = this.buildPutawayStructureMaps(structuralLocations);
    const binOccupancyMap = await this.getBinOccupancyMap(
      structuralLocations
        .filter((location) => location.kind === WmsLocationKind.BIN)
        .map((location) => location.id),
    );

    const sections = structure.sections.map((section) => {
      const racks = structure.racksBySectionId.get(section.id) ?? [];
      return {
        id: section.id,
        code: section.code,
        name: section.name,
        label: `${section.code} · ${section.name}`,
        racks: racks.map((rack) => {
          const bins = structure.binsByRackId.get(rack.id) ?? [];
          return {
            id: rack.id,
            code: rack.code,
            name: rack.name,
            label: `${rack.code} · ${rack.name}`,
            bins: bins.map((bin) => {
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
          };
        }),
      };
    });

    const sectionLabelMap = new Map(sections.map((section) => [section.id, section.label]));

    return {
      batch: {
        id: batch.id,
        code: batch.code,
        status: batch.status,
        warehouse: batch.warehouse,
        unitCount: batch.inventoryUnits.length,
      },
      sections,
      units: batch.inventoryUnits.map((unit) => {
        const defaultSectionId = this.resolveSectionIdFromLocation(
          structure.locationMap,
          unit.productProfile.preferredLocationId,
        );
        const currentPlacement = this.resolvePlacementFromLocation(
          structure.locationMap,
          unit.currentLocation?.id ?? null,
        );

        return {
          id: unit.id,
          code: unit.code,
          barcode: unit.barcode,
          status: unit.status,
          productName: unit.posProduct.name,
          productCustomId: unit.posProduct.customId,
          currentLocation: unit.currentLocation
            ? {
                id: unit.currentLocation.id,
                code: unit.currentLocation.code,
                name: unit.currentLocation.name,
                kind: unit.currentLocation.kind,
              }
            : null,
          defaultSectionId,
          defaultSectionLabel: defaultSectionId ? sectionLabelMap.get(defaultSectionId) ?? null : null,
          currentPlacement,
        };
      }),
    };
  }

  async assignPutaway(id: string, body: AssignWmsReceivingPutawayDto, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    if (!body.assignments.length) {
      throw new BadRequestException('Select at least one unit to assign for put-away');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const batch = await this.prisma.wmsReceivingBatch.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        tenantId: true,
        warehouseId: true,
        inventoryUnits: {
          select: {
            id: true,
            teamId: true,
            currentLocationId: true,
            status: true,
            productProfile: {
              select: {
                preferredLocationId: true,
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Receiving batch was not found');
    }

    this.assertTenantScope(batch.tenantId, scope.activeTenantId);

    if (!batch.inventoryUnits.length) {
      throw new BadRequestException('Receiving batch has no inventory units for put-away');
    }

    const unitMap = new Map(batch.inventoryUnits.map((unit) => [unit.id, unit]));
    const assignmentByUnitId = new Map<string, AssignWmsReceivingPutawayDto['assignments'][number]>();

    body.assignments.forEach((assignment) => {
      if (assignmentByUnitId.has(assignment.unitId)) {
        throw new BadRequestException('Each inventory unit can only be assigned once per submit');
      }

      if (!unitMap.has(assignment.unitId)) {
        throw new BadRequestException('One or more units are outside the selected receiving batch');
      }

      assignmentByUnitId.set(assignment.unitId, assignment);
    });

    const structure = this.buildPutawayStructureMaps(
      await this.getActiveStructuralLocationsByWarehouse(batch.warehouseId),
    );

    const validatedAssignments = body.assignments.map((assignment) => {
      const section = structure.locationMap.get(assignment.sectionId);
      const rack = structure.locationMap.get(assignment.rackId);
      const bin = structure.locationMap.get(assignment.binId);

      if (!section || section.kind !== WmsLocationKind.SECTION) {
        throw new BadRequestException('Selected section is invalid');
      }
      if (!rack || rack.kind !== WmsLocationKind.RACK || rack.parentId !== section.id) {
        throw new BadRequestException('Selected rack does not belong to the selected section');
      }
      if (!bin || bin.kind !== WmsLocationKind.BIN || bin.parentId !== rack.id) {
        throw new BadRequestException('Selected bin does not belong to the selected rack');
      }

      const unit = unitMap.get(assignment.unitId)!;
      const defaultSectionId = this.resolveSectionIdFromLocation(
        structure.locationMap,
        unit.productProfile.preferredLocationId,
      );

      if (defaultSectionId && defaultSectionId !== section.id) {
        throw new BadRequestException(
          `Unit ${unit.id.slice(0, 8)} must be assigned within its default section`,
        );
      }

      return {
        unitId: assignment.unitId,
        teamId: unit.teamId,
        currentLocationId: unit.currentLocationId,
        currentStatus: unit.status,
        binId: bin.id,
        binCode: bin.code,
      };
    });

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const targetBinIds = Array.from(new Set(validatedAssignments.map((assignment) => assignment.binId)));
      const [targetBins, occupancyCounts] = await Promise.all([
        tx.wmsLocation.findMany({
          where: {
            id: {
              in: targetBinIds,
            },
            kind: WmsLocationKind.BIN,
          },
          select: {
            id: true,
            code: true,
            capacity: true,
          },
        }),
        tx.wmsInventoryUnit.groupBy({
          by: ['currentLocationId'],
          where: {
            currentLocationId: {
              in: targetBinIds,
            },
          },
          _count: {
            _all: true,
          },
        }),
      ]);

      const targetBinMap = new Map(targetBins.map((bin) => [bin.id, bin]));
      const occupancyMap = new Map(
        occupancyCounts.flatMap((record) =>
          record.currentLocationId ? [[record.currentLocationId, record._count._all] as const] : [],
        ),
      );
      const assignmentDemandByBin = new Map<string, number>();

      for (const assignment of validatedAssignments) {
        if (assignment.currentLocationId === assignment.binId) {
          continue;
        }

        assignmentDemandByBin.set(
          assignment.binId,
          (assignmentDemandByBin.get(assignment.binId) ?? 0) + 1,
        );
      }

      for (const [binId, demand] of assignmentDemandByBin) {
        const targetBin = targetBinMap.get(binId);
        if (!targetBin) {
          throw new BadRequestException('Selected bin is no longer available');
        }
        if (targetBin.capacity === null) {
          throw new BadRequestException(`Bin ${targetBin.code} is missing a capacity setting`);
        }

        const occupiedUnits = occupancyMap.get(binId) ?? 0;
        const availableUnits = Math.max(targetBin.capacity - occupiedUnits, 0);

        if (demand > availableUnits) {
          throw new BadRequestException(
            `Bin ${targetBin.code} has space for ${availableUnits} more unit${availableUnits === 1 ? '' : 's'}, but ${demand} were selected`,
          );
        }
      }

      for (const assignment of validatedAssignments) {
        await tx.wmsInventoryUnit.update({
          where: { id: assignment.unitId },
          data: {
            currentLocationId: assignment.binId,
            status: WmsInventoryUnitStatus.PUTAWAY,
            ...(actorId ? { updatedById: actorId } : {}),
          },
        });
      }

      await tx.wmsInventoryMovement.createMany({
        data: validatedAssignments.map((assignment) => ({
          tenantId: scope.activeTenantId!,
          teamId: assignment.teamId,
          inventoryUnitId: assignment.unitId,
          warehouseId: batch.warehouseId,
          fromLocationId: assignment.currentLocationId,
          toLocationId: assignment.binId,
          fromStatus: assignment.currentStatus,
          toStatus: WmsInventoryUnitStatus.PUTAWAY,
          movementType: WmsInventoryMovementType.PUTAWAY,
          referenceType: 'RECEIVING_BATCH',
          referenceId: batch.id,
          referenceCode: batch.code,
          notes: `Put away into ${assignment.binCode}`,
          actorId,
          createdAt: now,
        })),
      });

      const [totalUnits, putAwayUnits] = await Promise.all([
        tx.wmsInventoryUnit.count({
          where: {
            receivingBatchId: batch.id,
          },
        }),
        tx.wmsInventoryUnit.count({
          where: {
            receivingBatchId: batch.id,
            status: WmsInventoryUnitStatus.PUTAWAY,
            currentLocation: {
              is: {
                kind: WmsLocationKind.BIN,
              },
            },
          },
        }),
      ]);

      const nextStatus =
        totalUnits > 0 && putAwayUnits === totalUnits
          ? WmsReceivingBatchStatus.COMPLETED
          : WmsReceivingBatchStatus.PUTAWAY_PENDING;

      const nextBatch = await tx.wmsReceivingBatch.update({
        where: { id: batch.id },
        data: {
          status: nextStatus,
          completedAt: nextStatus === WmsReceivingBatchStatus.COMPLETED ? now : null,
          ...(actorId ? { updatedById: actorId } : {}),
        },
        select: {
          id: true,
          code: true,
          status: true,
          completedAt: true,
          updatedAt: true,
        },
      });

      return {
        ...nextBatch,
        totalUnits,
        putAwayUnits,
      };
    });

    return {
      updatedUnitCount: validatedAssignments.length,
      batch: result,
    };
  }

  async createBatch(body: CreateWmsReceivingBatchDto, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const { warehouse, stagingLocation } = await this.resolveReceivingDestination(
      body.warehouseId,
      body.stagingLocationId,
    );

    if (!body.purchasingBatchId) {
      return this.createManualBatch({
        body,
        tenantId: scope.activeTenantId,
        actorId,
        warehouse,
        stagingLocation,
      });
    }

    const purchasingBatch = await this.prisma.wmsPurchasingBatch.findUnique({
      where: { id: body.purchasingBatchId },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            shopName: true,
          },
        },
        lines: {
          orderBy: [{ lineNo: 'asc' }],
          include: {
            resolvedPosProduct: {
              select: {
                id: true,
                productId: true,
                variationId: true,
                name: true,
                customId: true,
              },
            },
            resolvedProfile: {
              select: {
                id: true,
                productId: true,
                variationId: true,
                status: true,
                isSerialized: true,
                posWarehouseRef: true,
                supplierUnitCost: true,
                inhouseUnitCost: true,
              },
            },
          },
        },
      },
    });

    if (!purchasingBatch) {
      throw new NotFoundException('Purchasing batch was not found');
    }

    this.assertTenantScope(purchasingBatch.tenantId, scope.activeTenantId);

    if (
      purchasingBatch.status !== WmsPurchasingBatchStatus.RECEIVING_READY
      && purchasingBatch.status !== WmsPurchasingBatchStatus.RECEIVING
    ) {
      throw new BadRequestException('Selected purchasing batch is not ready for receiving');
    }

    const requestedLineMap = new Map(
      (body.lines ?? [])
        .filter((line) => line.purchasingBatchLineId)
        .map((line) => [line.purchasingBatchLineId as string, line]),
    );

    const selectedLines = purchasingBatch.lines
      .map((line) => {
        const expectedQuantity = line.approvedQuantity ?? line.requestedQuantity;
        const remainingQuantity = Math.max(expectedQuantity - line.receivedQuantity, 0);
        const requestLine = requestedLineMap.get(line.id);
        const receiveQuantity = requestLine ? requestLine.receiveQuantity : remainingQuantity;

        return {
          purchasingLine: line,
          remainingQuantity,
          receiveQuantity,
          unitCost:
            requestLine?.unitCost
            ?? this.toNumber(line.supplierUnitCost)
            ?? this.toNumber(line.partnerUnitCost)
            ?? this.toNumber(line.resolvedProfile?.supplierUnitCost)
            ?? this.toNumber(line.resolvedProfile?.inhouseUnitCost),
          notes: this.cleanOptionalText(requestLine?.notes),
        };
      })
      .filter((line) => line.receiveQuantity > 0);

    if (!selectedLines.length) {
      throw new BadRequestException('Select at least one receiving line with quantity greater than zero');
    }

    selectedLines.forEach((entry) => {
      if (entry.receiveQuantity > entry.remainingQuantity) {
        throw new BadRequestException(
          `Line ${entry.purchasingLine.lineNo}: receive quantity exceeds remaining quantity`,
        );
      }

      if (!entry.purchasingLine.resolvedPosProductId || !entry.purchasingLine.resolvedProfileId) {
        throw new BadRequestException(
          `Line ${entry.purchasingLine.lineNo}: receiving requires a resolved product profile`,
        );
      }

      if (entry.purchasingLine.resolvedProfile?.status === WmsProductProfileStatus.ARCHIVED) {
        throw new BadRequestException(
          `Line ${entry.purchasingLine.lineNo}: archived product profiles cannot be received`,
        );
      }

      if (!entry.purchasingLine.productId && !entry.purchasingLine.resolvedProfile?.productId) {
        throw new BadRequestException(
          `Line ${entry.purchasingLine.lineNo}: missing product identifier for receiving`,
        );
      }

      if (!entry.purchasingLine.variationId && !entry.purchasingLine.resolvedProfile?.variationId) {
        throw new BadRequestException(
          `Line ${entry.purchasingLine.lineNo}: missing variation identifier for receiving`,
        );
      }
    });

    const receivingCode = this.buildReceivingCode();
    const now = new Date();
    const tenantRecord = await this.prisma.tenant.findUnique({
      where: { id: scope.activeTenantId! },
      select: {
        slug: true,
        name: true,
      },
    });
    const partnerRequestLabel = this.resolvePartnerRequestLabel({
      tenantSlug: tenantRecord?.slug ?? null,
      tenantName: tenantRecord?.name ?? null,
      requestTitle: purchasingBatch.requestTitle,
      sourceRequestId: purchasingBatch.sourceRequestId,
      storeShopName: purchasingBatch.store.shopName,
      storeName: purchasingBatch.store.name,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const receivingBatch = await tx.wmsReceivingBatch.create({
        data: {
          code: receivingCode,
          tenantId: scope.activeTenantId!,
          teamId: purchasingBatch.teamId,
          storeId: purchasingBatch.storeId,
          purchasingBatchId: purchasingBatch.id,
          warehouseId: warehouse.id,
          stagingLocationId: stagingLocation.id,
          status: WmsReceivingBatchStatus.STAGED,
          notes: this.cleanOptionalText(body.notes),
          receivedAt: now,
          createdById: actorId,
          updatedById: actorId,
          lines: {
            createMany: {
              data: selectedLines.map((entry, index) => ({
                tenantId: scope.activeTenantId!,
                storeId: purchasingBatch.storeId,
                lineNo: index + 1,
                purchasingBatchLineId: entry.purchasingLine.id,
                resolvedPosProductId: entry.purchasingLine.resolvedPosProductId,
                resolvedProfileId: entry.purchasingLine.resolvedProfileId,
                productId: entry.purchasingLine.productId ?? entry.purchasingLine.resolvedProfile?.productId,
                variationId:
                  entry.purchasingLine.variationId ?? entry.purchasingLine.resolvedProfile?.variationId,
                requestedProductName: entry.purchasingLine.requestedProductName,
                expectedQuantity: entry.remainingQuantity,
                receivedQuantity: entry.receiveQuantity,
                unitCost: this.decimalOrNull(entry.unitCost),
                notes: entry.notes,
                createdById: actorId,
                updatedById: actorId,
              })),
            },
          },
        },
        select: { id: true },
      });

      const unitCodePrefix = this.buildUnitCodePrefix(partnerRequestLabel, warehouse.code);
      let nextUnitNumber = await this.getNextUnitNumber(tx, unitCodePrefix);
      const unitRows = selectedLines.flatMap((entry) =>
        Array.from({ length: entry.receiveQuantity }, () => {
          const unitIdentifier = this.buildUnitIdentifier(unitCodePrefix, nextUnitNumber);
          nextUnitNumber += 1;

          return {
            tenantId: scope.activeTenantId!,
            teamId: purchasingBatch.teamId,
            storeId: purchasingBatch.storeId,
            posProductId: entry.purchasingLine.resolvedPosProductId!,
            productProfileId: entry.purchasingLine.resolvedProfileId!,
            warehouseId: warehouse.id,
            receivingBatchId: receivingBatch.id,
            currentLocationId: stagingLocation.id,
            productId: entry.purchasingLine.productId ?? entry.purchasingLine.resolvedProfile!.productId,
            variationId: entry.purchasingLine.variationId ?? entry.purchasingLine.resolvedProfile!.variationId,
            posWarehouseRef: entry.purchasingLine.resolvedProfile?.posWarehouseRef ?? null,
            code: unitIdentifier,
            barcode: unitIdentifier,
            status: WmsInventoryUnitStatus.STAGED,
            sourceType: WmsInventoryUnitSourceType.RECEIVING,
            sourceRefId: receivingBatch.id,
            sourceRefLabel: receivingCode,
            notes: entry.notes,
            createdById: actorId,
            updatedById: actorId,
          };
        }),
      );

      await tx.wmsInventoryUnit.createMany({
        data: unitRows,
      });

      const createdUnits = await tx.wmsInventoryUnit.findMany({
        where: {
          receivingBatchId: receivingBatch.id,
          code: {
            in: unitRows.map((row) => row.code),
          },
        },
        select: {
          id: true,
          teamId: true,
        },
      });

      if (createdUnits.length) {
        await tx.wmsInventoryMovement.createMany({
          data: createdUnits.map((unit) => ({
            tenantId: scope.activeTenantId!,
            teamId: unit.teamId,
            inventoryUnitId: unit.id,
            warehouseId: warehouse.id,
            fromLocationId: null,
            toLocationId: stagingLocation.id,
            fromStatus: null,
            toStatus: WmsInventoryUnitStatus.STAGED,
            movementType: WmsInventoryMovementType.RECEIPT,
            referenceType: 'RECEIVING_BATCH',
            referenceId: receivingBatch.id,
            referenceCode: receivingCode,
            notes: this.cleanOptionalText(body.notes),
            actorId,
            createdAt: now,
          })),
        });
      }

      for (const entry of selectedLines) {
        await tx.wmsPurchasingBatchLine.update({
          where: { id: entry.purchasingLine.id },
          data: {
            receivedQuantity: {
              increment: entry.receiveQuantity,
            },
            updatedById: actorId,
          },
        });
      }

      const hasRemaining = purchasingBatch.lines.some((line) => {
        const increment = selectedLines.find((entry) => entry.purchasingLine.id === line.id)?.receiveQuantity ?? 0;
        const expected = line.approvedQuantity ?? line.requestedQuantity;
        return line.receivedQuantity + increment < expected;
      });

      const nextPurchasingStatus = hasRemaining
        ? WmsPurchasingBatchStatus.RECEIVING
        : WmsPurchasingBatchStatus.STOCKED;

      await tx.wmsPurchasingBatch.update({
        where: { id: purchasingBatch.id },
        data: {
          status: nextPurchasingStatus,
          updatedById: actorId,
        },
      });

      await tx.wmsPurchasingEvent.create({
        data: {
          batchId: purchasingBatch.id,
          tenantId: scope.activeTenantId!,
          eventType: 'RECEIVING_BATCH_CREATED',
          fromStatus: purchasingBatch.status,
          toStatus: nextPurchasingStatus,
          message: `Receiving batch ${receivingCode} created`,
          payload: {
            receivingBatchId: receivingBatch.id,
            warehouseId: warehouse.id,
            stagingLocationId: stagingLocation.id,
            receivedQuantity: unitRows.length,
          },
          actorId,
        },
      });

      return receivingBatch.id;
    });

    return this.getBatchById(created, scope.activeTenantId);
  }

  private async createManualBatch(input: {
    body: CreateWmsReceivingBatchDto;
    tenantId: string;
    actorId: string | null;
    warehouse: {
      id: string;
      code: string;
      name: string;
    };
    stagingLocation: {
      id: string;
      code: string;
      name: string;
    };
  }) {
    const { body, tenantId, actorId, warehouse, stagingLocation } = input;

    if (!body.storeId) {
      throw new BadRequestException('Store is required for manual stock receiving');
    }

    const store = await this.prisma.posStore.findFirst({
      where: {
        id: body.storeId,
        tenantId,
      },
      select: {
        id: true,
        name: true,
        shopName: true,
        teamId: true,
      },
    });

    if (!store) {
      throw new BadRequestException('Selected store is not valid for manual stock receiving');
    }

    const requestedLines = (body.lines ?? []).filter(
      (line) => line.profileId && line.receiveQuantity > 0,
    );

    if (!requestedLines.length) {
      throw new BadRequestException('Select at least one product and quantity for manual stock input');
    }

    const profileIds = Array.from(
      new Set(requestedLines.map((line) => line.profileId).filter(Boolean) as string[]),
    );

    const profiles = await this.prisma.wmsProductProfile.findMany({
      where: {
        id: {
          in: profileIds,
        },
        tenantId,
        storeId: store.id,
      },
      include: {
        posProduct: {
          select: {
            id: true,
            name: true,
            customId: true,
          },
        },
      },
    });

    if (profiles.length !== profileIds.length) {
      throw new BadRequestException('One or more selected products are no longer available for receiving');
    }

    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const selectedLines = requestedLines.map((line, index) => {
      const profile = profileMap.get(line.profileId!);

      if (!profile) {
        throw new BadRequestException(`Manual receiving line ${index + 1} has an invalid product`);
      }

      if (profile.status === WmsProductProfileStatus.ARCHIVED) {
        throw new BadRequestException(`Product ${profile.posProduct.name} is archived and cannot be received`);
      }

      return {
        lineNo: index + 1,
        profile,
        receiveQuantity: Math.max(0, Math.floor(line.receiveQuantity)),
        unitCost:
          line.unitCost
          ?? this.toNumber(profile.supplierUnitCost)
          ?? this.toNumber(profile.inhouseUnitCost),
        notes: this.cleanOptionalText(line.notes),
      };
    });

    const receivingCode = this.buildReceivingCode();
    const now = new Date();
    const tenantRecord = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        slug: true,
        name: true,
      },
    });
    const partnerRequestLabel = this.resolvePartnerRequestLabel({
      tenantSlug: tenantRecord?.slug ?? null,
      tenantName: tenantRecord?.name ?? null,
      requestTitle: 'Manual stock input',
      sourceRequestId: null,
      storeShopName: store.shopName,
      storeName: store.name,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const receivingBatch = await tx.wmsReceivingBatch.create({
        data: {
          code: receivingCode,
          tenantId,
          teamId: store.teamId,
          storeId: store.id,
          warehouseId: warehouse.id,
          stagingLocationId: stagingLocation.id,
          status: WmsReceivingBatchStatus.STAGED,
          notes: this.cleanOptionalText(body.notes),
          receivedAt: now,
          createdById: actorId,
          updatedById: actorId,
          lines: {
            createMany: {
              data: selectedLines.map((entry) => ({
                tenantId,
                storeId: store.id,
                lineNo: entry.lineNo,
                resolvedPosProductId: entry.profile.posProductId,
                resolvedProfileId: entry.profile.id,
                productId: entry.profile.productId,
                variationId: entry.profile.variationId,
                requestedProductName: entry.profile.posProduct.name,
                expectedQuantity: entry.receiveQuantity,
                receivedQuantity: entry.receiveQuantity,
                unitCost: this.decimalOrNull(entry.unitCost),
                notes: entry.notes,
                createdById: actorId,
                updatedById: actorId,
              })),
            },
          },
        },
        select: { id: true },
      });

      const unitCodePrefix = this.buildUnitCodePrefix(partnerRequestLabel, warehouse.code);
      let nextUnitNumber = await this.getNextUnitNumber(tx, unitCodePrefix);
      const unitRows = selectedLines.flatMap((entry) =>
        Array.from({ length: entry.receiveQuantity }, () => {
          const unitIdentifier = this.buildUnitIdentifier(unitCodePrefix, nextUnitNumber);
          nextUnitNumber += 1;

          return {
            tenantId,
            teamId: store.teamId,
            storeId: store.id,
            posProductId: entry.profile.posProductId,
            productProfileId: entry.profile.id,
            warehouseId: warehouse.id,
            receivingBatchId: receivingBatch.id,
            currentLocationId: stagingLocation.id,
            productId: entry.profile.productId,
            variationId: entry.profile.variationId,
            posWarehouseRef: entry.profile.posWarehouseRef ?? null,
            code: unitIdentifier,
            barcode: unitIdentifier,
            status: WmsInventoryUnitStatus.STAGED,
            sourceType: WmsInventoryUnitSourceType.MANUAL_INPUT,
            sourceRefId: receivingBatch.id,
            sourceRefLabel: receivingCode,
            notes: entry.notes,
            createdById: actorId,
            updatedById: actorId,
          };
        }),
      );

      await tx.wmsInventoryUnit.createMany({
        data: unitRows,
      });

      const createdUnits = await tx.wmsInventoryUnit.findMany({
        where: {
          receivingBatchId: receivingBatch.id,
          code: {
            in: unitRows.map((row) => row.code),
          },
        },
        select: {
          id: true,
          teamId: true,
        },
      });

      if (createdUnits.length) {
        await tx.wmsInventoryMovement.createMany({
          data: createdUnits.map((unit) => ({
            tenantId,
            teamId: unit.teamId,
            inventoryUnitId: unit.id,
            warehouseId: warehouse.id,
            fromLocationId: null,
            toLocationId: stagingLocation.id,
            fromStatus: null,
            toStatus: WmsInventoryUnitStatus.STAGED,
            movementType: WmsInventoryMovementType.MANUAL_RECEIPT,
            referenceType: 'RECEIVING_BATCH',
            referenceId: receivingBatch.id,
            referenceCode: receivingCode,
            notes: this.cleanOptionalText(body.notes),
            actorId,
            createdAt: now,
          })),
        });
      }

      return receivingBatch.id;
    });

    return this.getBatchById(created, tenantId);
  }

  private async resolveReceivingDestination(warehouseId: string, stagingLocationId: string) {
    const warehouse = await this.prisma.wmsWarehouse.findFirst({
      where: {
        id: warehouseId,
        status: WmsWarehouseStatus.ACTIVE,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (!warehouse) {
      throw new BadRequestException('Selected warehouse is not active');
    }

    const stagingLocation = await this.prisma.wmsLocation.findFirst({
      where: {
        id: stagingLocationId,
        warehouseId: warehouse.id,
        isActive: true,
        kind: WmsLocationKind.RECEIVING_STAGING,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (!stagingLocation) {
      throw new BadRequestException('Selected staging location is invalid for the warehouse');
    }

    return {
      warehouse,
      stagingLocation,
    };
  }

  async recordBatchLabelPrint(
    id: string,
    body: RecordWmsReceivingBatchLabelPrintDto,
    requestedTenantId?: string,
  ) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const action = body.action ?? 'PRINT';
    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const now = new Date();

    const batch = await this.prisma.wmsReceivingBatch.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        tenantId: true,
        firstLabelPrintedAt: true,
        inventoryUnits: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Receiving batch was not found');
    }

    this.assertTenantScope(batch.tenantId, scope.activeTenantId);

    const unitIds = batch.inventoryUnits.map((unit) => unit.id);

    const updatedBatch = await this.prisma.$transaction(async (tx) => {
      const nextBatch = await tx.wmsReceivingBatch.update({
        where: { id: batch.id },
        data: {
          labelPrintCount: {
            increment: 1,
          },
          ...(batch.firstLabelPrintedAt ? {} : { firstLabelPrintedAt: now }),
          lastLabelPrintedAt: now,
          ...(actorId ? { updatedById: actorId } : {}),
        },
        select: {
          id: true,
          code: true,
          labelPrintCount: true,
          firstLabelPrintedAt: true,
          lastLabelPrintedAt: true,
        },
      });

      if (unitIds.length > 0) {
        await tx.wmsInventoryUnit.updateMany({
          where: {
            id: {
              in: unitIds,
            },
            firstLabelPrintedAt: null,
          },
          data: {
            firstLabelPrintedAt: now,
          },
        });

        await tx.wmsInventoryUnit.updateMany({
          where: {
            id: {
              in: unitIds,
            },
          },
          data: {
            labelPrintCount: {
              increment: 1,
            },
            lastLabelPrintedAt: now,
            ...(actorId ? { updatedById: actorId } : {}),
          },
        });
      }

      await tx.wmsLabelPrintLog.create({
        data: {
          tenantId: scope.activeTenantId!,
          actorId,
          scope: 'RECEIVING_BATCH',
          action,
          receivingBatchId: batch.id,
          itemCount: unitIds.length,
        },
      });

      return nextBatch;
    });

    return {
      print: {
        action,
        itemCount: unitIds.length,
      },
      batch: updatedBatch,
    };
  }

  private async getActiveStructuralLocationsByWarehouse(warehouseId: string) {
    return this.prisma.wmsLocation.findMany({
      where: {
        warehouseId,
        isActive: true,
        kind: {
          in: [WmsLocationKind.SECTION, WmsLocationKind.RACK, WmsLocationKind.BIN],
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

  private buildPutawayStructureMaps(locations: StructuralLocationRecord[]): PutawayStructureMaps {
    const locationMap = new Map<string, StructuralLocationRecord>(
      locations.map((location) => [location.id, location]),
    );
    const sections = locations
      .filter((location) => location.kind === WmsLocationKind.SECTION)
      .sort((left, right) => left.code.localeCompare(right.code));

    const racksBySectionId = new Map<string, StructuralLocationRecord[]>();
    const binsByRackId = new Map<string, StructuralLocationRecord[]>();

    locations.forEach((location) => {
      if (location.kind === WmsLocationKind.RACK && location.parentId) {
        const list = racksBySectionId.get(location.parentId) ?? [];
        list.push(location);
        racksBySectionId.set(location.parentId, list);
        return;
      }

      if (location.kind === WmsLocationKind.BIN && location.parentId) {
        const list = binsByRackId.get(location.parentId) ?? [];
        list.push(location);
        binsByRackId.set(location.parentId, list);
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

  private resolveSectionIdFromLocation(
    locationMap: Map<string, StructuralLocationRecord>,
    locationId: string | null | undefined,
  ) {
    if (!locationId) {
      return null;
    }

    const location = locationMap.get(locationId);
    if (!location) {
      return null;
    }

    if (location.kind === WmsLocationKind.SECTION) {
      return location.id;
    }

    if (location.kind === WmsLocationKind.RACK) {
      const section = location.parentId ? locationMap.get(location.parentId) : null;
      return section?.kind === WmsLocationKind.SECTION ? section.id : null;
    }

    if (location.kind === WmsLocationKind.BIN) {
      const rack = location.parentId ? locationMap.get(location.parentId) : null;
      if (!rack || rack.kind !== WmsLocationKind.RACK) {
        return null;
      }

      const section = rack.parentId ? locationMap.get(rack.parentId) : null;
      return section?.kind === WmsLocationKind.SECTION ? section.id : null;
    }

    return null;
  }

  private resolvePlacementFromLocation(
    locationMap: Map<string, StructuralLocationRecord>,
    locationId: string | null,
  ) {
    if (!locationId) {
      return null;
    }

    const location = locationMap.get(locationId);
    if (!location) {
      return null;
    }

    if (location.kind === WmsLocationKind.SECTION) {
      return {
        sectionId: location.id,
        rackId: null,
        binId: null,
      };
    }

    if (location.kind === WmsLocationKind.RACK) {
      const section = location.parentId ? locationMap.get(location.parentId) : null;
      if (!section || section.kind !== WmsLocationKind.SECTION) {
        return null;
      }

      return {
        sectionId: section.id,
        rackId: location.id,
        binId: null,
      };
    }

    if (location.kind === WmsLocationKind.BIN) {
      const rack = location.parentId ? locationMap.get(location.parentId) : null;
      if (!rack || rack.kind !== WmsLocationKind.RACK) {
        return null;
      }

      const section = rack.parentId ? locationMap.get(rack.parentId) : null;
      if (!section || section.kind !== WmsLocationKind.SECTION) {
        return null;
      }

      return {
        sectionId: section.id,
        rackId: rack.id,
        binId: location.id,
      };
    }

    return null;
  }

  private mapReceivableBatch(batch: ReceivablePurchasingBatchRecord) {
    const lines = batch.lines.map((line) => {
      const expectedQuantity = line.approvedQuantity ?? line.requestedQuantity;
      const remainingQuantity = Math.max(expectedQuantity - line.receivedQuantity, 0);

      return {
        id: line.id,
        lineNo: line.lineNo,
        requestedProductName: line.requestedProductName,
        productId: line.productId,
        variationId: line.variationId,
        expectedQuantity,
        receivedQuantity: line.receivedQuantity,
        remainingQuantity,
        resolvedPosProduct: line.resolvedPosProduct
          ? {
              id: line.resolvedPosProduct.id,
              name: line.resolvedPosProduct.name,
              customId: line.resolvedPosProduct.customId,
            }
          : null,
        resolvedProfile: line.resolvedProfile
          ? {
              id: line.resolvedProfile.id,
              status: line.resolvedProfile.status,
              isSerialized: line.resolvedProfile.isSerialized,
            }
          : null,
        notes: line.notes,
      };
    });

    return {
      id: batch.id,
      sourceRequestId: batch.sourceRequestId,
      requestTitle: batch.requestTitle,
      requestType: batch.requestType,
      status: batch.status,
      store: {
        id: batch.store.id,
        name: batch.store.shopName || batch.store.name,
      },
      lineCount: batch.lines.length,
      remainingQuantity: lines.reduce((sum, line) => sum + line.remainingQuantity, 0),
      readyForReceivingAt: batch.readyForReceivingAt,
      lines,
    };
  }

  private mapReceivingBatchRow(batch: ReceivingBatchRecord) {
    return {
      id: batch.id,
      code: batch.code,
      status: batch.status,
      sourceRequestId: batch.purchasingBatch?.sourceRequestId ?? null,
      requestTitle: batch.purchasingBatch?.requestTitle ?? null,
      store: {
        id: batch.store.id,
        name: batch.store.shopName || batch.store.name,
      },
      warehouse: {
        id: batch.warehouse.id,
        code: batch.warehouse.code,
        name: batch.warehouse.name,
      },
      stagingLocation: batch.stagingLocation
        ? {
            id: batch.stagingLocation.id,
            code: batch.stagingLocation.code,
            name: batch.stagingLocation.name,
          }
        : null,
      lineCount: batch.lines.length,
      expectedQuantity: batch.lines.reduce((sum, line) => sum + line.expectedQuantity, 0),
      receivedQuantity: batch.lines.reduce((sum, line) => sum + line.receivedQuantity, 0),
      unitCount: batch.inventoryUnits.length,
      labelPrintCount: batch.labelPrintCount,
      firstLabelPrintedAt: batch.firstLabelPrintedAt,
      lastLabelPrintedAt: batch.lastLabelPrintedAt,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };
  }

  private mapReceivingBatchDetail(batch: ReceivingBatchDetailRecord) {
    return {
      id: batch.id,
      code: batch.code,
      status: batch.status,
      notes: batch.notes,
      labelPrintCount: batch.labelPrintCount,
      firstLabelPrintedAt: batch.firstLabelPrintedAt,
      lastLabelPrintedAt: batch.lastLabelPrintedAt,
      receivedAt: batch.receivedAt,
      completedAt: batch.completedAt,
      sourceRequestId: batch.purchasingBatch?.sourceRequestId ?? null,
      requestTitle: batch.purchasingBatch?.requestTitle ?? null,
      requestType: batch.purchasingBatch?.requestType ?? null,
      purchasingStatus: batch.purchasingBatch?.status ?? null,
      store: {
        id: batch.store.id,
        name: batch.store.shopName || batch.store.name,
      },
      warehouse: {
        id: batch.warehouse.id,
        code: batch.warehouse.code,
        name: batch.warehouse.name,
      },
      stagingLocation: batch.stagingLocation
        ? {
            id: batch.stagingLocation.id,
            code: batch.stagingLocation.code,
            name: batch.stagingLocation.name,
          }
        : null,
      lines: batch.lines.map((line) => ({
        id: line.id,
        lineNo: line.lineNo,
        requestedProductName: line.requestedProductName,
        productId: line.productId,
        variationId: line.variationId,
        expectedQuantity: line.expectedQuantity,
        receivedQuantity: line.receivedQuantity,
        unitCost: this.toNumber(line.unitCost),
        resolvedPosProduct: line.resolvedPosProduct
          ? {
              id: line.resolvedPosProduct.id,
              name: line.resolvedPosProduct.name,
              customId: line.resolvedPosProduct.customId,
            }
          : null,
        resolvedProfile: line.resolvedProfile
          ? {
              id: line.resolvedProfile.id,
              status: line.resolvedProfile.status,
              isSerialized: line.resolvedProfile.isSerialized,
            }
          : null,
        notes: line.notes,
      })),
      units: batch.inventoryUnits.map((unit) => ({
        id: unit.id,
        code: unit.code,
        barcode: unit.barcode,
        status: unit.status,
        labelPrintCount: unit.labelPrintCount,
        firstLabelPrintedAt: unit.firstLabelPrintedAt,
        lastLabelPrintedAt: unit.lastLabelPrintedAt,
        productId: unit.productId,
        variationId: unit.variationId,
        productName: unit.posProduct.name,
        productCustomId: unit.posProduct.customId,
        currentLocation: unit.currentLocation
          ? {
              id: unit.currentLocation.id,
              code: unit.currentLocation.code,
              name: unit.currentLocation.name,
              kind: unit.currentLocation.kind,
            }
          : null,
        createdAt: unit.createdAt,
      })),
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };
  }

  private buildReceivingCode() {
    return `RCV-${Date.now().toString(36).toUpperCase()}`;
  }

  private buildUnitCodePrefix(partnerName: string, warehouseCode: string) {
    const partnerInitials = this.buildPartnerInitials(partnerName);
    const warehouseToken = this.buildWarehouseToken(warehouseCode);
    return `${partnerInitials}${warehouseToken}`;
  }

  private resolvePartnerRequestLabel(input: {
    tenantSlug: string | null;
    tenantName: string | null;
    requestTitle: string | null;
    sourceRequestId: string | null;
    storeShopName: string | null;
    storeName: string | null;
  }) {
    return (
      this.cleanOptionalText(input.tenantSlug)
      || this.cleanOptionalText(input.tenantName)
      || this.cleanOptionalText(input.requestTitle)
      || this.cleanOptionalText(input.sourceRequestId)
      || this.cleanOptionalText(input.storeShopName)
      || this.cleanOptionalText(input.storeName)
      || 'partner'
    );
  }

  private buildPartnerInitials(partnerName: string) {
    const normalized = partnerName.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').trim();
    const words = normalized.split(/\s+/).filter(Boolean);
    const initials = words.map((word) => word[0]).join('').slice(0, 3);
    const compact = normalized.replace(/[^A-Z0-9]/g, '');

    return (initials || compact || 'PRT').padEnd(3, 'X').slice(0, 3);
  }

  private buildWarehouseToken(warehouseCode: string) {
    const digits = warehouseCode.replace(/[^0-9]/g, '');
    if (digits.length >= 2) {
      return digits.slice(-2);
    }

    const alphanumeric = warehouseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return (digits + alphanumeric).padEnd(2, '0').slice(0, 2);
  }

  private async getNextUnitNumber(tx: Prisma.TransactionClient, prefix: string) {
    const latest = await tx.wmsInventoryUnit.findMany({
      where: {
        code: {
          startsWith: prefix,
        },
      },
      select: {
        code: true,
      },
      orderBy: [{ code: 'desc' }],
      take: 25,
    });

    const regex = new RegExp(`^${prefix}(\\d{8})$`);
    const max = latest.reduce((currentMax, row) => {
      const match = row.code.match(regex);
      if (!match) {
        return currentMax;
      }

      const parsed = Number(match[1]);
      if (!Number.isFinite(parsed)) {
        return currentMax;
      }

      return Math.max(currentMax, parsed);
    }, 0);

    return max + 1;
  }

  private buildUnitIdentifier(prefix: string, unitNumber: number) {
    return `${prefix}${unitNumber.toString().padStart(8, '0')}`;
  }

  private cleanOptionalText(value?: string | null) {
    const normalized = value?.trim() ?? null;
    return normalized ? normalized : null;
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    return Number(value);
  }

  private decimalOrNull(value: number | null | undefined) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return null;
    }

    return new Prisma.Decimal(value);
  }

  private assertTenantScope(batchTenantId: string, activeTenantId: string | null) {
    if (!activeTenantId || batchTenantId !== activeTenantId) {
      throw new ForbiddenException('Selected tenant is outside your WMS scope');
    }
  }

  private async resolveTenantScope(requestedTenantId?: string) {
    const clsTenantId = this.cls.get('tenantId') as string | undefined;
    const userRole = this.cls.get('userRole') as string | undefined;
    const isPlatformUser = userRole === 'SUPER_ADMIN';
    const hasGlobalWmsAccess = this.cls.get('wmsGlobalAccess') === true;

    if (isPlatformUser || hasGlobalWmsAccess) {
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
          : clsTenantId && tenants.some((tenant) => tenant.id === clsTenantId)
            ? clsTenantId
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
}
