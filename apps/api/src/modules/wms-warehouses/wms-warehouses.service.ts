import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { generateWmsLocationBarcode } from '../../common/utils/wms-barcode.util';
import { CreateWmsLocationDto } from './dto/create-wms-location.dto';
import { CreateWmsWarehouseDto } from './dto/create-wms-warehouse.dto';
import { UpdateWmsLocationDto } from './dto/update-wms-location.dto';
import { UpdateWmsWarehouseDto } from './dto/update-wms-warehouse.dto';

@Injectable()
export class WmsWarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCode(value: string) {
    return value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');
  }

  private normalizeText(value?: string | null) {
    const next = value?.trim();
    return next ? next : null;
  }

  private async getWarehouseOrThrow(id: string) {
    const warehouse = await this.prisma.wmsWarehouse.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  private async getLocationOrThrow(warehouseId: string, locationId: string) {
    const location = await this.prisma.wmsLocation.findFirst({
      where: {
        id: locationId,
        warehouseId,
      },
      select: {
        id: true,
        warehouseId: true,
        parentId: true,
        barcode: true,
      },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  private async assertWarehouseCodeAvailable(code: string, id?: string) {
    const existing = await this.prisma.wmsWarehouse.findFirst({
      where: {
        code,
        ...(id ? { NOT: { id } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Warehouse code already exists');
    }
  }

  private async assertLocationCodeAvailable(warehouseId: string, code: string, id?: string) {
    const existing = await this.prisma.wmsLocation.findFirst({
      where: {
        warehouseId,
        code,
        ...(id ? { NOT: { id } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Location code already exists in this warehouse');
    }
  }

  private async assertBarcodeAvailable(barcode?: string | null, id?: string) {
    if (!barcode) {
      return;
    }

    const existing = await this.prisma.wmsLocation.findFirst({
      where: {
        barcode,
        ...(id ? { NOT: { id } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Barcode already exists');
    }
  }

  private async assertParentLocationValid(
    warehouseId: string,
    parentId?: string | null,
    locationId?: string,
  ) {
    if (!parentId) {
      return;
    }

    if (locationId && parentId === locationId) {
      throw new ConflictException('Location cannot be its own parent');
    }

    let current = await this.prisma.wmsLocation.findFirst({
      where: {
        id: parentId,
        warehouseId,
      },
      select: {
        id: true,
        parentId: true,
      },
    });

    if (!current) {
      throw new NotFoundException('Parent location not found in this warehouse');
    }

    while (current?.parentId) {
      if (current.parentId === locationId) {
        throw new ConflictException('Location hierarchy cannot loop');
      }

      current = await this.prisma.wmsLocation.findUnique({
        where: { id: current.parentId },
        select: { id: true, parentId: true },
      });
    }
  }

  private async resolveGeneratedLocationBarcode(locationId: string, excludeLocationId?: string) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const candidate = generateWmsLocationBarcode(
        attempt === 0 ? locationId : `${locationId}:${attempt}`,
      );
      const existing = await this.prisma.wmsLocation.findFirst({
        where: {
          barcode: candidate,
          ...(excludeLocationId ? { NOT: { id: excludeLocationId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to generate a unique barcode');
  }

  private mapWarehouse(warehouse: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: string;
    isDefault: boolean;
    contactName: string | null;
    contactPhone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    country: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    locations: Array<{
      id: string;
      warehouseId: string;
      parentId: string | null;
      code: string;
      name: string;
      description: string | null;
      type: string;
      status: string;
      isDefault: boolean;
      barcode: string | null;
      capacityUnits: number | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
      parent: { id: string; name: string; code: string } | null;
      _count: { children: number };
    }>;
  }) {
    return {
      ...warehouse,
      locationsCount: warehouse.locations.length,
      activeLocationsCount: warehouse.locations.filter((location) => location.status === 'ACTIVE').length,
      locations: warehouse.locations.map((location) => ({
        ...location,
        parentName: location.parent?.name || null,
        parentCode: location.parent?.code || null,
        childrenCount: location._count.children,
        parent: undefined,
        _count: undefined,
      })),
    };
  }

  async listWarehouses() {
    const warehouses = await this.prisma.wmsWarehouse.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        locations: {
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
          include: {
            parent: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            _count: {
              select: {
                children: true,
              },
            },
          },
        },
      },
    });

    return warehouses.map((warehouse) => this.mapWarehouse(warehouse));
  }

  async createWarehouse(dto: CreateWmsWarehouseDto) {
    const code = this.normalizeCode(dto.code);
    await this.assertWarehouseCodeAvailable(code);

    const createdId = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.wmsWarehouse.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const created = await tx.wmsWarehouse.create({
        data: {
          code,
          name: dto.name.trim(),
          description: this.normalizeText(dto.description),
          status: dto.status || 'ACTIVE',
          isDefault: Boolean(dto.isDefault),
          contactName: this.normalizeText(dto.contactName),
          contactPhone: this.normalizeText(dto.contactPhone),
          addressLine1: this.normalizeText(dto.addressLine1),
          addressLine2: this.normalizeText(dto.addressLine2),
          city: this.normalizeText(dto.city),
          province: this.normalizeText(dto.province),
          postalCode: this.normalizeText(dto.postalCode),
          country: this.normalizeText(dto.country) || 'Philippines',
          notes: this.normalizeText(dto.notes),
        },
        select: { id: true },
      });

      return created.id;
    });

    const warehouses = await this.listWarehouses();
    const warehouse = warehouses.find((item) => item.id === createdId);
    if (!warehouse) {
      throw new NotFoundException('Created warehouse could not be loaded');
    }
    return warehouse;
  }

  async updateWarehouse(id: string, dto: UpdateWmsWarehouseDto) {
    await this.getWarehouseOrThrow(id);

    const nextCode = dto.code ? this.normalizeCode(dto.code) : undefined;
    if (nextCode) {
      await this.assertWarehouseCodeAvailable(nextCode, id);
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.wmsWarehouse.updateMany({
          where: {
            isDefault: true,
            NOT: { id },
          },
          data: { isDefault: false },
        });
      }

      const data: Prisma.WmsWarehouseUpdateInput = {
        ...(nextCode !== undefined ? { code: nextCode } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: this.normalizeText(dto.description) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.contactName !== undefined ? { contactName: this.normalizeText(dto.contactName) } : {}),
        ...(dto.contactPhone !== undefined ? { contactPhone: this.normalizeText(dto.contactPhone) } : {}),
        ...(dto.addressLine1 !== undefined ? { addressLine1: this.normalizeText(dto.addressLine1) } : {}),
        ...(dto.addressLine2 !== undefined ? { addressLine2: this.normalizeText(dto.addressLine2) } : {}),
        ...(dto.city !== undefined ? { city: this.normalizeText(dto.city) } : {}),
        ...(dto.province !== undefined ? { province: this.normalizeText(dto.province) } : {}),
        ...(dto.postalCode !== undefined ? { postalCode: this.normalizeText(dto.postalCode) } : {}),
        ...(dto.country !== undefined ? { country: this.normalizeText(dto.country) || 'Philippines' } : {}),
        ...(dto.notes !== undefined ? { notes: this.normalizeText(dto.notes) } : {}),
      };

      await tx.wmsWarehouse.update({
        where: { id },
        data,
      });
    });

    const warehouses = await this.listWarehouses();
    const warehouse = warehouses.find((item) => item.id === id);
    if (!warehouse) {
      throw new NotFoundException('Updated warehouse could not be loaded');
    }
    return warehouse;
  }

  async removeWarehouse(id: string) {
    await this.getWarehouseOrThrow(id);

    const locationCount = await this.prisma.wmsLocation.count({
      where: { warehouseId: id },
    });

    if (locationCount > 0) {
      throw new ConflictException('Remove warehouse locations first');
    }

    await this.prisma.wmsWarehouse.delete({
      where: { id },
    });

    return { success: true };
  }

  async createLocation(warehouseId: string, dto: CreateWmsLocationDto) {
    await this.getWarehouseOrThrow(warehouseId);

    const locationId = randomUUID();
    const code = this.normalizeCode(dto.code);
    const requestedBarcode = this.normalizeText(dto.barcode);
    const barcode =
      requestedBarcode || (await this.resolveGeneratedLocationBarcode(locationId));
    await this.assertLocationCodeAvailable(warehouseId, code);
    await this.assertBarcodeAvailable(barcode);
    await this.assertParentLocationValid(warehouseId, dto.parentId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.wmsLocation.updateMany({
          where: {
            warehouseId,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      const created = await tx.wmsLocation.create({
        data: {
          id: locationId,
          warehouseId,
          code,
          name: dto.name.trim(),
          description: this.normalizeText(dto.description),
          type: dto.type || 'STORAGE',
          status: dto.status || 'ACTIVE',
          isDefault: Boolean(dto.isDefault),
          parentId: dto.parentId || null,
          barcode,
          capacityUnits: dto.capacityUnits ?? null,
          sortOrder: dto.sortOrder ?? 0,
        },
        select: { id: true },
      });

      return created.id;
    });

    const warehouses = await this.listWarehouses();
    const warehouse = warehouses.find((item) => item.id === warehouseId);
    const location = warehouse?.locations.find((item) => item.id === locationId);
    if (!location) {
      throw new NotFoundException('Created location could not be loaded');
    }
    return location;
  }

  async updateLocation(warehouseId: string, locationId: string, dto: UpdateWmsLocationDto) {
    await this.getWarehouseOrThrow(warehouseId);
    const existingLocation = await this.getLocationOrThrow(warehouseId, locationId);

    const nextCode = dto.code ? this.normalizeCode(dto.code) : undefined;
    const requestedBarcode =
      dto.barcode !== undefined ? this.normalizeText(dto.barcode) : existingLocation.barcode;
    const nextBarcode =
      requestedBarcode || (await this.resolveGeneratedLocationBarcode(locationId, locationId));

    if (nextCode) {
      await this.assertLocationCodeAvailable(warehouseId, nextCode, locationId);
    }

    if (nextBarcode) {
      await this.assertBarcodeAvailable(nextBarcode, locationId);
    }

    if (dto.parentId !== undefined) {
      await this.assertParentLocationValid(warehouseId, dto.parentId, locationId);
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.wmsLocation.updateMany({
          where: {
            warehouseId,
            isDefault: true,
            NOT: { id: locationId },
          },
          data: { isDefault: false },
        });
      }

      const data: Prisma.WmsLocationUpdateInput = {
        ...(nextCode !== undefined ? { code: nextCode } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: this.normalizeText(dto.description) } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
        barcode: nextBarcode,
        ...(dto.capacityUnits !== undefined ? { capacityUnits: dto.capacityUnits } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      };

      await tx.wmsLocation.update({
        where: { id: locationId },
        data,
      });
    });

    const warehouses = await this.listWarehouses();
    const warehouse = warehouses.find((item) => item.id === warehouseId);
    const location = warehouse?.locations.find((item) => item.id === locationId);
    if (!location) {
      throw new NotFoundException('Updated location could not be loaded');
    }
    return location;
  }

  async removeLocation(warehouseId: string, locationId: string) {
    await this.getWarehouseOrThrow(warehouseId);
    await this.getLocationOrThrow(warehouseId, locationId);

    const childCount = await this.prisma.wmsLocation.count({
      where: {
        parentId: locationId,
      },
    });

    if (childCount > 0) {
      throw new ConflictException('Remove child locations first');
    }

    await this.prisma.wmsLocation.delete({
      where: { id: locationId },
    });

    return { success: true };
  }
}
