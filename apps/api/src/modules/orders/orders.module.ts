import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CommonServicesModule } from '../../common/services/services.module';
import { IntegrationModule } from '../integrations/integration.module';
import { CONFIRMATION_UPDATE_QUEUE } from './orders.constants';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersQueueProcessor } from './orders.processor';

@Module({
  imports: [
    PrismaModule,
    CommonServicesModule,
    IntegrationModule,
    BullModule.registerQueue({
      name: CONFIRMATION_UPDATE_QUEUE,
    }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersQueueProcessor],
})
export class OrdersModule {}
