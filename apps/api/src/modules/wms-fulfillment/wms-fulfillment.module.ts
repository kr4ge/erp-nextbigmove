import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsInventoryModule } from '../wms-inventory/wms-inventory.module';
import { WmsFulfillmentOpsController } from './wms-fulfillment-ops.controller';
import { WmsFulfillmentOpsService } from './wms-fulfillment-ops.service';
import { WmsFulfillmentSyncService } from './wms-fulfillment-sync.service';

@Module({
  imports: [PrismaModule, WmsInventoryModule],
  controllers: [WmsFulfillmentOpsController],
  providers: [WmsFulfillmentSyncService, WmsFulfillmentOpsService],
  exports: [WmsFulfillmentSyncService, WmsFulfillmentOpsService],
})
export class WmsFulfillmentModule {}
