import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { WmsFulfillmentModule } from '../wms-fulfillment/wms-fulfillment.module';
import { WmsInventoryModule } from '../wms-inventory/wms-inventory.module';
import { WmsSettingsModule } from '../wms-settings/wms-settings.module';
import { WmsMobileController } from './wms-mobile.controller';
import { WMS_PICKING_HANDOFF_QUEUE } from './wms-mobile.constants';
import { WmsMobileProcessor } from './wms-mobile.processor';
import { WmsMobileService } from './wms-mobile.service';

@Module({
  imports: [
    WmsInventoryModule,
    WmsFulfillmentModule,
    WmsSettingsModule,
    OrdersModule,
    BullModule.registerQueue({
      name: WMS_PICKING_HANDOFF_QUEUE,
    }),
  ],
  controllers: [WmsMobileController],
  providers: [WmsMobileService, WmsMobileProcessor],
})
export class WmsMobileModule {}
