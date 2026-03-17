import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CommonServicesModule } from '../../common/services/services.module';
import { IntegrationModule } from '../integrations/integration.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PrismaModule, CommonServicesModule, IntegrationModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
