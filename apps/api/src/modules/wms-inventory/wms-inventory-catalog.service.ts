import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { generateWmsSkuProfileBarcode } from "../../common/utils/wms-barcode.util";
import { ListWmsPosProductFiltersDto } from "./dto/list-wms-pos-product-filters.dto";
import { ListWmsPosProductsDto } from "./dto/list-wms-pos-products.dto";
import { UpsertWmsSkuProfileDto } from "./dto/upsert-wms-sku-profile.dto";

@Injectable()
export class WmsInventoryCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeText(value?: string | null) {
    const next = value?.trim();
    return next ? next : null;
  }

  private handleUniqueError(error: unknown, fallbackMessage: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(fallbackMessage);
    }
    throw error;
  }

  private toNumber(value: Prisma.Decimal | null | undefined) {
    return value == null ? null : Number(value);
  }

  private toDecimal(value: number | string | Prisma.Decimal) {
    if (value instanceof Prisma.Decimal) {
      return value;
    }

    return new Prisma.Decimal(value);
  }

  private toObject(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private toStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item) => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.toString().trim());
  }

  private resolveProductImage(snapshot: Prisma.JsonValue | null | undefined) {
    const root = this.toObject(snapshot);
    if (!root) {
      return null;
    }

    const images = this.toStringArray(root.images);
    if (images[0]) {
      return images[0];
    }

    const product = this.toObject(root.product as Prisma.JsonValue | null);
    const productImage = product?.image;
    if (typeof productImage === "string" && productImage.trim().length > 0) {
      return productImage.trim();
    }

    const image = root.image;
    if (typeof image === "string" && image.trim().length > 0) {
      return image.trim();
    }

    return null;
  }

  private mapSkuProfile(
    profile:
      | {
          id: string;
          code: string | null;
          category: string | null;
          unit: string | null;
          packSize: string | null;
          barcode: string | null;
          description: string | null;
          status: string;
          isSerialized: boolean;
          isLotTracked: boolean;
          isExpiryTracked: boolean;
          supplierCost: Prisma.Decimal | null;
          wmsUnitPrice: Prisma.Decimal | null;
          isRequestable: boolean;
          createdAt: Date;
          updatedAt: Date;
        }
      | null
      | undefined,
  ) {
    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      code: profile.code,
      category: profile.category,
      unit: profile.unit,
      packSize: profile.packSize,
      barcode: profile.barcode,
      description: profile.description,
      status: profile.status,
      isSerialized: profile.isSerialized,
      isLotTracked: profile.isLotTracked,
      isExpiryTracked: profile.isExpiryTracked,
      supplierCost: this.toNumber(profile.supplierCost),
      wmsUnitPrice: this.toNumber(profile.wmsUnitPrice),
      isRequestable: profile.isRequestable,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private async resolveGeneratedSkuProfileBarcode(
    posProductId: string,
    excludeProfileId?: string,
  ) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const candidate = generateWmsSkuProfileBarcode(
        attempt === 0 ? posProductId : `${posProductId}:${attempt}`,
      );
      const existing = await this.prisma.wmsSkuProfile.findFirst({
        where: {
          barcode: candidate,
          ...(excludeProfileId ? { NOT: { id: excludeProfileId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException("Unable to generate a unique barcode");
  }

  async listPosProducts(query: ListWmsPosProductsDto) {
    const search = this.normalizeText(query.search);

    const requestedLimit = query.limit ?? 1000;
    const take = Math.min(Math.max(requestedLimit, 1), 2000);

    const posProducts = await this.prisma.posProduct.findMany({
      where: {
        variationId: {
          not: null,
        },
        ...(query.profiledOnly ? { wmsSkuProfile: { isNot: null } } : {}),
        ...(query.storeId ? { storeId: query.storeId } : {}),
        ...(query.tenantId ? { store: { tenantId: query.tenantId } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { variationId: { contains: search, mode: "insensitive" } },
                { variationCustomId: { contains: search, mode: "insensitive" } },
                { customId: { contains: search, mode: "insensitive" } },
                { mapping: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      take,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        store: {
          select: {
            id: true,
            name: true,
            shopId: true,
            shopName: true,
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        wmsSkuProfile: {
          select: {
            id: true,
            code: true,
            category: true,
            unit: true,
            packSize: true,
            barcode: true,
            description: true,
            status: true,
            isSerialized: true,
            isLotTracked: true,
            isExpiryTracked: true,
            supplierCost: true,
            wmsUnitPrice: true,
            isRequestable: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return posProducts.map((product) => ({
      id: product.id,
      variationId: product.variationId,
      variationCustomId: product.variationCustomId,
      name: product.name,
      customId: product.customId,
      mapping: product.mapping,
      retailPrice: this.toNumber(product.retailPrice),
      updatedAt: product.updatedAt,
      imageUrl: this.resolveProductImage(product.productSnapshot),
      store: {
        id: product.store.id,
        name: product.store.name,
        shopId: product.store.shopId,
        shopName: product.store.shopName,
        tenant: product.store.tenant,
      },
      skuProfile: this.mapSkuProfile(product.wmsSkuProfile),
    }));
  }

  async listPosProductFilters(query: ListWmsPosProductFiltersDto) {
    const shops = await this.prisma.posStore.findMany({
      where: {
        ...(query.tenantId ? { tenantId: query.tenantId } : {}),
        products: {
          some: {
            variationId: {
              not: null,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        shopId: true,
        shopName: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ name: "asc" }],
    });

    const tenantMap = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
      }
    >();

    for (const shop of shops) {
      tenantMap.set(shop.tenant.id, {
        id: shop.tenant.id,
        name: shop.tenant.name,
        slug: shop.tenant.slug,
      });
    }

    return {
      tenants: Array.from(tenantMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      shops: shops.map((shop) => ({
        id: shop.id,
        name: shop.name,
        shopId: shop.shopId,
        shopName: shop.shopName,
        tenantId: shop.tenant.id,
        tenantName: shop.tenant.name,
      })),
    };
  }

  async upsertSkuProfile(posProductId: string, dto: UpsertWmsSkuProfileDto) {
    const existingProduct = await this.prisma.posProduct.findUnique({
      where: { id: posProductId },
      select: {
        id: true,
        wmsSkuProfile: {
          select: {
            id: true,
            barcode: true,
          },
        },
      },
    });

    if (!existingProduct) {
      throw new NotFoundException("POS product not found");
    }

    const requestedBarcode = this.normalizeText(dto.barcode);
    const barcode =
      requestedBarcode ||
      existingProduct.wmsSkuProfile?.barcode ||
      (await this.resolveGeneratedSkuProfileBarcode(
        posProductId,
        existingProduct.wmsSkuProfile?.id,
      ));

    try {
      const profile = await this.prisma.wmsSkuProfile.upsert({
        where: { posProductId },
        update: {
          code: this.normalizeText(dto.code),
          category: this.normalizeText(dto.category),
          unit: this.normalizeText(dto.unit),
          packSize: this.normalizeText(dto.packSize),
          barcode,
          description: this.normalizeText(dto.description),
          status: dto.status || "ACTIVE",
          isSerialized: dto.isSerialized ?? true,
          isLotTracked: dto.isLotTracked ?? false,
          isExpiryTracked: dto.isExpiryTracked ?? false,
          supplierCost:
            dto.supplierCost != null ? this.toDecimal(dto.supplierCost) : null,
          wmsUnitPrice:
            dto.wmsUnitPrice != null ? this.toDecimal(dto.wmsUnitPrice) : null,
          isRequestable: dto.isRequestable ?? false,
        },
        create: {
          posProductId,
          code: this.normalizeText(dto.code),
          category: this.normalizeText(dto.category),
          unit: this.normalizeText(dto.unit),
          packSize: this.normalizeText(dto.packSize),
          barcode,
          description: this.normalizeText(dto.description),
          status: dto.status || "ACTIVE",
          isSerialized: dto.isSerialized ?? true,
          isLotTracked: dto.isLotTracked ?? false,
          isExpiryTracked: dto.isExpiryTracked ?? false,
          supplierCost:
            dto.supplierCost != null ? this.toDecimal(dto.supplierCost) : null,
          wmsUnitPrice:
            dto.wmsUnitPrice != null ? this.toDecimal(dto.wmsUnitPrice) : null,
          isRequestable: dto.isRequestable ?? false,
        },
      });

      return this.mapSkuProfile(profile);
    } catch (error) {
      this.handleUniqueError(
        error,
        "SKU profile code or barcode already exists",
      );
    }
  }

  async removeSkuProfile(posProductId: string) {
    const existing = await this.prisma.wmsSkuProfile.findUnique({
      where: { posProductId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("SKU profile not found");
    }

    await this.prisma.wmsSkuProfile.delete({
      where: { posProductId },
    });

    return { success: true };
  }
}
