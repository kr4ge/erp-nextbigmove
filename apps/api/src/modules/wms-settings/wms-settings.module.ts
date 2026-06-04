import { Module } from '@nestjs/common';
import { WmsSettingsController } from './wms-settings.controller';
import { WmsSettingsService } from './wms-settings.service';
import { WmsStoxReleasesService } from './wms-stox-releases.service';

@Module({
  controllers: [WmsSettingsController],
  providers: [WmsSettingsService, WmsStoxReleasesService],
  exports: [WmsStoxReleasesService],
})
export class WmsSettingsModule {}
