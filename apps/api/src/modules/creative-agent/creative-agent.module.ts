import { Module } from '@nestjs/common';
import { CommonServicesModule } from '../../common/services/services.module';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreativeAdvertisingDashboardController } from './creative-advertising-dashboard.controller';
import { CreativeAliasController } from './creative-alias.controller';
import { CreativeAssetsController } from './creative-assets.controller';
import { CreativeEnrollmentController } from './creative-enrollment.controller';
import { CreativeLibraryController } from './creative-library.controller';
import { CreativeOverviewController } from './creative-overview.controller';
import { CreativePerformanceController } from './creative-performance.controller';
import { CreativeStoreController } from './creative-store.controller';
import { CreativeWorkflowController } from './creative-workflow.controller';
import { CreativeAccessService } from './services/creative-access.service';
import { CreativeAdvertisingDashboardService } from './services/creative-advertising-dashboard.service';
import { CreativeAssetsService } from './services/creative-assets.service';
import { CreativeAliasService } from './services/creative-alias.service';
import { CreativeEnrollmentService } from './services/creative-enrollment.service';
import { CreativeLibraryService } from './services/creative-library.service';
import { CreativeMatchingService } from './services/creative-matching.service';
import { CreativeMetaLinkService } from './services/creative-meta-link.service';
import { CreativeOverviewService } from './services/creative-overview.service';
import { CreativePerformanceService } from './services/creative-performance.service';
import { CreativeStoreService } from './services/creative-store.service';
import { CreativeThumbnailService } from './services/creative-thumbnail.service';
import { CreativeWorkflowService } from './services/creative-workflow.service';

@Module({
  imports: [CommonServicesModule],
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
    CreativeThumbnailService,
  ],
  exports: [CreativeMetaLinkService],
})
export class CreativeAgentModule {}
