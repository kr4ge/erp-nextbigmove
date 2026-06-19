import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';
import { WmsFulfillmentModule } from '../wms-fulfillment/wms-fulfillment.module';
import { WmsInventoryModule } from '../wms-inventory/wms-inventory.module';
import { WmsDispatchController } from './wms-dispatch.controller';
import { WmsDispatchService } from './wms-dispatch.service';

@Module({
  imports: [PrismaModule, WmsInventoryModule, WmsFulfillmentModule, OrdersModule],
  controllers: [WmsDispatchController],
  providers: [WmsDispatchService],
  exports: [WmsDispatchService],
})
export class WmsDispatchModule {}
