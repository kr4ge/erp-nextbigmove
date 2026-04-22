import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WmsLocationKind,
  WmsProductProfileStatus,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IntegrationService } from '../integrations/integration.service';
import { GetWmsProductsOverviewDto } from './dto/get-wms-products-overview.dto';
import { UpdateWmsProductProfileDto } from './dto/update-wms-product-profile.dto';

const PRODUCT_SECTION_LOCATION_KINDS = [WmsLocationKind.SECTION] as const;

type ProductProfileRecord = Prisma.WmsProductProfileGetPayload<{
  include: {
    posProduct: {
      select: {
        id: true;
        productId: true;
        variationId: true;
        warehouseId: true;
        customId: true;
        productSnapshot: true;
        name: true;
        retailPrice: true;
        createdAt: true;
        updatedAt: true;
        store: {
          select: {
            id: true;
            name: true;
            shopName: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class WmsProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly integrationService: IntegrationService,
  ) {}

  async getOverview(query: GetWmsProductsOverviewDto) {
    const scope = await this.resolveTenantScope(query.tenantId);

    if (!scope.activeTenantId) {
      return {
        tenantReady: false,
        summary: {
          products: 0,
          defaultProfiles: 0,
          readyProfiles: 0,
          serializedProfiles: 0,
          warehouseScopedProducts: 0,
          assignedProfiles: 0,
          unassignedProfiles: 0,
        },
        filters: {
          tenants: scope.tenants,
          stores: [],
          posWarehouses: [],
          activeTenantId: null,
          activeStoreId: null,
          activePosWarehouseId: null,
        },
        locationOptions: [],
        products: [],
      };
    }

    await this.ensureDefaultProfiles(scope.activeTenantId, query.storeId);

    const stores = await this.prisma.posStore.findMany({
      where: { tenantId: scope.activeTenantId },
      select: {
        id: true,
        name: true,
        shopName: true,
        _count: {
          select: {
            wmsProductProfiles: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const activeStoreId =
      query.storeId && stores.some((store) => store.id === query.storeId)
        ? query.storeId
        : null;

    const posWarehouses = activeStoreId
      ? await this.prisma.posWarehouse.findMany({
          where: { storeId: activeStoreId },
          select: {
            id: true,
            warehouseId: true,
            name: true,
          },
          orderBy: [{ name: 'asc' }],
        })
      : [];

    const activePosWarehouse =
      query.posWarehouseId && posWarehouses.some((warehouse) => warehouse.id === query.posWarehouseId)
        ? posWarehouses.find((warehouse) => warehouse.id === query.posWarehouseId) ?? null
        : null;

    const where: Prisma.WmsProductProfileWhereInput = {
      tenantId: scope.activeTenantId,
      ...(activeStoreId ? { storeId: activeStoreId } : {}),
      ...(activePosWarehouse ? { posWarehouseRef: activePosWarehouse.warehouseId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { variationId: { contains: query.search, mode: 'insensitive' } },
              { productId: { contains: query.search, mode: 'insensitive' } },
              { posProduct: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [
      profiles,
      totalProducts,
      defaultProfiles,
      readyProfiles,
      serializedProfiles,
      warehouseScopedProducts,
      assignedProfiles,
      unassignedProfiles,
      warehouseCounts,
      locationOptions,
    ] =
      await Promise.all([
        this.prisma.wmsProductProfile.findMany({
          where,
          include: {
            posProduct: {
              select: {
                id: true,
                productId: true,
                variationId: true,
                warehouseId: true,
                customId: true,
                productSnapshot: true,
                name: true,
                retailPrice: true,
                createdAt: true,
                updatedAt: true,
                store: {
                  select: {
                    id: true,
                    name: true,
                    shopName: true,
                  },
                },
              },
            },
          },
          orderBy: [{ updatedAt: 'desc' }],
        }),
        this.prisma.wmsProductProfile.count({ where }),
        this.prisma.wmsProductProfile.count({
          where: {
            ...where,
            status: WmsProductProfileStatus.DEFAULT,
          },
        }),
        this.prisma.wmsProductProfile.count({
          where: {
            ...where,
            status: WmsProductProfileStatus.READY,
          },
        }),
        this.prisma.wmsProductProfile.count({
          where: {
            ...where,
            isSerialized: true,
          },
        }),
        this.prisma.wmsProductProfile.count({
          where: {
            ...where,
            posWarehouseRef: { not: null },
          },
        }),
        this.prisma.wmsProductProfile.count({
          where: {
            ...where,
            preferredLocationId: { not: null },
          },
        }),
        this.prisma.wmsProductProfile.count({
          where: {
            ...where,
            preferredLocationId: null,
          },
        }),
        activeStoreId
          ? this.prisma.wmsProductProfile.groupBy({
              by: ['posWarehouseRef'],
              where: {
                tenantId: scope.activeTenantId,
                storeId: activeStoreId,
              },
              _count: {
                _all: true,
              },
            })
          : Promise.resolve([] as Array<{ posWarehouseRef: string | null; _count: { _all: number } }>),
        this.prisma.wmsLocation.findMany({
          where: {
            isActive: true,
            kind: {
              in: [...PRODUCT_SECTION_LOCATION_KINDS],
            },
          },
          select: {
            id: true,
            code: true,
            name: true,
            kind: true,
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
          orderBy: [{ warehouse: { code: 'asc' } }, { code: 'asc' }],
        }),
      ]);

    const locationIds = Array.from(
      new Set(
        profiles.flatMap((profile) =>
          [profile.preferredLocationId, profile.pickLocationId].filter(Boolean) as string[],
        ),
      ),
    );

    const locations = locationIds.length
      ? await this.prisma.wmsLocation.findMany({
          where: {
            id: {
              in: locationIds,
            },
          },
          select: {
            id: true,
            code: true,
            name: true,
            kind: true,
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        })
      : [];

    const locationMap = new Map(
      locations.map((location) => [
        location.id,
        {
          id: location.id,
          code: location.code,
          name: location.name,
          kind: location.kind,
          warehouse: location.warehouse,
          label: `${location.warehouse.code} · ${location.code}`,
        },
      ]),
    );

    const warehouseMap = new Map(
      posWarehouses.map((warehouse) => [warehouse.warehouseId, warehouse]),
    );
    const warehouseCountMap = new Map(
      warehouseCounts
        .filter((record) => record.posWarehouseRef)
        .map((record) => [record.posWarehouseRef as string, record._count._all]),
    );

    const products = profiles
      .slice()
      .sort((left, right) => left.posProduct.name.localeCompare(right.posProduct.name))
      .map((profile) => this.mapProfile(profile, warehouseMap, locationMap));

    return {
      tenantReady: true,
      summary: {
        products: totalProducts,
        defaultProfiles,
        readyProfiles,
        serializedProfiles,
        warehouseScopedProducts,
        assignedProfiles,
        unassignedProfiles,
      },
      filters: {
        tenants: scope.tenants,
        stores: stores.map((store) => ({
          id: store.id,
          label: store.shopName || store.name,
          productCount: store._count.wmsProductProfiles,
        })),
        posWarehouses: posWarehouses.map((warehouse) => ({
          id: warehouse.id,
          warehouseId: warehouse.warehouseId,
          label: warehouse.name,
          productCount: warehouseCountMap.get(warehouse.warehouseId) ?? 0,
        })),
        activeTenantId: scope.activeTenantId,
        activeStoreId,
        activePosWarehouseId: activePosWarehouse?.id ?? null,
      },
      locationOptions: locationOptions.map((location) => ({
        id: location.id,
        code: location.code,
        name: location.name,
        kind: location.kind,
        label: `${location.warehouse.code} · ${location.code} · ${location.name}`,
        warehouse: location.warehouse,
      })),
      products,
    };
  }

  async syncStoreProducts(storeId: string, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new BadRequestException('Tenant scope is required');
    }

    const store = await this.prisma.posStore.findFirst({
      where: {
        id: storeId,
        tenantId: scope.activeTenantId,
      },
      select: {
        id: true,
        name: true,
        shopName: true,
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found in the selected tenant');
    }

    const result = await this.integrationService.syncPancakeProductsByStoreId(
      store.id,
      scope.activeTenantId,
    );

    return {
      store: {
        id: store.id,
        name: store.shopName || store.name,
      },
      syncedCount: result.syncedCount,
      profileCount: await this.prisma.wmsProductProfile.count({
        where: {
          tenantId: scope.activeTenantId,
          storeId: store.id,
        },
      }),
    };
  }

  async updateProfile(id: string, body: UpdateWmsProductProfileDto, requestedTenantId?: string) {
    const scope = await this.resolveTenantScope(requestedTenantId);
    if (!scope.activeTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const existing = await this.prisma.wmsProductProfile.findFirst({
      where: {
        id,
        tenantId: scope.activeTenantId,
      },
      include: {
        posProduct: {
          select: {
            id: true,
            productId: true,
            variationId: true,
            warehouseId: true,
            customId: true,
            productSnapshot: true,
            name: true,
            retailPrice: true,
            createdAt: true,
            updatedAt: true,
            store: {
              select: {
                id: true,
                name: true,
                shopName: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Product profile not found');
    }

    const preferredLocationId =
      body.preferredLocationId === undefined ? existing.preferredLocationId : body.preferredLocationId;

    await this.validateLocationReference(preferredLocationId ?? null, PRODUCT_SECTION_LOCATION_KINDS);

    const updated = await this.prisma.wmsProductProfile.update({
      where: { id: existing.id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.isSerialized !== undefined ? { isSerialized: body.isSerialized } : {}),
        ...(body.preferredLocationId !== undefined ? { preferredLocationId: body.preferredLocationId } : {}),
        ...(body.isFragile !== undefined ? { isFragile: body.isFragile } : {}),
        ...(body.isStackable !== undefined ? { isStackable: body.isStackable } : {}),
        ...(body.keepDry !== undefined ? { keepDry: body.keepDry } : {}),
        ...(body.inhouseUnitCost !== undefined ? { inhouseUnitCost: this.numberOrNull(body.inhouseUnitCost) } : {}),
        ...(body.supplierUnitCost !== undefined ? { supplierUnitCost: this.numberOrNull(body.supplierUnitCost) } : {}),
        ...(body.notes !== undefined ? { notes: this.cleanOptionalText(body.notes) } : {}),
      },
      include: {
        posProduct: {
          select: {
            id: true,
            productId: true,
            variationId: true,
            warehouseId: true,
            customId: true,
            productSnapshot: true,
            name: true,
            retailPrice: true,
            createdAt: true,
            updatedAt: true,
            store: {
              select: {
                id: true,
                name: true,
                shopName: true,
              },
            },
          },
        },
      },
    });

    const locationIds = [updated.preferredLocationId, updated.pickLocationId].filter(Boolean) as string[];
    const locations = locationIds.length
      ? await this.prisma.wmsLocation.findMany({
          where: { id: { in: locationIds } },
          select: {
            id: true,
            code: true,
            name: true,
            kind: true,
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        })
      : [];

    const locationMap = new Map(
      locations.map((location) => [
        location.id,
        {
          id: location.id,
          code: location.code,
          name: location.name,
          kind: location.kind,
          warehouse: location.warehouse,
          label: `${location.warehouse.code} · ${location.code}`,
        },
      ]),
    );

    const posWarehouse = updated.posWarehouseRef
      ? await this.prisma.posWarehouse.findFirst({
          where: {
            storeId: updated.storeId,
            warehouseId: updated.posWarehouseRef,
          },
          select: {
            id: true,
            warehouseId: true,
            name: true,
          },
        })
      : null;

    return {
      profile: this.mapProfile(
        updated,
        new Map(posWarehouse ? [[posWarehouse.warehouseId, posWarehouse]] : []),
        locationMap,
      ),
    };
  }

  private cleanOptionalText(value: string | null | undefined) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private numberOrNull(value: number | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }
    return value;
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

  private async ensureDefaultProfiles(tenantId: string, storeId?: string) {
    const products = await this.prisma.posProduct.findMany({
      where: {
        variationId: {
          not: null,
        },
        store: {
          tenantId,
        },
        ...(storeId ? { storeId } : {}),
      },
      select: {
        id: true,
        storeId: true,
        productId: true,
        variationId: true,
        warehouseId: true,
      },
    });

    if (!products.length) {
      return;
    }

    const existingProfiles = await this.prisma.wmsProductProfile.findMany({
      where: {
        posProductId: {
          in: products.map((product) => product.id),
        },
      },
      select: {
        posProductId: true,
      },
    });

    const existingProductIds = new Set(existingProfiles.map((profile) => profile.posProductId));
    const missingProfiles = products.filter((product) => !existingProductIds.has(product.id));

    if (!missingProfiles.length) {
      return;
    }

    await this.prisma.wmsProductProfile.createMany({
      data: missingProfiles.map((product) => ({
        tenantId,
        storeId: product.storeId,
        posProductId: product.id,
        productId: product.productId,
        variationId: product.variationId!,
        posWarehouseRef: product.warehouseId,
        status: WmsProductProfileStatus.DEFAULT,
        isSerialized: true,
      })),
      skipDuplicates: true,
    });
  }

  private async validateLocationReference(
    locationId: string | null,
    allowedKinds: readonly WmsLocationKind[],
  ) {
    if (!locationId) {
      return;
    }

    const location = await this.prisma.wmsLocation.findUnique({
      where: { id: locationId },
      select: {
        id: true,
        kind: true,
        isActive: true,
      },
    });

    if (!location) {
      throw new BadRequestException('Selected WMS location was not found');
    }

    if (!location.isActive) {
      throw new BadRequestException('Selected WMS location is inactive');
    }

    if (!allowedKinds.includes(location.kind)) {
      throw new BadRequestException('Selected WMS location is not valid for this profile field');
    }
  }

  private mapProfile(
    profile: ProductProfileRecord,
    warehouseMap: Map<string, { id: string; warehouseId: string; name: string }>,
    locationMap: Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        kind: WmsLocationKind;
        warehouse: {
          id: string;
          code: string;
          name: string;
        };
        label: string;
      }
    >,
  ) {
    const posWarehouse = profile.posWarehouseRef ? warehouseMap.get(profile.posWarehouseRef) ?? null : null;
    const snapshot = profile.posProduct.productSnapshot as
      | {
          display_id?: string | null;
          product?: {
            display_id?: string | null;
          } | null;
        }
      | null;
    const snapshotCustomId =
      typeof snapshot?.display_id === 'string'
        ? snapshot.display_id
        : typeof snapshot?.product?.display_id === 'string'
          ? snapshot.product.display_id
          : null;

    return {
      id: profile.id,
      posProductId: profile.posProductId,
      status: profile.status,
      isSerialized: profile.isSerialized,
      productId: profile.productId,
      variationId: profile.variationId,
      variationDisplayId: snapshotCustomId,
      productCustomId: profile.posProduct.customId,
      name: profile.posProduct.name,
      customId: snapshotCustomId,
      retailPrice: profile.posProduct.retailPrice,
      inhouseUnitCost: profile.inhouseUnitCost,
      supplierUnitCost: profile.supplierUnitCost,
      posWarehouse: posWarehouse
        ? {
            id: posWarehouse.id,
            warehouseId: posWarehouse.warehouseId,
            name: posWarehouse.name,
          }
        : null,
      store: {
        id: profile.posProduct.store.id,
        name: profile.posProduct.store.shopName || profile.posProduct.store.name,
      },
      preferredLocation: profile.preferredLocationId
        ? locationMap.get(profile.preferredLocationId) ?? null
        : null,
      pickLocation: profile.pickLocationId ? locationMap.get(profile.pickLocationId) ?? null : null,
      handling: {
        isFragile: profile.isFragile,
        isStackable: profile.isStackable,
        keepDry: profile.keepDry,
      },
      notes: profile.notes,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
