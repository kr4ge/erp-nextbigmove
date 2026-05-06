import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WmsLocationKind,
  WmsInventoryUnitStatus,
  WmsWarehouseStatus,
  type WmsLocation,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetWmsWarehousesOverviewDto } from './dto/get-wms-warehouses-overview.dto';
import { CreateWmsWarehouseDto } from './dto/create-wms-warehouse.dto';
import { UpdateWmsWarehouseDto } from './dto/update-wms-warehouse.dto';
import { CreateWmsLocationDto } from './dto/create-wms-location.dto';
import { UpdateWmsLocationDto } from './dto/update-wms-location.dto';

const STRUCTURAL_KINDS = [WmsLocationKind.SECTION, WmsLocationKind.RACK, WmsLocationKind.BIN] as const;
const OPERATIONAL_KINDS = [
  WmsLocationKind.RECEIVING_STAGING,
  WmsLocationKind.PACKING,
  WmsLocationKind.DISPATCH_STAGING,
  WmsLocationKind.RTS,
  WmsLocationKind.DAMAGE,
  WmsLocationKind.QUARANTINE,
] as const;

const DEFAULT_OPERATIONAL_LOCATIONS: Array<{
  code: string;
  name: string;
  kind: WmsLocationKind;
  sortOrder: number;
}> = [
  { code: 'RECV-STG', name: 'Receiving Staging', kind: WmsLocationKind.RECEIVING_STAGING, sortOrder: 10 },
  { code: 'PACK', name: 'Packing', kind: WmsLocationKind.PACKING, sortOrder: 20 },
  { code: 'DSP-STG', name: 'Dispatch Staging', kind: WmsLocationKind.DISPATCH_STAGING, sortOrder: 30 },
  { code: 'RTS', name: 'RTS', kind: WmsLocationKind.RTS, sortOrder: 40 },
  { code: 'DMG', name: 'Damage', kind: WmsLocationKind.DAMAGE, sortOrder: 50 },
  { code: 'QTN', name: 'Quarantine', kind: WmsLocationKind.QUARANTINE, sortOrder: 60 },
];
const DEFAULT_SECTION_RACK_CAPACITY = 2;
const MAX_SECTION_RACK_CAPACITY = 2;
const DEFAULT_RACK_BIN_CAPACITY = 6;

function isStructuralKind(kind: WmsLocationKind) {
  return STRUCTURAL_KINDS.includes(kind as (typeof STRUCTURAL_KINDS)[number]);
}

function isOperationalKind(kind: WmsLocationKind) {
  return OPERATIONAL_KINDS.includes(kind as (typeof OPERATIONAL_KINDS)[number]);
}

type WarehouseOverviewRecord = Prisma.WmsWarehouseGetPayload<{
  include: {
    locations: {
      select: {
        id: true;
        parentId: true;
        kind: true;
        code: true;
        name: true;
        barcode: true;
        description: true;
        isActive: true;
        sortOrder: true;
        capacity: true;
        createdAt: true;
        updatedAt: true;
      };
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ];
    };
  };
}>;

type LocationTreeNode = {
  id: string;
  parentId: string | null;
  kind: WmsLocationKind;
  code: string;
  name: string;
  barcode: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  capacity: number | null;
  createdAt: Date;
  updatedAt: Date;
  children: LocationTreeNode[];
};

type WarehouseInventorySummary = {
  serializedUnits: number;
  putAwayUnits: number;
  stagedUnits: number;
  attentionUnits: number;
};

