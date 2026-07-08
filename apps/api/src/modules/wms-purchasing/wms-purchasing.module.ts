import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { WorkflowModule } from '../workflows/workflow.module';
import { StockRequestsController } from './stock-requests.controller';
import { WmsPurchasingController } from './wms-purchasing.controller';
import { WmsPurchasingService } from './wms-purchasing.service';

@Module({
  imports: [WorkflowModule],
  controllers: [WmsPurchasingController, StockRequestsController],
  providers: [WmsPurchasingService, TenantGuard, PermissionsGuard],
  exports: [WmsPurchasingService],
})
export class WmsPurchasingModule {}
