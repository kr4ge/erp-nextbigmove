import { Module } from '@nestjs/common';
import { WmsMobileController } from './wms-mobile.controller';
import { WmsMobileService } from './wms-mobile.service';

@Module({
  controllers: [WmsMobileController],
  providers: [WmsMobileService],
})
export class WmsMobileModule {}
