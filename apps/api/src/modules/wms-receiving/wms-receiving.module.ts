import { Module } from '@nestjs/common';
import { WmsReceivingController } from './wms-receiving.controller';
import { WmsReceivingService } from './wms-receiving.service';

@Module({
  controllers: [WmsReceivingController],
  providers: [WmsReceivingService],
  exports: [WmsReceivingService],
})
export class WmsReceivingModule {}
