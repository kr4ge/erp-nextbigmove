import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WmsInvoiceSourceType,
  WmsInvoiceStatus,
  WmsBasketUnitStatus,
  WmsInventoryMovementType,
  WmsInventoryUnitSourceType,
  WmsInventoryUnitStatus,
  WmsLocationKind,
  WmsPickReservationStatus,
  WmsProductProfileStatus,
  WmsPurchasingBatchStatus,
  WmsReceivingBatchStatus,
  WmsTransferStatus,
  WmsWarehouseStatus,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationStateService } from '../../common/services/notification-state.service';
import { WmsFulfillmentSyncService } from '../wms-fulfillment/wms-fulfillment-sync.service';
import { WmsPurchasingService } from '../wms-purchasing/wms-purchasing.service';
import { WorkflowExecutionGateway } from '../workflows/gateways/workflow-execution.gateway';
import {
  deriveReceivingBatchStatus,
  RECEIVING_BATCH_COMPLETED_BIN_UNIT_STATUSES,
  RECEIVING_BATCH_COMPLETED_NON_BIN_UNIT_STATUSES,
} from './wms-receiving-batch-status.util';
import { AssignWmsReceivingPutawayDto } from './dto/assign-wms-receiving-putaway.dto';
import { CreateWmsReceivingBatchDto } from './dto/create-wms-receiving-batch.dto';
import { GetWmsReceivingOverviewDto } from './dto/get-wms-receiving-overview.dto';
import { RecordWmsReceivingBatchLabelPrintDto } from './dto/record-wms-receiving-batch-label-print.dto';
import { ResetWmsReceivingPutawayDto } from './dto/reset-wms-receiving-putaway.dto';
import { VoidWmsReceivingBatchDto } from './dto/void-wms-receiving-batch.dto';

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
        status: true;
        currentLocation: {
          select: {
            kind: true;
          };
        };
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

