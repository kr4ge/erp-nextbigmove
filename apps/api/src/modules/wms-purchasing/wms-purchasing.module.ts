import { Module } from '@nestjs/common';
import { WmsPurchasingController } from './wms-purchasing.controller';
import { WmsPurchasingService } from './wms-purchasing.service';

@Module({
  controllers: [WmsPurchasingController],
  providers: [WmsPurchasingService],
})
export class WmsPurchasingModule {}

