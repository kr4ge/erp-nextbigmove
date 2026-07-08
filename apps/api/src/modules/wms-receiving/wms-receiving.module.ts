import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflows/workflow.module';
import { WmsFulfillmentModule } from '../wms-fulfillment/wms-fulfillment.module';
import { WmsPurchasingModule } from '../wms-purchasing/wms-purchasing.module';
import { WmsReceivingController } from './wms-receiving.controller';
import { WmsReceivingService } from './wms-receiving.service';

@Module({
  imports: [WmsFulfillmentModule, WorkflowModule, WmsPurchasingModule],
  controllers: [WmsReceivingController],
  providers: [WmsReceivingService],
  exports: [WmsReceivingService],
})
export class WmsReceivingModule {}
