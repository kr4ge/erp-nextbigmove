import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsInventoryController } from './wms-inventory.controller';
import { WmsInventoryService } from './wms-inventory.service';

@Module({
  imports: [PrismaModule],
  controllers: [WmsInventoryController],
  providers: [WmsInventoryService],
  exports: [WmsInventoryService],
})
export class WmsInventoryModule {}
