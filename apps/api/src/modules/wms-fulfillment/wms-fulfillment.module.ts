import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { resolveProcessRole, shouldRunApiBackgroundServices } from '../../common/runtime/process-role';
import { WmsInventoryCogsModule } from '../wms-inventory/wms-inventory-cogs.module';
import { WmsDemandQueueRefreshProcessor } from './wms-demand-queue-refresh.processor';
import { WMS_DEMAND_QUEUE_REFRESH_QUEUE } from './wms-fulfillment.constants';
import { WmsFulfillmentOpsController } from './wms-fulfillment-ops.controller';
import { WmsFulfillmentOpsService } from './wms-fulfillment-ops.service';
import { WmsFulfillmentSyncService } from './wms-fulfillment-sync.service';
import { WmsInventoryExpirationReconcilerService } from './wms-inventory-expiration-reconciler.service';

@Module({
  imports: [
    PrismaModule,
    WmsInventoryCogsModule,
    BullModule.registerQueue({
      name: WMS_DEMAND_QUEUE_REFRESH_QUEUE,
    }),
  ],
  controllers: [WmsFulfillmentOpsController],
  providers: [
    WmsFulfillmentSyncService,
    WmsFulfillmentOpsService,
    ...(resolveProcessRole() !== 'api'
      ? [WmsDemandQueueRefreshProcessor]
      : []),
    ...(shouldRunApiBackgroundServices()
      ? [WmsInventoryExpirationReconcilerService]
      : []),
  ],
  exports: [WmsFulfillmentSyncService, WmsFulfillmentOpsService],
})
export class WmsFulfillmentModule {}
