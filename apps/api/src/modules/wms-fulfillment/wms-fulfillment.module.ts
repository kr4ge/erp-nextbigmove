import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsInventoryCogsModule } from '../wms-inventory/wms-inventory-cogs.module';
import { WmsFulfillmentOpsController } from './wms-fulfillment-ops.controller';
import { WmsFulfillmentOpsService } from './wms-fulfillment-ops.service';
import { WmsFulfillmentSyncService } from './wms-fulfillment-sync.service';
import { WmsInventoryExpirationReconcilerService } from './wms-inventory-expiration-reconciler.service';
import { shouldRunApiBackgroundServices } from '../../common/runtime/process-role';

@Module({
  imports: [PrismaModule, WmsInventoryCogsModule],
  controllers: [WmsFulfillmentOpsController],
  providers: [
    WmsFulfillmentSyncService,
    WmsFulfillmentOpsService,
    ...(shouldRunApiBackgroundServices()
      ? [WmsInventoryExpirationReconcilerService]
      : []),
  ],
  exports: [WmsFulfillmentSyncService, WmsFulfillmentOpsService],
})
export class WmsFulfillmentModule {}
