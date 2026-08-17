import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CommonServicesModule } from '../../common/services/services.module';
import { IntegrationModule } from '../integrations/integration.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { CONFIRMATION_UPDATE_QUEUE } from './orders.constants';
import { OrdersAgingNotificationCacheService } from './orders-aging-notification-cache.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersQueueProcessor } from './orders.processor';
import { shouldRunApiBackgroundServices } from '../../common/runtime/process-role';

@Module({
  imports: [
    PrismaModule,
    CommonServicesModule,
    IntegrationModule,
    WorkflowModule,
    BullModule.registerQueue({
      name: CONFIRMATION_UPDATE_QUEUE,
    }),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersAgingNotificationCacheService,
    ...(shouldRunApiBackgroundServices() ? [OrdersQueueProcessor] : []),
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
