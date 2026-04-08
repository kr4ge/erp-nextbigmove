import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsWarehousesController } from './wms-warehouses.controller';
import { WmsWarehousesService } from './wms-warehouses.service';

@Module({
  imports: [PrismaModule],
  controllers: [WmsWarehousesController],
  providers: [WmsWarehousesService],
  exports: [WmsWarehousesService],
})
export class WmsWarehousesModule {}
