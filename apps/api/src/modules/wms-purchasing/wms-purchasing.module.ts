import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WmsInventoryModule } from '../wms-inventory/wms-inventory.module';
import { WmsPurchasingController } from './wms-purchasing.controller';
import { WmsPurchasingService } from './wms-purchasing.service';

@Module({
  imports: [PrismaModule, WmsInventoryModule],
  controllers: [WmsPurchasingController],
  providers: [WmsPurchasingService],
  exports: [WmsPurchasingService],
})
export class WmsPurchasingModule {}
