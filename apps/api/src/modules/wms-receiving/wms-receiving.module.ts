import { Module } from '@nestjs/common';
import { WmsFulfillmentModule } from '../wms-fulfillment/wms-fulfillment.module';
import { WmsReceivingController } from './wms-receiving.controller';
import { WmsReceivingService } from './wms-receiving.service';

@Module({
  imports: [WmsFulfillmentModule],
  controllers: [WmsReceivingController],
  providers: [WmsReceivingService],
  exports: [WmsReceivingService],
})
export class WmsReceivingModule {}
