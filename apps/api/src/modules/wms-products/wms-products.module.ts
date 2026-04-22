import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { IntegrationModule } from '../integrations/integration.module';
import { WmsProductsController } from './wms-products.controller';
import { WmsProductsService } from './wms-products.service';

@Module({
  imports: [PrismaModule, IntegrationModule],
  controllers: [WmsProductsController],
  providers: [WmsProductsService],
  exports: [WmsProductsService],
})
export class WmsProductsModule {}
