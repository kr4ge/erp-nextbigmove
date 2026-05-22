import { Module } from '@nestjs/common';
import { WmsFulfillmentModule } from '../wms-fulfillment/wms-fulfillment.module';
import { WmsInventoryModule } from '../wms-inventory/wms-inventory.module';
import { WmsMobileController } from './wms-mobile.controller';
import { WmsMobileService } from './wms-mobile.service';

@Module({
  imports: [WmsInventoryModule, WmsFulfillmentModule],
  controllers: [WmsMobileController],
  providers: [WmsMobileService],
})
export class WmsMobileModule {}
