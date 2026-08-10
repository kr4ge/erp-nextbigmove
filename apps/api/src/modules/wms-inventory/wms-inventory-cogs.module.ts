import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsInventoryCogsService } from './wms-inventory-cogs.service';

@Module({
  imports: [PrismaModule],
  providers: [WmsInventoryCogsService],
  exports: [WmsInventoryCogsService],
})
export class WmsInventoryCogsModule {}
