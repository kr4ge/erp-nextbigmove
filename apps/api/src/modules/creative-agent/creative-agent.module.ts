import { Module } from '@nestjs/common';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';
import { CommonServicesModule } from '../../common/services/services.module';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreativeAdvertisingDashboardController } from './creative-advertising-dashboard.controller';
import { CreativeInsightController } from './creative-insight.controller';
import { CreativeAliasController } from './creative-alias.controller';
import { CreativeAssetsController } from './creative-assets.controller';
import { CreativeEnrollmentController } from './creative-enrollment.controller';
import { CreativeLibraryController } from './creative-library.controller';
import { CreativeOverviewController } from './creative-overview.controller';
import { CreativePerformanceController } from './creative-performance.controller';
import { CreativeStoreController } from './creative-store.controller';
import { CreativeStrategyController } from './creative-strategy.controller';
import { CreativeWorkflowController } from './creative-workflow.controller';
import { CreativeAccessService } from './services/creative-access.service';
import { CreativeAdvertisingDashboardService } from './services/creative-advertising-dashboard.service';
import { CreativeInsightService } from './services/creative-insight.service';
import { CreativeAssetsService } from './services/creative-assets.service';
import { CreativeAliasService } from './services/creative-alias.service';
import { CreativeEnrollmentService } from './services/creative-enrollment.service';
import { CreativeLibraryService } from './services/creative-library.service';
import { CreativeMatchingService } from './services/creative-matching.service';
import { CreativeMetaLinkService } from './services/creative-meta-link.service';
import { CreativeOverviewService } from './services/creative-overview.service';
import { CreativePerformanceService } from './services/creative-performance.service';
import { CreativeStoreService } from './services/creative-store.service';
import { CreativeStrategyService } from './services/creative-strategy.service';
import { CreativeThumbnailService } from './services/creative-thumbnail.service';
import { CreativeWorkflowService } from './services/creative-workflow.service';

@Module({
  imports: [CommonServicesModule, AiSettingsModule],
  controllers: [
    CreativeStoreController,
    CreativeLibraryController,
    CreativeEnrollmentController,
    CreativeAliasController,
    CreativeWorkflowController,
    CreativeOverviewController,
    CreativeAssetsController,
    CreativePerformanceController,
    CreativeAdvertisingDashboardController,
    CreativeInsightController,
    CreativeStrategyController,
  ],
  providers: [
    PermissionsGuard,
    CreativeAccessService,
    CreativeStoreService,
    CreativeEnrollmentService,
    CreativeLibraryService,
    CreativeMatchingService,
    CreativeMetaLinkService,
    CreativeAliasService,
    CreativeWorkflowService,
    CreativeOverviewService,
    CreativeAssetsService,
    CreativePerformanceService,
    CreativeAdvertisingDashboardService,
    CreativeInsightService,
    CreativeStrategyService,
    CreativeThumbnailService,
  ],
  exports: [CreativeMetaLinkService],
})
export class CreativeAgentModule {}
