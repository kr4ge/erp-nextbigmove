import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CommonServicesModule } from '../../common/services/services.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { IntegrationModule } from '../integrations/integration.module';
import { AdCreativeSyncService } from './ad-creative-sync.service';
import { AdEvaluatorService } from './ad-evaluator.service';
import { AdvertisingController } from './advertising.controller';
import { AdvertisingService } from './advertising.service';

@Module({
  imports: [PrismaModule, CommonServicesModule, WorkflowModule, IntegrationModule],
  controllers: [AdvertisingController],
  providers: [AdvertisingService, AdEvaluatorService, AdCreativeSyncService],
  exports: [AdvertisingService],
})
export class AdvertisingModule {}
