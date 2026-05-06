import { Module } from '@nestjs/common';
import { WmsSettingsController } from './wms-settings.controller';
import { WmsSettingsService } from './wms-settings.service';

@Module({
  controllers: [WmsSettingsController],
  providers: [WmsSettingsService],
})
export class WmsSettingsModule {}
