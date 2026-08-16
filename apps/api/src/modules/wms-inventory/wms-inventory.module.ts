import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsFulfillmentModule } from '../wms-fulfillment/wms-fulfillment.module';
import { WmsInventoryController } from './wms-inventory.controller';
import { WmsInventoryCogsModule } from './wms-inventory-cogs.module';
import { WmsDispatchReconcilerService } from './wms-dispatch-reconciler.service';
import { WmsInventoryService } from './wms-inventory.service';

@Module({
  imports: [PrismaModule, WmsInventoryCogsModule, WmsFulfillmentModule],
  controllers: [WmsInventoryController],
  providers: [WmsInventoryService, WmsDispatchReconcilerService],
  exports: [WmsInventoryService],
})
export class WmsInventoryModule {}