type ReceivingBatchLabelsRecord = Prisma.WmsReceivingBatchGetPayload<{
  select: {
    id: true;
    tenantId: true;
    code: true;
    status: true;
    labelPrintCount: true;
    firstLabelPrintedAt: true;
    lastLabelPrintedAt: true;
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
    inventoryUnits: {
      orderBy: {
        createdAt: 'asc';
      };
      select: {
        id: true;
        code: true;
        barcode: true;
        receivingSequence: true;
        status: true;
        productId: true;
        variationId: true;
        labelPrintCount: true;
        firstLabelPrintedAt: true;
        lastLabelPrintedAt: true;
        unitCost: true;
        createdAt: true;
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

type LinkedInvoiceSummary = {
  id: string;
  sourceType: WmsInvoiceSourceType;
  status: WmsInvoiceStatus;
  invoiceNumber: string;
  currency: string;
  issueDate: Date | null;
  dueDate: Date | null;
  totalAmount: number;
  amountDue: number;
};

@Injectable()
export class WmsReceivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly notificationStateService: NotificationStateService,
    private readonly workflowExecutionGateway: WorkflowExecutionGateway,
    private readonly wmsFulfillmentSyncService: WmsFulfillmentSyncService,
    private readonly wmsPurchasingService: WmsPurchasingService,
  ) {}

  async getOverview(query: GetWmsReceivingOverviewDto) {
    const scope = await this.resolveTenantScope(query.tenantId, query.allTenants === true);
    const isAllTenantScope = scope.canAccessAllTenants && !scope.activeTenantId;

    if (!scope.activeTenantId && !isAllTenantScope) {
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

    const tenantWhere = scope.activeTenantId ? { tenantId: scope.activeTenantId } : {};
    const purchasingTenantWhere: Prisma.WmsPurchasingBatchWhereInput = scope.activeTenantId
      ? { tenantId: scope.activeTenantId }
      : {};
    const receivingTenantWhere: Prisma.WmsReceivingBatchWhereInput = scope.activeTenantId
      ? { tenantId: scope.activeTenantId }
      : {};
    const unitTenantWhere: Prisma.WmsInventoryUnitWhereInput = scope.activeTenantId
      ? { tenantId: scope.activeTenantId }
      : {};

    const stores = await this.prisma.posStore.findMany({
      where: tenantWhere,
      select: {
        id: true,
        name: true,
        shopName: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
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

    const purchasableStoreFilter: Prisma.WmsPurchasingBatchWhereInput = activeStoreId
      ? {
          OR: [
            { storeId: activeStoreId },
            {
              lines: {
                some: {
                  storeId: activeStoreId,
                },
              },
            },
          ],
        }
      : {};
    const receivingStoreFilter: Prisma.WmsReceivingBatchWhereInput = activeStoreId
      ? {
          OR: [
            { storeId: activeStoreId },
            {
              lines: {
                some: {
                  storeId: activeStoreId,
                },
              },
            },
          ],
        }
      : {};
    const receivableAnd: Prisma.WmsPurchasingBatchWhereInput[] = [];
    if (activeStoreId) {
      receivableAnd.push(purchasableStoreFilter);
    }
    if (search) {
      receivableAnd.push({
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
      });
    }
    const receivingAnd: Prisma.WmsReceivingBatchWhereInput[] = [];
    if (activeStoreId) {
      receivingAnd.push(receivingStoreFilter);
    }
    if (search) {
      receivingAnd.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { purchasingBatch: { sourceRequestId: { contains: search, mode: 'insensitive' } } },
          { purchasingBatch: { requestTitle: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    const receivableWhere: Prisma.WmsPurchasingBatchWhereInput = {
      ...purchasingTenantWhere,
      status: {
        in: [
          WmsPurchasingBatchStatus.RECEIVING_READY,
          WmsPurchasingBatchStatus.SHIPPED,
          WmsPurchasingBatchStatus.RECEIVING,
        ],
      },
      ...(receivableAnd.length ? { AND: receivableAnd } : {}),
    };

    const receivingWhere: Prisma.WmsReceivingBatchWhereInput = {
      ...receivingTenantWhere,
      ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
      ...(receivingAnd.length ? { AND: receivingAnd } : {}),
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
                status: true,
                currentLocation: {
                  select: {
                    kind: true,
                  },
                },
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
            ...receivingTenantWhere,
            status: {
              in: [
                WmsReceivingBatchStatus.ARRIVED,
                WmsReceivingBatchStatus.COUNTED,
                WmsReceivingBatchStatus.STAGED,
                WmsReceivingBatchStatus.PUTAWAY_PENDING,
              ],
            },
            ...(activeStoreId ? receivingStoreFilter : {}),
            ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
          },
        }),
        this.prisma.wmsInventoryUnit.count({
          where: {
            ...unitTenantWhere,
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
          tenantId: store.tenant.id,
          name: store.shopName || store.name,
          label: isAllTenantScope
            ? `${store.tenant.name} · ${store.shopName || store.name}`
            : store.shopName || store.name,
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

    const sortedBatch = {
      ...batch,
      inventoryUnits: this.sortReceivingBatchUnits(batch.inventoryUnits),
    };

    const linkedInvoice = await this.findLinkedInvoiceSummary({
      tenantId: batch.tenantId,
      sourceType: batch.purchasingBatchId
        ? WmsInvoiceSourceType.PROCUREMENT
        : WmsInvoiceSourceType.MANUAL_RECEIVING,
      sourceRefId: batch.purchasingBatchId ?? batch.id,
    });

    return {
      batch: this.mapReceivingBatchDetail(sortedBatch, linkedInvoice),
    };
  }

  async getBatchLabelsById(id: string, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const batch = await this.prisma.wmsReceivingBatch.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        code: true,
        status: true,
        labelPrintCount: true,
        firstLabelPrintedAt: true,
        lastLabelPrintedAt: true,
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
        inventoryUnits: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            code: true,
            barcode: true,
            receivingSequence: true,
            status: true,
            productId: true,
            variationId: true,
            labelPrintCount: true,
            firstLabelPrintedAt: true,
            lastLabelPrintedAt: true,
            unitCost: true,
            createdAt: true,
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

    const sortedBatch = {
      ...batch,
      inventoryUnits: this.sortReceivingBatchUnits(batch.inventoryUnits),
    };

    const linkedInvoice = await this.findLinkedInvoiceSummary({
      tenantId: batch.tenantId,
      sourceType: batch.purchasingBatch?.id
        ? WmsInvoiceSourceType.PROCUREMENT
        : WmsInvoiceSourceType.MANUAL_RECEIVING,
      sourceRefId: batch.purchasingBatch?.id ?? batch.id,
    });

    return {
      batch: this.mapReceivingBatchLabels(sortedBatch, linkedInvoice),
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
            receivingSequence: true,
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

    const sortedUnits = this.sortReceivingBatchUnits(batch.inventoryUnits);

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
        unitCount: sortedUnits.length,
      },
      sections,
      units: sortedUnits.map((unit) => {
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
          receivingSequence: unit.receivingSequence ?? null,
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
        storeId: true,
        warehouseId: true,
        inventoryUnits: {
          select: {
            id: true,
            storeId: true,
            currentLocationId: true,
            status: true,
            variationId: true,
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
        storeId: unit.storeId,
        currentLocationId: unit.currentLocationId,
        currentStatus: unit.status,
        variationId: unit.variationId,
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

      const nextBatch = await this.syncReceivingBatchPutawayStateTx(tx, {
        actorId,
        batchId: batch.id,
        now,
      });

      return {
        ...nextBatch,
      };
    });

    const reallocationGroups = Array.from(
      validatedAssignments.reduce((groups, assignment) => {
        const existing = groups.get(assignment.storeId);
        if (existing) {
          existing.add(assignment.variationId);
          return groups;
        }

        groups.set(assignment.storeId, new Set([assignment.variationId]));
        return groups;
      }, new Map<string, Set<string>>()),
    );

    for (const [storeId, variationIds] of reallocationGroups) {
      await this.wmsFulfillmentSyncService.reallocateWaitingOrdersForRestockedVariations({
        tenantId: batch.tenantId,
        storeId,
        warehouseId: batch.warehouseId,
        variationIds: Array.from(variationIds),
        actorId,
      });
    }

    return {
      updatedUnitCount: validatedAssignments.length,
      batch: result,
    };
  }

  async resetPutawayToStage(id: string, body: ResetWmsReceivingPutawayDto, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    if (!body.unitIds.length) {
      throw new BadRequestException('Select at least one unit to return to stage');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const batch = await this.prisma.wmsReceivingBatch.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        tenantId: true,
        warehouseId: true,
        stagingLocationId: true,
        stagingLocation: {
          select: {
            id: true,
            code: true,
            name: true,
            kind: true,
            warehouseId: true,
          },
        },
        inventoryUnits: {
          select: {
            id: true,
            code: true,
            storeId: true,
            variationId: true,
            currentLocationId: true,
            status: true,
            currentLocation: {
              select: {
                id: true,
                code: true,
                name: true,
                kind: true,
                warehouseId: true,
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

    if (!batch.stagingLocationId || !batch.stagingLocation) {
      throw new BadRequestException('Receiving batch is missing its staging location');
    }

    if (batch.stagingLocation.kind !== WmsLocationKind.RECEIVING_STAGING) {
      throw new BadRequestException('Receiving batch staging location is not a receiving staging area');
    }

    const stagingLocation = batch.stagingLocation;
    const stagingLocationId = batch.stagingLocationId;

    const unitMap = new Map(batch.inventoryUnits.map((unit) => [unit.id, unit]));
    const seenUnitIds = new Set<string>();
    const validatedUnits = body.unitIds.map((unitId) => {
      if (seenUnitIds.has(unitId)) {
        throw new BadRequestException('Each inventory unit can only be selected once per submit');
      }

      seenUnitIds.add(unitId);
      const unit = unitMap.get(unitId);
      if (!unit) {
        throw new BadRequestException('One or more units are outside the selected receiving batch');
      }

      if (unit.status !== WmsInventoryUnitStatus.PUTAWAY) {
        throw new BadRequestException(`Unit ${unit.code} is not eligible for return to stage`);
      }

      if (!unit.currentLocationId || !unit.currentLocation || unit.currentLocation.kind !== WmsLocationKind.BIN) {
        throw new BadRequestException(`Unit ${unit.code} is no longer stored in a bin`);
      }

      if (unit.currentLocation.warehouseId !== batch.warehouseId) {
        throw new BadRequestException(`Unit ${unit.code} is outside the receiving warehouse`);
      }

      if (unit.currentLocationId === batch.stagingLocationId) {
        throw new BadRequestException(`Unit ${unit.code} is already in staging`);
      }

      return unit;
    });

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const unitsBySourceLocation = validatedUnits.reduce((groups, unit) => {
        const current = groups.get(unit.currentLocationId!);
        if (current) {
          current.push(unit);
          return groups;
        }

        groups.set(unit.currentLocationId!, [unit]);
        return groups;
      }, new Map<string, typeof validatedUnits>());

      for (const [sourceLocationId, units] of unitsBySourceLocation) {
        const sourceLocation = units[0]?.currentLocation;
        if (!sourceLocation) {
          throw new BadRequestException('One or more selected units are missing their current bin');
        }

        const transferCode = this.buildTransferCode();
        const transfer = await tx.wmsTransfer.create({
          data: {
            code: transferCode,
            tenantId: scope.activeTenantId!,
            warehouseId: batch.warehouseId,
            fromLocationId: sourceLocationId,
            toLocationId: stagingLocationId,
            status: WmsTransferStatus.COMPLETED,
            notes: `Returned to staging for receiving batch ${batch.code}`,
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
              currentLocationId: stagingLocationId,
              status: WmsInventoryUnitStatus.STAGED,
              ...(actorId ? { updatedById: actorId } : {}),
            },
          });
        }

        await tx.wmsInventoryMovement.createMany({
          data: units.map((unit) => ({
            tenantId: scope.activeTenantId!,
            inventoryUnitId: unit.id,
            warehouseId: batch.warehouseId,
            fromLocationId: unit.currentLocationId,
            toLocationId: stagingLocationId,
            fromStatus: unit.status,
            toStatus: WmsInventoryUnitStatus.STAGED,
            movementType: WmsInventoryMovementType.TRANSFER,
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            referenceCode: transfer.code,
            notes: `Returned to staging ${stagingLocation.code} for receiving batch ${batch.code}`,
            actorId,
            createdAt: now,
          })),
        });
      }

      return this.syncReceivingBatchPutawayStateTx(tx, {
        actorId,
        batchId: batch.id,
        now,
      });
    });

    const refreshGroups = Array.from(
      validatedUnits.reduce((groups, unit) => {
        const current = groups.get(unit.storeId);
        if (current) {
          current.add(unit.variationId);
          return groups;
        }

        groups.set(unit.storeId, new Set([unit.variationId]));
        return groups;
      }, new Map<string, Set<string>>()),
    );

    for (const [storeId, variationIds] of refreshGroups) {
      await this.wmsFulfillmentSyncService.refreshDemandQueueForScope({
        tenantId: batch.tenantId,
        storeId,
        variationIds: Array.from(variationIds),
      });
    }

    return {
      updatedUnitCount: validatedUnits.length,
      batch: result,
    };
  }

  async voidBatch(id: string, body: VoidWmsReceivingBatchDto, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const actorId = (this.cls.get('userId') as string | undefined) ?? null;
    const reason = this.cleanOptionalText(body.reason);
    const notes = this.cleanOptionalText(body.notes);

    if (!reason) {
      throw new BadRequestException('Void reason is required');
    }

    const batch = await this.prisma.wmsReceivingBatch.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        tenantId: true,
        status: true,
        notes: true,
        warehouseId: true,
        purchasingBatchId: true,
        lines: {
          select: {
            id: true,
            purchasingBatchLineId: true,
            receivedQuantity: true,
          },
        },
        inventoryUnits: {
          select: {
            id: true,
            code: true,
            status: true,
            warehouseId: true,
            currentLocationId: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Receiving batch was not found');
    }

    this.assertTenantScope(batch.tenantId, scope.activeTenantId);

    if (batch.status !== WmsReceivingBatchStatus.STAGED) {
      throw new BadRequestException('Only staged receiving batches can be voided');
    }

    const nonStagedUnit = batch.inventoryUnits.find(
      (unit) => unit.status !== WmsInventoryUnitStatus.STAGED,
    );
    if (nonStagedUnit) {
      throw new BadRequestException(
        `Only fully staged batches can be voided. Unit ${nonStagedUnit.code} is ${nonStagedUnit.status}.`,
      );
    }

    const unitIds = batch.inventoryUnits.map((unit) => unit.id);
    if (unitIds.length > 0) {
      const [activeBasketUnitCount, activePickReservationCount] = await Promise.all([
        this.prisma.wmsBasketUnit.count({
          where: {
            inventoryUnitId: { in: unitIds },
            status: {
              in: [WmsBasketUnitStatus.PICKED, WmsBasketUnitStatus.PACKED],
            },
          },
        }),
        this.prisma.wmsPickReservation.count({
          where: {
            inventoryUnitId: { in: unitIds },
            status: {
              in: [WmsPickReservationStatus.RESERVED, WmsPickReservationStatus.PICKED],
            },
          },
        }),
      ]);

      if (activeBasketUnitCount > 0 || activePickReservationCount > 0) {
        throw new BadRequestException('Receiving batch has active fulfillment holds and cannot be voided');
      }
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      if (unitIds.length > 0) {
        const updatedUnits = await tx.wmsInventoryUnit.updateMany({
          where: {
            id: { in: unitIds },
            receivingBatchId: batch.id,
            status: WmsInventoryUnitStatus.STAGED,
          },
          data: {
            status: WmsInventoryUnitStatus.ARCHIVED,
            currentLocationId: null,
            ...(actorId ? { updatedById: actorId } : {}),
          },
        });

        if (updatedUnits.count !== unitIds.length) {
          throw new BadRequestException('Receiving batch changed before void completed');
        }

        await tx.wmsInventoryMovement.createMany({
          data: batch.inventoryUnits.map((unit) => ({
            tenantId: batch.tenantId,
            inventoryUnitId: unit.id,
            warehouseId: unit.warehouseId,
            fromLocationId: unit.currentLocationId,
            toLocationId: null,
            fromStatus: WmsInventoryUnitStatus.STAGED,
            toStatus: WmsInventoryUnitStatus.ARCHIVED,
            movementType: WmsInventoryMovementType.ADJUSTMENT,
            referenceType: 'VOID_RECEIVING_BATCH',
            referenceId: batch.id,
            referenceCode: batch.code,
            notes: notes ? `${reason} · ${notes}` : reason,
            actorId,
            createdAt: now,
          })),
        });
      }

      const purchasingLineDecrements = batch.lines.filter(
        (line) => line.purchasingBatchLineId && line.receivedQuantity > 0,
      );

      for (const line of purchasingLineDecrements) {
        const updatedLine = await tx.wmsPurchasingBatchLine.updateMany({
          where: {
            id: line.purchasingBatchLineId!,
            receivedQuantity: {
              gte: line.receivedQuantity,
            },
          },
          data: {
            receivedQuantity: {
              decrement: line.receivedQuantity,
            },
            ...(actorId ? { updatedById: actorId } : {}),
          },
        });

        if (updatedLine.count !== 1) {
          throw new BadRequestException('Purchasing received quantity changed before void completed');
        }
      }

      await tx.wmsReceivingLine.updateMany({
        where: { batchId: batch.id },
        data: {
          receivedQuantity: 0,
          ...(actorId ? { updatedById: actorId } : {}),
        },
      });

      if (batch.purchasingBatchId) {
        const purchasingLines = await tx.wmsPurchasingBatchLine.findMany({
          where: { batchId: batch.purchasingBatchId },
          select: {
            requestedQuantity: true,
            approvedQuantity: true,
            receivedQuantity: true,
          },
        });
        const totalExpected = purchasingLines.reduce(
          (sum, line) => sum + Math.max(0, line.approvedQuantity ?? line.requestedQuantity),
          0,
        );
        const totalReceived = purchasingLines.reduce(
          (sum, line) => sum + Math.max(0, line.receivedQuantity),
          0,
        );
        const nextPurchasingStatus =
          totalReceived <= 0
            ? WmsPurchasingBatchStatus.RECEIVING_READY
            : totalReceived >= totalExpected
              ? WmsPurchasingBatchStatus.STOCKED
              : WmsPurchasingBatchStatus.RECEIVING;

        await tx.wmsPurchasingBatch.update({
          where: { id: batch.purchasingBatchId },
          data: {
            status: nextPurchasingStatus,
            ...(actorId ? { updatedById: actorId } : {}),
          },
        });
      }

      const nextNotes = batch.notes
        ? `${batch.notes}\nVoid: ${reason}${notes ? ` · ${notes}` : ''}`
        : `Void: ${reason}${notes ? ` · ${notes}` : ''}`;

      const updatedBatch = await tx.wmsReceivingBatch.update({
        where: { id: batch.id },
        data: {
          status: WmsReceivingBatchStatus.CANCELED,
          completedAt: null,
          notes: nextNotes,
          ...(actorId ? { updatedById: actorId } : {}),
        },
        select: {
          id: true,
          code: true,
          status: true,
          updatedAt: true,
        },
      });

      return updatedBatch;
    });

    return {
      voidedUnitCount: unitIds.length,
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

    const isReceivableProcurement =
      purchasingBatch.requestType !== 'SELF_BUY'
      && (
        purchasingBatch.status === WmsPurchasingBatchStatus.RECEIVING_READY
        || purchasingBatch.status === WmsPurchasingBatchStatus.RECEIVING
      );
    const isReceivableSelfBuy =
      purchasingBatch.requestType === 'SELF_BUY'
      && (
        purchasingBatch.status === WmsPurchasingBatchStatus.SHIPPED
        || purchasingBatch.status === WmsPurchasingBatchStatus.RECEIVING
      );

    if (!isReceivableProcurement && !isReceivableSelfBuy) {
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
            ?? this.toNumber(line.partnerUnitCost)
            ?? (
              purchasingBatch.requestType === 'SELF_BUY'
                ? null
                : this.toNumber(line.resolvedProfile?.inhouseUnitCost)
            ),
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

      if (
        purchasingBatch.requestType === 'SELF_BUY'
        && (entry.unitCost === null || entry.unitCost <= 0)
      ) {
        throw new BadRequestException(
          `Line ${entry.purchasingLine.lineNo}: self-buy actual unit COGS is required before receiving`,
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
                storeId: entry.purchasingLine.storeId,
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

      const unitCodePrefix = this.buildUnitCodePrefix(partnerRequestLabel);
      const unitBarcodes = await this.reserveUnitBarcodes(
        tx,
        selectedLines.reduce((total, entry) => total + entry.receiveQuantity, 0),
      );
      let unitBarcodeIndex = 0;
      const unitRows = selectedLines.flatMap((entry) =>
        Array.from({ length: entry.receiveQuantity }, () => {
          const unitBarcode = unitBarcodes[unitBarcodeIndex];
          const unitIdentifier = this.buildUnitIdentifier(unitCodePrefix, unitBarcode);
          const receivingSequence = unitBarcodeIndex + 1;
          unitBarcodeIndex += 1;

          return {
            tenantId: scope.activeTenantId!,
            storeId: entry.purchasingLine.storeId,
            posProductId: entry.purchasingLine.resolvedPosProductId!,
            productProfileId: entry.purchasingLine.resolvedProfileId!,
            warehouseId: warehouse.id,
            receivingBatchId: receivingBatch.id,
            currentLocationId: stagingLocation.id,
            productId: entry.purchasingLine.productId ?? entry.purchasingLine.resolvedProfile!.productId,
            variationId: entry.purchasingLine.variationId ?? entry.purchasingLine.resolvedProfile!.variationId,
            posWarehouseRef: entry.purchasingLine.resolvedProfile?.posWarehouseRef ?? null,
            code: unitIdentifier,
            barcode: unitBarcode,
            receivingSequence,
            status: WmsInventoryUnitStatus.STAGED,
            sourceType: WmsInventoryUnitSourceType.RECEIVING,
            sourceRefId: receivingBatch.id,
            sourceRefLabel: receivingCode,
            unitCost: this.decimalOrNull(entry.unitCost),
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
        },
      });

      if (createdUnits.length) {
        await tx.wmsInventoryMovement.createMany({
          data: createdUnits.map((unit) => ({
            tenantId: scope.activeTenantId!,
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

      const event = await tx.wmsPurchasingEvent.create({
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

      await this.notificationStateService.syncPurchasingBatchEvent(tx, {
        tenantId: scope.activeTenantId!,
        batchId: purchasingBatch.id,
        sourceEventId: event.id,
        sourceEventType: event.eventType,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        context: {
          message: event.message,
          payload: event.payload,
        },
      });

      return {
        receivingBatchId: receivingBatch.id,
        purchasingUpdate: {
          batchId: purchasingBatch.id,
          status: nextPurchasingStatus,
        },
      };
    });

    this.workflowExecutionGateway.emitTenantEvent(
      scope.activeTenantId!,
      null,
      'stock-requests:updated',
      {
        tenantId: scope.activeTenantId!,
        batchId: created.purchasingUpdate.batchId,
        status: created.purchasingUpdate.status,
        sourceStatus: created.purchasingUpdate.status,
        eventType: 'RECEIVING_BATCH_CREATED',
        updatedAt: new Date().toISOString(),
      },
    );

    return this.getBatchById(created.receivingBatchId, scope.activeTenantId);
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
            productId: true,
            variationId: true,
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

      if (!this.isStockableVariation(profile.posProduct.productId, profile.posProduct.variationId)) {
        throw new BadRequestException(
          `${profile.posProduct.name}: ${this.getStockabilityReason(
            profile.posProduct.productId,
            profile.posProduct.variationId,
          )}`,
        );
      }

      if (!this.isStockableVariation(profile.productId, profile.variationId)) {
        throw new BadRequestException(
          `${profile.posProduct.name}: still uses a legacy variation mapping. Sync this product first.`,
        );
      }

      return {
        lineNo: index + 1,
        profile,
        receiveQuantity: Math.max(0, Math.floor(line.receiveQuantity)),
        unitCost:
          line.unitCost
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

      const unitCodePrefix = this.buildUnitCodePrefix(partnerRequestLabel);
      const unitBarcodes = await this.reserveUnitBarcodes(
        tx,
        selectedLines.reduce((total, entry) => total + entry.receiveQuantity, 0),
      );
      let unitBarcodeIndex = 0;
      const unitRows = selectedLines.flatMap((entry) =>
        Array.from({ length: entry.receiveQuantity }, () => {
          const unitBarcode = unitBarcodes[unitBarcodeIndex];
          const unitIdentifier = this.buildUnitIdentifier(unitCodePrefix, unitBarcode);
          const receivingSequence = unitBarcodeIndex + 1;
          unitBarcodeIndex += 1;

          return {
            tenantId,
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
            barcode: unitBarcode,
            receivingSequence,
            status: WmsInventoryUnitStatus.STAGED,
            sourceType: WmsInventoryUnitSourceType.MANUAL_INPUT,
            sourceRefId: receivingBatch.id,
            sourceRefLabel: receivingCode,
            unitCost: this.decimalOrNull(entry.unitCost),
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
        },
      });

      if (createdUnits.length) {
        await tx.wmsInventoryMovement.createMany({
          data: createdUnits.map((unit) => ({
            tenantId,
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

    await this.wmsPurchasingService.ensureManualReceivingInvoice(created, tenantId);

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
    const status = this.deriveReceivingBatchStatusFromUnits(batch.inventoryUnits, batch.status);

    return {
      id: batch.id,
      tenantId: batch.tenantId,
      code: batch.code,
      status,
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

  private mapReceivingBatchLabels(
    batch: ReceivingBatchLabelsRecord,
    linkedInvoice: LinkedInvoiceSummary | null,
  ) {
    const status = this.deriveReceivingBatchStatusFromUnits(batch.inventoryUnits, batch.status);

    return {
      id: batch.id,
      tenantId: batch.tenantId,
      code: batch.code,
      status,
      labelPrintCount: batch.labelPrintCount,
      firstLabelPrintedAt: batch.firstLabelPrintedAt,
      lastLabelPrintedAt: batch.lastLabelPrintedAt,
      sourceRequestId: batch.purchasingBatch?.sourceRequestId ?? null,
      requestTitle: batch.purchasingBatch?.requestTitle ?? null,
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
      linkedInvoice,
      units: batch.inventoryUnits.map((unit) => ({
        id: unit.id,
        code: unit.code,
        barcode: unit.barcode,
        receivingSequence: unit.receivingSequence ?? null,
        status: unit.status,
        labelPrintCount: unit.labelPrintCount,
        firstLabelPrintedAt: unit.firstLabelPrintedAt,
        lastLabelPrintedAt: unit.lastLabelPrintedAt,
        productId: unit.productId,
        variationId: unit.variationId,
        unitCost: this.toNumber(unit.unitCost),
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
    };
  }

  private mapReceivingBatchDetail(
    batch: ReceivingBatchDetailRecord,
    linkedInvoice: LinkedInvoiceSummary | null,
  ) {
    const status = this.deriveReceivingBatchStatusFromUnits(batch.inventoryUnits, batch.status);

    return {
      id: batch.id,
      code: batch.code,
      status,
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
      linkedInvoice,
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
        receivingSequence: unit.receivingSequence ?? null,
        status: unit.status,
        labelPrintCount: unit.labelPrintCount,
        firstLabelPrintedAt: unit.firstLabelPrintedAt,
        lastLabelPrintedAt: unit.lastLabelPrintedAt,
        productId: unit.productId,
        variationId: unit.variationId,
        unitCost: this.toNumber(unit.unitCost),
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

  private async findLinkedInvoiceSummary(input: {
    tenantId: string;
    sourceType: WmsInvoiceSourceType;
    sourceRefId: string;
  }) {
    const invoice = await this.prisma.wmsInvoice.findFirst({
      where: {
        tenantId: input.tenantId,
        sourceType: input.sourceType,
        sourceRefId: input.sourceRefId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceType: true,
        status: true,
        invoiceNumber: true,
        currency: true,
        issueDate: true,
        dueDate: true,
        totalsSnapshot: true,
      },
    });

    if (!invoice) {
      return null;
    }

    const totals = this.readInvoiceTotals(invoice.totalsSnapshot);
    return {
      id: invoice.id,
      sourceType: invoice.sourceType,
      status: invoice.status,
      invoiceNumber: invoice.invoiceNumber,
      currency: invoice.currency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      totalAmount: totals.totalAmount ?? 0,
      amountDue: totals.amountDue ?? totals.totalAmount ?? 0,
    } satisfies LinkedInvoiceSummary;
  }

  private buildReceivingCode() {
    return `RCV-${Date.now().toString(36).toUpperCase()}`;
  }

  private sortReceivingBatchUnits<
    TUnit extends {
      receivingSequence?: number | null;
      barcode?: string | null;
      code?: string | null;
      createdAt?: Date | string | null;
    },
  >(units: TUnit[]) {
    return [...units].sort((left, right) => {
      const leftSequence = typeof left.receivingSequence === 'number' ? left.receivingSequence : null;
      const rightSequence = typeof right.receivingSequence === 'number' ? right.receivingSequence : null;

      if (leftSequence !== null || rightSequence !== null) {
        if (leftSequence === null) {
          return 1;
        }
        if (rightSequence === null) {
          return -1;
        }
        if (leftSequence !== rightSequence) {
          return leftSequence - rightSequence;
        }
      }

      const leftBarcode = this.parseNumericBarcode(left.barcode ?? null);
      const rightBarcode = this.parseNumericBarcode(right.barcode ?? null);
      if (leftBarcode !== null && rightBarcode !== null && leftBarcode !== rightBarcode) {
        return leftBarcode - rightBarcode;
      }

      const leftCreatedAt = this.parseTimestamp(left.createdAt ?? null);
      const rightCreatedAt = this.parseTimestamp(right.createdAt ?? null);
      if (leftCreatedAt !== rightCreatedAt) {
        return leftCreatedAt - rightCreatedAt;
      }

      return (left.code ?? '').localeCompare(right.code ?? '');
    });
  }

  private parseNumericBarcode(barcode: string | null) {
    if (!barcode || !/^\d+$/.test(barcode)) {
      return null;
    }

    const parsed = Number.parseInt(barcode, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseTimestamp(value: Date | string | null) {
    if (value instanceof Date) {
      return value.getTime();
    }

    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private buildUnitCodePrefix(partnerName: string) {
    const partnerInitials = this.buildPartnerInitials(partnerName);
    return partnerInitials;
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
    const compact = normalized.replace(/[^A-Z0-9]/g, '');
    const initials = words.length > 1
      ? words.map((word) => word[0]).join('').slice(0, 3)
      : compact.slice(0, 3);

    return (initials || compact || 'PRT').padEnd(3, 'X').slice(0, 3);
  }

  private buildUnitIdentifier(prefix: string, unitBarcode: string) {
    return `${prefix}${unitBarcode}`;
  }

  private async reserveUnitBarcodes(tx: Prisma.TransactionClient, count: number) {
    if (count <= 0) {
      return [];
    }

    const rows = await tx.$queryRaw<Array<{ value: string }>>(Prisma.sql`
      SELECT nextval('wms_inventory_unit_barcode_seq')::text AS value
      FROM generate_series(1, ${count})
    `);

    if (rows.length !== count) {
      throw new Error('Unable to reserve WMS unit barcode values');
    }

    return rows.map((row) => this.formatCompactUnitBarcode(row.value));
  }

  private formatCompactUnitBarcode(value: string) {
    const normalized = value.replace(/\D/g, '');

    if (!normalized) {
      throw new Error('Unable to format empty WMS unit barcode value');
    }

    return normalized.length % 2 === 0 ? normalized : `0${normalized}`;
  }

  private isLegacyVariationMapping(productId: string, variationId: string | null | undefined) {
    return Boolean(variationId) && variationId === productId;
  }

  private isStockableVariation(productId: string, variationId: string | null | undefined) {
    return Boolean(variationId) && !this.isLegacyVariationMapping(productId, variationId);
  }

  private getStockabilityReason(productId: string, variationId: string | null | undefined) {
    if (!variationId) {
      return 'missing variation ID. Sync this product first.';
    }

    if (this.isLegacyVariationMapping(productId, variationId)) {
      return 'still uses a legacy variation mapping. Sync this product first.';
    }

    return 'is not stockable.';
  }

  private async syncReceivingBatchPutawayStateTx(
    tx: Prisma.TransactionClient,
    params: {
      actorId: string | null;
      batchId: string;
      now: Date;
    },
  ) {
    const [totalUnits, putAwayUnits, completedUnits, stagedUnits] = await Promise.all([
      tx.wmsInventoryUnit.count({
        where: {
          receivingBatchId: params.batchId,
        },
      }),
      tx.wmsInventoryUnit.count({
        where: {
          receivingBatchId: params.batchId,
          status: WmsInventoryUnitStatus.PUTAWAY,
          currentLocation: {
            is: {
              kind: WmsLocationKind.BIN,
            },
          },
        },
      }),
      tx.wmsInventoryUnit.count({
        where: {
          receivingBatchId: params.batchId,
          OR: [
            {
              status: {
                in: [...RECEIVING_BATCH_COMPLETED_BIN_UNIT_STATUSES],
              },
              currentLocation: {
                is: {
                  kind: WmsLocationKind.BIN,
                },
              },
            },
            {
              status: {
                in: [...RECEIVING_BATCH_COMPLETED_NON_BIN_UNIT_STATUSES],
              },
            },
          ],
        },
      }),
      tx.wmsInventoryUnit.count({
        where: {
          receivingBatchId: params.batchId,
          status: WmsInventoryUnitStatus.STAGED,
          currentLocation: {
            is: {
              kind: WmsLocationKind.RECEIVING_STAGING,
            },
          },
        },
      }),
    ]);

    const nextStatus = deriveReceivingBatchStatus({
      totalUnits,
      stagedUnits,
      completedUnits,
    });

    const nextBatch = await tx.wmsReceivingBatch.update({
      where: { id: params.batchId },
      data: {
        status: nextStatus,
        completedAt: nextStatus === WmsReceivingBatchStatus.COMPLETED ? params.now : null,
        ...(params.actorId ? { updatedById: params.actorId } : {}),
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
  }

  private buildTransferCode() {
    return `TRF-${Date.now().toString(36).toUpperCase()}`;
  }

  private cleanOptionalText(value?: string | null) {
    const normalized = value?.trim() ?? null;
    return normalized ? normalized : null;
  }

  private deriveReceivingBatchStatusFromUnits(
    units: Array<{
      status: WmsInventoryUnitStatus;
      currentLocation?: { kind: WmsLocationKind } | null;
    }>,
    fallbackStatus: WmsReceivingBatchStatus,
  ) {
    if (units.length === 0) {
      return fallbackStatus;
    }

    const completedUnits = units.filter((unit) => this.isReceivingBatchCompletedUnit(unit)).length;
    const stagedUnits = units.filter(
      (unit) => unit.status === WmsInventoryUnitStatus.STAGED
        && unit.currentLocation?.kind === WmsLocationKind.RECEIVING_STAGING,
    ).length;

    return deriveReceivingBatchStatus({
      totalUnits: units.length,
      stagedUnits,
      completedUnits,
    });
  }

  private isReceivingBatchCompletedUnit(unit: {
    status: WmsInventoryUnitStatus;
    currentLocation?: { kind: WmsLocationKind } | null;
  }) {
    if (
      (RECEIVING_BATCH_COMPLETED_NON_BIN_UNIT_STATUSES as readonly WmsInventoryUnitStatus[]).includes(
        unit.status,
      )
    ) {
      return true;
    }

    return (
      (RECEIVING_BATCH_COMPLETED_BIN_UNIT_STATUSES as readonly WmsInventoryUnitStatus[]).includes(
        unit.status,
      )
      && unit.currentLocation?.kind === WmsLocationKind.BIN
    );
  }

  private readInvoiceTotals(value: Prisma.JsonValue | null | undefined) {
    const snapshot = this.asJsonRecord(value);
    return {
      totalAmount: this.jsonNumber(snapshot?.totalAmount),
      amountDue: this.jsonNumber(snapshot?.amountDue),
    };
  }

  private asJsonRecord(value: Prisma.JsonValue | null | undefined) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private jsonNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

  private async resolveTenantScope(requestedTenantId?: string, forceAllTenants = false) {
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
          : forceAllTenants
            ? null
            : clsTenantId && tenants.some((tenant) => tenant.id === clsTenantId)
              ? clsTenantId
              : null;

      return {
        activeTenantId,
        canAccessAllTenants: true,
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
        canAccessAllTenants: false,
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
      canAccessAllTenants: false,
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
