import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsRequestsController } from './wms-requests.controller';
import { WmsRequestsService } from './wms-requests.service';

@Module({
  imports: [PrismaModule],
  controllers: [WmsRequestsController],
  providers: [WmsRequestsService],
  exports: [WmsRequestsService],
})
export class WmsRequestsModule {}
