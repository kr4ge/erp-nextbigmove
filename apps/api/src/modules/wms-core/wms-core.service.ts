import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WmsCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async getBootstrap() {
    const tenantId = this.cls.get('tenantId') as string | undefined;
    const userRole = (this.cls.get('userRole') as string | undefined) || null;

    if (!tenantId) {
      return {
        tenantReady: false,
        stockTruth: {
          serializedByDefault: true,
          receivingOwnsStockCreation: true,
          inventoryTruth: 'UNIT_AND_MOVEMENT',
        },
        readiness: {
          posStores: 0,
          posWarehouses: 0,
          posProducts: 0,
        },
        modules: [
          { key: 'purchasing', label: 'Purchasing', permission: 'wms.purchasing.read' },
          { key: 'warehouses', label: 'Warehouses', permission: 'wms.warehouses.read' },
          { key: 'products', label: 'Product Profiles', permission: 'wms.products.read' },
          { key: 'receiving', label: 'Receiving', permission: 'wms.receiving.read' },
          { key: 'inventory', label: 'Inventory', permission: 'wms.inventory.read' },
        ],
        context: {
          userRole,
          tenantId: null,
        },
      };
    }

    const [posStores, posWarehouses, posProducts] = await Promise.all([
      this.prisma.posStore.count({
        where: { tenantId },
      }),
      this.prisma.posWarehouse.count({
        where: {
          store: {
            tenantId,
          },
        },
      }),
      this.prisma.posProduct.count({
        where: {
          store: {
            tenantId,
          },
        },
      }),
    ]);

    return {
      tenantReady: true,
      stockTruth: {
        serializedByDefault: true,
        receivingOwnsStockCreation: true,
        inventoryTruth: 'UNIT_AND_MOVEMENT',
      },
      readiness: {
        posStores,
        posWarehouses,
        posProducts,
      },
      modules: [
        { key: 'purchasing', label: 'Purchasing', permission: 'wms.purchasing.read' },
        { key: 'warehouses', label: 'Warehouses', permission: 'wms.warehouses.read' },
        { key: 'products', label: 'Product Profiles', permission: 'wms.products.read' },
        { key: 'receiving', label: 'Receiving', permission: 'wms.receiving.read' },
        { key: 'inventory', label: 'Inventory', permission: 'wms.inventory.read' },
      ],
      context: {
        userRole,
        tenantId,
      },
    };
  }
}
