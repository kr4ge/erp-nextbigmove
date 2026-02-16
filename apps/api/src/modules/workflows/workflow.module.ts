import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowProcessorService } from './services/workflow-processor.service';
import { WorkflowSchedulerService } from './services/workflow-scheduler.service';
import { DateRangeService } from './services/date-range.service';
import { WorkflowExecutionGateway } from './gateways/workflow-execution.gateway';
import { WorkflowQueueProcessor } from './processors/workflow.processor';
import { WORKFLOW_QUEUE } from './workflow.constants';
import { WorkflowLogService } from './services/workflow-log.service';
import { WorkflowProgressCacheService } from './services/workflow-progress-cache.service';
import { WorkflowExecutionReconcilerService } from './services/workflow-execution-reconciler.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { IntegrationModule } from '../integrations/integration.module';
import { ReconcileMarketingService } from './services/reconcile-marketing.service';
import { ReconcileSalesService } from './services/reconcile-sales.service';

@Module({
  imports: [
    PrismaModule,
    IntegrationModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: WORKFLOW_QUEUE,
    }),
  ],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    WorkflowProcessorService,
    WorkflowSchedulerService,
    DateRangeService,
    WorkflowQueueProcessor,
    WorkflowExecutionGateway,
    WorkflowLogService,
    WorkflowProgressCacheService,
    WorkflowExecutionReconcilerService,
    ReconcileMarketingService,
    ReconcileSalesService,
  ],
  exports: [WorkflowService],
})
export class WorkflowModule {}