@Injectable()
export class WmsWarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(query: GetWmsWarehousesOverviewDto) {
    const warehouses = await this.prisma.wmsWarehouse.findMany({
      include: {
        locations: {
          select: {
            id: true,
            parentId: true,
            kind: true,
            code: true,
            name: true,
            barcode: true,
            description: true,
            isActive: true,
            sortOrder: true,
            capacity: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const activeWarehouseId =
      query.warehouseId && warehouses.some((warehouse) => warehouse.id === query.warehouseId)
        ? query.warehouseId
        : warehouses[0]?.id ?? null;

    const activeWarehouse = activeWarehouseId
      ? warehouses.find((warehouse) => warehouse.id === activeWarehouseId) ?? null
      : null;
    const activeWarehouseInventorySummary = activeWarehouse
      ? await this.buildWarehouseInventorySummary(activeWarehouse.id)
      : null;

    const structuralLocations = warehouses.flatMap((warehouse) =>
      warehouse.locations.filter((location) => isStructuralKind(location.kind)),
    );
    const operationalLocations = warehouses.flatMap((warehouse) =>
      warehouse.locations.filter((location) => isOperationalKind(location.kind)),
    );

    return {
      summary: {
        warehouses: warehouses.length,
        activeWarehouses: warehouses.filter((warehouse) => warehouse.status === WmsWarehouseStatus.ACTIVE).length,
        locations: warehouses.reduce((total, warehouse) => total + warehouse.locations.length, 0),
        structuralLocations: structuralLocations.length,
        operationalLocations: operationalLocations.length,
      },
      warehouses: warehouses.map((warehouse) => this.mapWarehouseListItem(warehouse)),
      activeWarehouseId,
      activeWarehouse: activeWarehouse
        ? this.mapWarehouseDetail(activeWarehouse, activeWarehouseInventorySummary)
        : null,
    };
  }

  async getBinDetail(id: string) {
    const bin = await this.prisma.wmsLocation.findFirst({
      where: {
        id,
        kind: WmsLocationKind.BIN,
      },
      select: {
        id: true,
        code: true,
        name: true,
        barcode: true,
        capacity: true,
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        parent: {
          select: {
            id: true,
            code: true,
            name: true,
            kind: true,
            parent: {
              select: {
                id: true,
                code: true,
                name: true,
                kind: true,
              },
            },
          },
        },
      },
    });

    if (!bin) {
      throw new NotFoundException('Slot not found');
    }

    const rack = bin.parent;
    const section = rack?.parent;

    if (!rack || rack.kind !== WmsLocationKind.RACK || !section || section.kind !== WmsLocationKind.SECTION) {
      throw new BadRequestException('Slot hierarchy is incomplete');
    }

    const [occupiedUnits, units] = await Promise.all([
      this.prisma.wmsInventoryUnit.count({
        where: {
          currentLocationId: bin.id,
        },
      }),
      this.prisma.wmsInventoryUnit.findMany({
        where: {
          currentLocationId: bin.id,
        },
        orderBy: [{ updatedAt: 'desc' }, { code: 'asc' }],
        select: {
          id: true,
          code: true,
          barcode: true,
          status: true,
          sourceRefLabel: true,
          updatedAt: true,
          posProduct: {
            select: {
              name: true,
              customId: true,
            },
          },
          receivingBatch: {
            select: {
              id: true,
              code: true,
            },
          },
        },
      }),
    ]);

    const availableUnits =
      bin.capacity === null ? null : Math.max(bin.capacity - occupiedUnits, 0);

    return {
      bin: {
        id: bin.id,
        code: bin.code,
        name: bin.name,
        barcode: bin.barcode,
        capacity: bin.capacity,
        occupiedUnits,
        availableUnits,
        isFull: bin.capacity !== null ? occupiedUnits >= bin.capacity : false,
        warehouse: bin.warehouse,
        section: {
          id: section.id,
          code: section.code,
          name: section.name,
        },
        rack: {
          id: rack.id,
          code: rack.code,
          name: rack.name,
        },
      },
      units: units.map((unit) => ({
        id: unit.id,
        code: unit.code,
        barcode: unit.barcode,
        status: unit.status,
        productName: unit.posProduct.name,
        productCustomId: unit.posProduct.customId,
        sourceRefLabel: unit.sourceRefLabel,
        receivingBatch: unit.receivingBatch
          ? {
              id: unit.receivingBatch.id,
              code: unit.receivingBatch.code,
            }
          : null,
        updatedAt: unit.updatedAt,
      })),
    };
  }

  async createWarehouse(body: CreateWmsWarehouseDto) {
    const normalizedCode = this.normalizeCode(body.code);
    const shouldSeedOperationalLocations = body.autoSeedOperationalLocations ?? true;
    await this.ensureWarehouseCodeAvailable(normalizedCode);

    let warehouseId = '';

    await this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.wmsWarehouse.create({
        data: {
          code: normalizedCode,
          name: body.name.trim(),
          description: this.cleanOptionalText(body.description),
          address: this.cleanOptionalText(body.address),
          billingCompanyName: this.cleanOptionalText(body.billingCompanyName),
          billingAddress: this.cleanOptionalText(body.billingAddress),
          bankName: this.cleanOptionalText(body.bankName),
          bankAccountName: this.cleanOptionalText(body.bankAccountName),
          bankAccountNumber: this.cleanOptionalText(body.bankAccountNumber),
          bankAccountType: this.cleanOptionalText(body.bankAccountType),
          bankBranch: this.cleanOptionalText(body.bankBranch),
          paymentInstructions: this.cleanOptionalText(body.paymentInstructions),
          status: body.status ?? WmsWarehouseStatus.ACTIVE,
        },
      });

      warehouseId = warehouse.id;

      if (shouldSeedOperationalLocations) {
        await tx.wmsLocation.createMany({
          data: DEFAULT_OPERATIONAL_LOCATIONS.map((location) => ({
            warehouseId: warehouse.id,
            kind: location.kind,
            code: location.code,
            name: location.name,
            barcode: this.buildLocationBarcode(normalizedCode, location.code),
            isActive: true,
            sortOrder: location.sortOrder,
          })),
        });
      }
    });

    return this.getOverview({ warehouseId });
  }

  async updateWarehouse(id: string, body: UpdateWmsWarehouseDto) {
    const existing = await this.requireWarehouseRecord(id);
    const nextCode = body.code ? this.normalizeCode(body.code) : existing.code;

    if (nextCode !== existing.code) {
      await this.ensureWarehouseCodeAvailable(nextCode, existing.id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.wmsWarehouse.update({
        where: { id: existing.id },
        data: {
          code: nextCode,
          name: body.name?.trim() ?? existing.name,
          description:
            body.description !== undefined ? this.cleanOptionalText(body.description) : existing.description,
          address: body.address !== undefined ? this.cleanOptionalText(body.address) : existing.address,
          billingCompanyName:
            body.billingCompanyName !== undefined
              ? this.cleanOptionalText(body.billingCompanyName)
              : existing.billingCompanyName,
          billingAddress:
            body.billingAddress !== undefined
              ? this.cleanOptionalText(body.billingAddress)
              : existing.billingAddress,
          bankName:
            body.bankName !== undefined
              ? this.cleanOptionalText(body.bankName)
              : existing.bankName,
          bankAccountName:
            body.bankAccountName !== undefined
              ? this.cleanOptionalText(body.bankAccountName)
              : existing.bankAccountName,
          bankAccountNumber:
            body.bankAccountNumber !== undefined
              ? this.cleanOptionalText(body.bankAccountNumber)
              : existing.bankAccountNumber,
          bankAccountType:
            body.bankAccountType !== undefined
              ? this.cleanOptionalText(body.bankAccountType)
              : existing.bankAccountType,
          bankBranch:
            body.bankBranch !== undefined
              ? this.cleanOptionalText(body.bankBranch)
              : existing.bankBranch,
          paymentInstructions:
            body.paymentInstructions !== undefined
              ? this.cleanOptionalText(body.paymentInstructions)
              : existing.paymentInstructions,
          status: body.status ?? existing.status,
        },
      });

      if (nextCode !== existing.code) {
        const locationUpdates = existing.locations.map((location) =>
          tx.wmsLocation.update({
            where: { id: location.id },
            data: {
              barcode: this.buildLocationBarcode(nextCode, location.code),
            },
          }),
        );

        await Promise.all(locationUpdates);
      }
    });

    return this.getOverview({ warehouseId: existing.id });
  }

  async createLocation(warehouseId: string, body: CreateWmsLocationDto) {
    const warehouse = await this.requireWarehouseRecord(warehouseId);

    let parent: Pick<WmsLocation, 'id' | 'kind' | 'warehouseId'> | null = null;
    if (body.parentId) {
      parent = await this.requireLocationRecord(body.parentId);
      if (parent.warehouseId !== warehouse.id) {
        throw new BadRequestException('Parent location must belong to the same warehouse');
      }
    }

    this.validateLocationPlacement(body.kind, parent?.kind ?? null);
    await this.ensureParentChildCapacity({
      kind: body.kind,
      parentId: parent?.id ?? null,
      excludeLocationId: null,
    });

    const normalizedCode = await this.resolveCreateLocationCode({
      warehouseId: warehouse.id,
      kind: body.kind,
      parent,
      inputCode: body.code,
    });
    const resolvedCapacity = this.resolveLocationCapacity({
      kind: body.kind,
      inputCapacity: body.capacity,
      existingCapacity: null,
    });
    const finalName = this.resolveCreateLocationName({
      kind: body.kind,
      inputName: body.name,
      resolvedCode: normalizedCode,
    });

    await this.ensureLocationCodeAvailable(warehouse.id, normalizedCode);

    try {
      await this.prisma.wmsLocation.create({
        data: {
          warehouseId: warehouse.id,
          parentId: body.parentId ?? null,
          kind: body.kind,
          code: normalizedCode,
          name: finalName,
          barcode: this.buildLocationBarcode(warehouse.code, normalizedCode),
          description: this.cleanOptionalText(body.description),
          isActive: body.isActive ?? true,
          sortOrder: body.sortOrder ?? 0,
          capacity: resolvedCapacity,
        },
      });
    } catch (error) {
      this.handlePrismaConstraintError(error, 'Unable to create the location');
    }

    return this.getOverview({ warehouseId: warehouse.id });
  }

  async updateLocation(id: string, body: UpdateWmsLocationDto) {
    const existing = await this.requireLocationWithWarehouse(id);
    const nextKind = body.kind ?? existing.kind;
    const nextCode = body.code ? this.normalizeCode(body.code) : existing.code;
    const nextParentId = body.parentId === undefined ? existing.parentId : body.parentId ?? null;

    if (nextKind !== existing.kind) {
      throw new BadRequestException('Location kind cannot be changed after creation');
    }

    if (isStructuralKind(existing.kind) && body.parentId !== undefined && nextParentId !== existing.parentId) {
      throw new BadRequestException('Structural locations cannot be moved to another parent');
    }

    if (nextParentId === existing.id) {
      throw new BadRequestException('A location cannot be its own parent');
    }

    let parent: Pick<WmsLocation, 'id' | 'kind' | 'warehouseId'> | null = null;
    if (nextParentId) {
      parent = await this.requireLocationRecord(nextParentId);
      if (parent.warehouseId !== existing.warehouseId) {
        throw new BadRequestException('Parent location must belong to the same warehouse');
      }
    }

    this.validateLocationPlacement(nextKind, parent?.kind ?? null);

    if (isStructuralKind(existing.kind) && nextCode !== existing.code) {
      throw new BadRequestException('Structural location codes are system-generated and cannot be changed');
    }

    if (nextCode !== existing.code) {
      await this.ensureLocationCodeAvailable(existing.warehouseId, nextCode, existing.id);
    }

    await this.ensureParentChildCapacity({
      kind: nextKind,
      parentId: parent?.id ?? null,
      excludeLocationId: existing.id,
    });

    const resolvedCapacity = this.resolveLocationCapacity({
      kind: nextKind,
      inputCapacity: body.capacity,
      existingCapacity: existing.capacity,
    });

    await this.ensureLocationCapacityCanFitChildren({
      locationId: existing.id,
      kind: nextKind,
      capacity: resolvedCapacity,
    });

    try {
      await this.prisma.wmsLocation.update({
        where: { id: existing.id },
        data: {
          parentId: nextParentId,
          kind: nextKind,
          code: nextCode,
          name: body.name?.trim() ?? existing.name,
          barcode: this.buildLocationBarcode(existing.warehouse.code, nextCode),
          description:
            body.description !== undefined ? this.cleanOptionalText(body.description) : existing.description,
          isActive: body.isActive ?? existing.isActive,
          sortOrder: body.sortOrder ?? existing.sortOrder,
          capacity: resolvedCapacity,
        },
      });
    } catch (error) {
      this.handlePrismaConstraintError(error, 'Unable to update the location');
    }

    return this.getOverview({ warehouseId: existing.warehouseId });
  }

  private cleanOptionalText(value: string | null | undefined) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private normalizeCode(value: string) {
    return value.trim().toUpperCase().replace(/\s+/g, '-');
  }

  private normalizeName(value: string) {
    return value.trim();
  }

  private buildLocationBarcode(warehouseCode: string, locationCode: string) {
    return `WMS-${this.normalizeCode(warehouseCode)}-${this.normalizeCode(locationCode)}`;
  }

  private async resolveCreateLocationCode(params: {
    warehouseId: string;
    kind: WmsLocationKind;
    parent: Pick<WmsLocation, 'id' | 'kind' | 'warehouseId'> | null;
    inputCode?: string;
  }) {
    const { warehouseId, kind, parent, inputCode } = params;
    const normalizedInputCode = inputCode?.trim() ? this.normalizeCode(inputCode) : '';

    if (kind === WmsLocationKind.SECTION) {
      return this.generateNextSectionCode(warehouseId);
    }

    if (kind === WmsLocationKind.RACK) {
      if (!parent) {
        throw new BadRequestException('Rack creation requires a section parent');
      }
      return this.generateNextRackCode(warehouseId, parent.id);
    }

    if (kind === WmsLocationKind.BIN) {
      if (!parent) {
        throw new BadRequestException('Slot creation requires a rack parent');
      }
      return this.generateNextBinCode(warehouseId, parent.id);
    }

    if (normalizedInputCode) {
      return normalizedInputCode;
    }

    throw new BadRequestException('Location code is required for operational locations');
  }

  private resolveCreateLocationName(params: {
    kind: WmsLocationKind;
    inputName?: string;
    resolvedCode: string;
  }) {
    const { kind, inputName, resolvedCode } = params;
    const normalizedInputName = inputName?.trim() ? this.normalizeName(inputName) : '';
    if (normalizedInputName) {
      return normalizedInputName;
    }

    if (isStructuralKind(kind)) {
      if (kind === WmsLocationKind.BIN) {
        return this.formatBinName(resolvedCode);
      }
      return resolvedCode;
    }

    throw new BadRequestException('Location name is required for operational locations');
  }

  private resolveLocationCapacity(params: {
    kind: WmsLocationKind;
    inputCapacity?: number;
    existingCapacity: number | null;
  }) {
    const { kind, inputCapacity, existingCapacity } = params;
    const hasInput = inputCapacity !== undefined;

    if (kind === WmsLocationKind.SECTION) {
      const resolved = hasInput ? inputCapacity! : (existingCapacity ?? DEFAULT_SECTION_RACK_CAPACITY);
      if (resolved < 1) {
        throw new BadRequestException('Section capacity must be at least 1 rack');
      }
      if (resolved > MAX_SECTION_RACK_CAPACITY) {
        throw new BadRequestException(`Section capacity cannot exceed ${MAX_SECTION_RACK_CAPACITY} racks`);
      }
      return resolved;
    }

    if (kind === WmsLocationKind.RACK) {
      const resolved = hasInput ? inputCapacity! : (existingCapacity ?? DEFAULT_RACK_BIN_CAPACITY);
      if (resolved < 1) {
        throw new BadRequestException('Rack capacity must be at least 1 slot');
      }
      return resolved;
    }

    if (kind === WmsLocationKind.BIN) {
      const resolved = hasInput ? inputCapacity! : existingCapacity;
      if (resolved === null || resolved === undefined || resolved < 1) {
        throw new BadRequestException('Slot capacity is required and must be at least 1 serialized unit');
      }
      return resolved;
    }

    return hasInput ? inputCapacity! : existingCapacity;
  }

  private async ensureParentChildCapacity(params: {
    kind: WmsLocationKind;
    parentId: string | null;
    excludeLocationId: string | null;
  }) {
    const { kind, parentId, excludeLocationId } = params;

    if (kind === WmsLocationKind.RACK && parentId) {
      const section = await this.prisma.wmsLocation.findFirst({
        where: {
          id: parentId,
          kind: WmsLocationKind.SECTION,
        },
        select: {
          capacity: true,
        },
      });

      if (!section) {
        throw new BadRequestException('Section parent not found');
      }

      const maxRacks = Math.min(section.capacity ?? DEFAULT_SECTION_RACK_CAPACITY, MAX_SECTION_RACK_CAPACITY);
      const currentRacks = await this.prisma.wmsLocation.count({
        where: {
          parentId,
          kind: WmsLocationKind.RACK,
          ...(excludeLocationId ? { NOT: { id: excludeLocationId } } : {}),
        },
      });

      if (currentRacks >= maxRacks) {
        throw new ConflictException('Section capacity reached; no rack slots available');
      }
    }

    if (kind === WmsLocationKind.BIN && parentId) {
      const rack = await this.prisma.wmsLocation.findFirst({
        where: {
          id: parentId,
          kind: WmsLocationKind.RACK,
        },
        select: {
          capacity: true,
        },
      });

      if (!rack) {
        throw new BadRequestException('Rack parent not found');
      }

      const maxBins = rack.capacity ?? DEFAULT_RACK_BIN_CAPACITY;
      const currentBins = await this.prisma.wmsLocation.count({
        where: {
          parentId,
          kind: WmsLocationKind.BIN,
          ...(excludeLocationId ? { NOT: { id: excludeLocationId } } : {}),
        },
      });

      if (currentBins >= maxBins) {
        throw new ConflictException('Rack capacity reached; no storage slots available');
      }
    }
  }

  private async ensureLocationCapacityCanFitChildren(params: {
    locationId: string;
    kind: WmsLocationKind;
    capacity: number | null;
  }) {
    const { locationId, kind, capacity } = params;

    if (kind === WmsLocationKind.SECTION && capacity !== null) {
      const rackCount = await this.prisma.wmsLocation.count({
        where: {
          parentId: locationId,
          kind: WmsLocationKind.RACK,
        },
      });

      if (rackCount > capacity) {
        throw new BadRequestException('Section capacity cannot be lower than existing rack count');
      }
    }

    if (kind === WmsLocationKind.RACK && capacity !== null) {
      const binCount = await this.prisma.wmsLocation.count({
        where: {
          parentId: locationId,
          kind: WmsLocationKind.BIN,
        },
      });

      if (binCount > capacity) {
        throw new BadRequestException('Rack capacity cannot be lower than existing slot count');
      }
    }

    if (kind === WmsLocationKind.BIN && capacity !== null) {
      const occupiedUnits = await this.prisma.wmsInventoryUnit.count({
        where: {
          currentLocationId: locationId,
        },
      });

      if (occupiedUnits > capacity) {
        throw new BadRequestException('Slot capacity cannot be lower than current occupied unit count');
      }
    }
  }

  private async generateNextSectionCode(warehouseId: string) {
    const sections = await this.prisma.wmsLocation.findMany({
      where: {
        warehouseId,
        kind: WmsLocationKind.SECTION,
      },
      select: {
        code: true,
      },
    });

    const highestSectionNumber = sections.reduce((highest, section) => {
      const value = this.parseSectionCodeToNumber(section.code);
      if (!value) {
        return highest;
      }
      return Math.max(highest, value);
    }, 0);

    return this.formatSectionCode(highestSectionNumber + 1);
  }

  private async generateNextRackCode(warehouseId: string, sectionId: string) {
    const section = await this.prisma.wmsLocation.findFirst({
      where: {
        id: sectionId,
        warehouseId,
        kind: WmsLocationKind.SECTION,
      },
      select: {
        code: true,
      },
    });

    if (!section) {
      throw new BadRequestException('Section parent not found');
    }

    const racks = await this.prisma.wmsLocation.findMany({
      where: {
        warehouseId,
        parentId: sectionId,
        kind: WmsLocationKind.RACK,
      },
      select: {
        code: true,
      },
    });

    const nextRackNumber = racks.reduce((highest, rack) => {
      const value = this.parseRackCodeToNumber(section.code, rack.code);
      if (!value) {
        return highest;
      }
      return Math.max(highest, value);
    }, 0) + 1;

    return `${section.code}${nextRackNumber}`;
  }

  private async generateNextBinCode(warehouseId: string, rackId: string) {
    const rack = await this.prisma.wmsLocation.findFirst({
      where: {
        id: rackId,
        warehouseId,
        kind: WmsLocationKind.RACK,
      },
      select: {
        code: true,
      },
    });

    if (!rack) {
      throw new BadRequestException('Rack parent not found');
    }

    const bins = await this.prisma.wmsLocation.findMany({
      where: {
        warehouseId,
        parentId: rackId,
        kind: WmsLocationKind.BIN,
      },
      select: {
        code: true,
      },
    });

    const nextBinNumber = bins.reduce((highest, bin) => {
      const value = this.parseBinCodeToNumber(rack.code, bin.code);
      if (!value) {
        return highest;
      }
      return Math.max(highest, value);
    }, 0) + 1;

    const paddedNumber = String(nextBinNumber).padStart(2, '0');
    return `${rack.code}-S${paddedNumber}`;
  }

  private parseSectionCodeToNumber(code: string) {
    if (!/^[A-Z]+$/.test(code)) {
      return null;
    }

    return code
      .split('')
      .reduce((sum, letter) => (sum * 26) + (letter.charCodeAt(0) - 64), 0);
  }

  private formatSectionCode(value: number) {
    let remainder = value;
    let result = '';

    while (remainder > 0) {
      const charCodeOffset = (remainder - 1) % 26;
      result = String.fromCharCode(65 + charCodeOffset) + result;
      remainder = Math.floor((remainder - 1) / 26);
    }

    return result;
  }

  private parseRackCodeToNumber(sectionCode: string, rackCode: string) {
    const matcher = new RegExp(`^${this.escapeRegExp(sectionCode)}(\\d+)$`);
    const match = rackCode.match(matcher);
    if (!match) {
      return null;
    }
    return Number(match[1]);
  }

  private parseBinCodeToNumber(rackCode: string, binCode: string) {
    const matcher = new RegExp(`^${this.escapeRegExp(rackCode)}-[BS](\\d+)$`);
    const match = binCode.match(matcher);
    if (!match) {
      return null;
    }
    return Number(match[1]);
  }

  private formatBinName(code: string) {
    const match = code.match(/-S(\d+)$/);
    return match ? `Slot ${match[1]}` : code;
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async requireWarehouseRecord(warehouseId: string) {
    const warehouse = await this.prisma.wmsWarehouse.findFirst({
      where: {
        id: warehouseId,
      },
      include: {
        locations: {
          select: {
            id: true,
            code: true,
          },
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  private async requireLocationRecord(locationId: string, includeWarehouse = false) {
    const location = await this.prisma.wmsLocation.findFirst({
      where: {
        id: locationId,
      },
      include: includeWarehouse
        ? {
            warehouse: {
              select: {
                id: true,
                code: true,
              },
            },
          }
        : undefined,
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  private async requireLocationWithWarehouse(locationId: string) {
    const location = await this.prisma.wmsLocation.findFirst({
      where: {
        id: locationId,
      },
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
          },
        },
      },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  private async ensureWarehouseCodeAvailable(code: string, ignoreWarehouseId?: string) {
    const existing = await this.prisma.wmsWarehouse.findFirst({
      where: {
        code,
        ...(ignoreWarehouseId ? { NOT: { id: ignoreWarehouseId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Warehouse code already exists');
    }
  }

  private async ensureLocationCodeAvailable(warehouseId: string, code: string, ignoreLocationId?: string) {
    const existing = await this.prisma.wmsLocation.findFirst({
      where: {
        warehouseId,
        code,
        ...(ignoreLocationId ? { NOT: { id: ignoreLocationId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Location code already exists in this warehouse');
    }
  }

  private validateLocationPlacement(kind: WmsLocationKind, parentKind: WmsLocationKind | null) {
    if (kind === WmsLocationKind.SECTION) {
      if (parentKind) {
        throw new BadRequestException('Sections must be created at the warehouse root');
      }
      return;
    }

    if (kind === WmsLocationKind.RACK) {
      if (parentKind !== WmsLocationKind.SECTION) {
        throw new BadRequestException('Racks must be created inside a section');
      }
      return;
    }

    if (kind === WmsLocationKind.BIN) {
      if (parentKind !== WmsLocationKind.RACK) {
        throw new BadRequestException('Slots must be created inside a rack');
      }
      return;
    }

    if (parentKind) {
      throw new BadRequestException('Operational locations must sit at the warehouse root');
    }
  }

  private mapWarehouseListItem(warehouse: WarehouseOverviewRecord) {
    const locationCounts = this.countLocationKinds(warehouse.locations);

    return {
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      billingCompanyName: warehouse.billingCompanyName,
      bankName: warehouse.bankName,
      status: warehouse.status,
      locationCount: warehouse.locations.length,
      structuralLocationCount: locationCounts.structural,
      operationalLocationCount: locationCounts.operational,
      sectionCount: locationCounts.sections,
      rackCount: locationCounts.racks,
      binCount: locationCounts.bins,
      createdAt: warehouse.createdAt,
      updatedAt: warehouse.updatedAt,
    };
  }

  private mapWarehouseDetail(
    warehouse: WarehouseOverviewRecord,
    inventorySummary: WarehouseInventorySummary | null,
  ) {
    const locationCounts = this.countLocationKinds(warehouse.locations);
    const roots = this.buildLocationTree(warehouse.locations);

    return {
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      description: warehouse.description,
      address: warehouse.address,
      billingCompanyName: warehouse.billingCompanyName,
      billingAddress: warehouse.billingAddress,
      bankName: warehouse.bankName,
      bankAccountName: warehouse.bankAccountName,
      bankAccountNumber: warehouse.bankAccountNumber,
      bankAccountType: warehouse.bankAccountType,
      bankBranch: warehouse.bankBranch,
      paymentInstructions: warehouse.paymentInstructions,
      status: warehouse.status,
      stats: {
        totalLocations: warehouse.locations.length,
        sections: locationCounts.sections,
        racks: locationCounts.racks,
        bins: locationCounts.bins,
        operational: locationCounts.operational,
      },
      operationalLocations: roots.filter((node) => isOperationalKind(node.kind)),
      structuralLocations: roots.filter((node) => node.kind === WmsLocationKind.SECTION),
      rootLocations: roots,
      inventorySummary: inventorySummary ?? {
        serializedUnits: 0,
        putAwayUnits: 0,
        stagedUnits: 0,
        attentionUnits: 0,
      },
      createdAt: warehouse.createdAt,
      updatedAt: warehouse.updatedAt,
    };
  }

  private async buildWarehouseInventorySummary(warehouseId: string): Promise<WarehouseInventorySummary> {
    const [serializedUnits, putAwayUnits, stagedUnits, attentionUnits] = await Promise.all([
      this.prisma.wmsInventoryUnit.count({
        where: {
          warehouseId,
        },
      }),
      this.prisma.wmsInventoryUnit.count({
        where: {
          warehouseId,
          status: WmsInventoryUnitStatus.PUTAWAY,
        },
      }),
      this.prisma.wmsInventoryUnit.count({
        where: {
          warehouseId,
          status: WmsInventoryUnitStatus.STAGED,
        },
      }),
      this.prisma.wmsInventoryUnit.count({
        where: {
          warehouseId,
          OR: [
            {
              status: {
                in: [WmsInventoryUnitStatus.RTS, WmsInventoryUnitStatus.DAMAGED],
              },
            },
            {
              currentLocation: {
                kind: {
                  in: [
                    WmsLocationKind.RTS,
                    WmsLocationKind.DAMAGE,
                    WmsLocationKind.QUARANTINE,
                  ],
                },
              },
            },
          ],
        },
      }),
    ]);

    return {
      serializedUnits,
      putAwayUnits,
      stagedUnits,
      attentionUnits,
    };
  }

  private countLocationKinds(locations: Array<WarehouseOverviewRecord['locations'][number]>) {
    return locations.reduce(
      (counts, location) => {
        if (isStructuralKind(location.kind)) {
          counts.structural += 1;
        }
        if (isOperationalKind(location.kind)) {
          counts.operational += 1;
        }
        if (location.kind === WmsLocationKind.SECTION) {
          counts.sections += 1;
        }
        if (location.kind === WmsLocationKind.RACK) {
          counts.racks += 1;
        }
        if (location.kind === WmsLocationKind.BIN) {
          counts.bins += 1;
        }
        return counts;
      },
      {
        structural: 0,
        operational: 0,
        sections: 0,
        racks: 0,
        bins: 0,
      },
    );
  }

  private buildLocationTree(locations: WarehouseOverviewRecord['locations']) {
    const nodes = new Map<string, LocationTreeNode>();

    for (const location of locations) {
      nodes.set(location.id, {
        ...location,
        parentId: location.parentId ?? null,
        children: [],
      });
    }

    const roots: LocationTreeNode[] = [];

    for (const location of locations) {
      const node = nodes.get(location.id)!;

      if (location.parentId && nodes.has(location.parentId)) {
        nodes.get(location.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return this.sortLocationNodes(roots);
  }

  private sortLocationNodes(nodes: LocationTreeNode[]) {
    return [...nodes]
      .sort((left, right) => {
        if (isStructuralKind(left.kind) && isStructuralKind(right.kind)) {
          if (left.kind === WmsLocationKind.SECTION && right.kind === WmsLocationKind.SECTION) {
            const leftSectionNumber = this.parseSectionCodeToNumber(left.code);
            const rightSectionNumber = this.parseSectionCodeToNumber(right.code);
            if (leftSectionNumber && rightSectionNumber && leftSectionNumber !== rightSectionNumber) {
              return leftSectionNumber - rightSectionNumber;
            }
          }

          return this.compareLocationCodes(left.code, right.code);
        }

        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
      })
      .map((node) => ({
        ...node,
        children: this.sortLocationNodes(node.children),
      }));
  }

  private compareLocationCodes(left: string, right: string) {
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  }

  private handlePrismaConstraintError(error: unknown, fallbackMessage: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A warehouse or location with that identity already exists');
    }

    throw error instanceof Error ? error : new BadRequestException(fallbackMessage);
  }
}
