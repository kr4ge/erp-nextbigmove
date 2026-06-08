import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { IntegrationModule } from '../integrations/integration.module';
import { WmsIntegrationsController } from './wms-integrations.controller';
import { WmsIntegrationsService } from './wms-integrations.service';

@Module({
  imports: [PrismaModule, IntegrationModule],
  controllers: [WmsIntegrationsController],
  providers: [WmsIntegrationsService],
  exports: [WmsIntegrationsService],
})
export class WmsIntegrationsModule {}
