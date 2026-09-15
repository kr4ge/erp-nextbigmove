import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsReportsController } from './wms-reports.controller';
import { WmsReportsService } from './wms-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [WmsReportsController],
  providers: [WmsReportsService],
})
export class WmsReportsModule {}
