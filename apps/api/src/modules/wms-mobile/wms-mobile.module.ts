import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { WmsFulfillmentModule } from '../wms-fulfillment/wms-fulfillment.module';
import { WmsInventoryModule } from '../wms-inventory/wms-inventory.module';
import { WmsSettingsModule } from '../wms-settings/wms-settings.module';
import { WmsMobileController } from './wms-mobile.controller';
import { WmsMobileService } from './wms-mobile.service';

@Module({
  imports: [WmsInventoryModule, WmsFulfillmentModule, WmsSettingsModule, OrdersModule],
  controllers: [WmsMobileController],
  providers: [WmsMobileService],
})
export class WmsMobileModule {}
