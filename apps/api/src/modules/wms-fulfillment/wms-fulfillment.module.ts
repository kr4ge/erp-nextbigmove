import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsInventoryModule } from '../wms-inventory/wms-inventory.module';
import { WmsFulfillmentSyncService } from './wms-fulfillment-sync.service';

@Module({
  imports: [PrismaModule, WmsInventoryModule],
  providers: [WmsFulfillmentSyncService],
  exports: [WmsFulfillmentSyncService],
})
export class WmsFulfillmentModule {}
