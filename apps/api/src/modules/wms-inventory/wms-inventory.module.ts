import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsFulfillmentModule } from '../wms-fulfillment/wms-fulfillment.module';
import { WmsInventoryController } from './wms-inventory.controller';
import { WmsInventoryCogsModule } from './wms-inventory-cogs.module';
import { WmsDispatchReconcilerService } from './wms-dispatch-reconciler.service';
import { WmsInventoryService } from './wms-inventory.service';
import { WmsOutboundRecordsService } from './wms-outbound-records.service';
import { shouldRunApiBackgroundServices } from '../../common/runtime/process-role';

@Module({
  imports: [PrismaModule, WmsInventoryCogsModule, WmsFulfillmentModule],
  controllers: [WmsInventoryController],
  providers: [
    WmsInventoryService,
    WmsOutboundRecordsService,
    ...(shouldRunApiBackgroundServices() ? [WmsDispatchReconcilerService] : []),
  ],
  exports: [WmsInventoryService, WmsOutboundRecordsService],
})
export class WmsInventoryModule {}
