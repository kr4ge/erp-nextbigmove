import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsForecastingController } from './wms-forecasting.controller';
import { WmsForecastingService } from './wms-forecasting.service';

@Module({
  imports: [PrismaModule],
  controllers: [WmsForecastingController],
  providers: [WmsForecastingService],
})
export class WmsForecastingModule {}
