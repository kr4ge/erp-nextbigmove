import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsInventoryController } from './wms-inventory.controller';
import { WmsInventoryAdjustmentsService } from './wms-inventory-adjustments.service';
import { WmsInventoryCatalogService } from './wms-inventory-catalog.service';
import { WmsInventoryService } from './wms-inventory.service';
import { WmsInventoryTransfersService } from './wms-inventory-transfers.service';
import { WmsInventoryUnitsService } from './wms-inventory-units.service';

@Module({
  imports: [PrismaModule],
  controllers: [WmsInventoryController],
  providers: [
    WmsInventoryService,
    WmsInventoryAdjustmentsService,
    WmsInventoryCatalogService,
    WmsInventoryTransfersService,
    WmsInventoryUnitsService,
  ],
  exports: [
    WmsInventoryService,
    WmsInventoryAdjustmentsService,
    WmsInventoryCatalogService,
    WmsInventoryTransfersService,
    WmsInventoryUnitsService,
  ],
})
export class WmsInventoryModule {}
