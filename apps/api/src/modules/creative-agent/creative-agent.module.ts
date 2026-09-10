import { Module } from '@nestjs/common';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';
import { BullModule } from '@nestjs/bull';
import { CommonServicesModule } from '../../common/services/services.module';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { resolveProcessRole } from '../../common/runtime/process-role';
import { CreativeAiController } from './creative-ai.controller';
import { CreativeOptionsController } from './creative-options.controller';
import { CreativeOptionsService } from './services/creative-options.service';
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
import { CreativeLegacyAttributionService } from './services/creative-legacy-attribution.service';
import { CreativeMatchingService } from './services/creative-matching.service';
import { CreativeMetaLinkService } from './services/creative-meta-link.service';
import { CreativeOverviewService } from './services/creative-overview.service';
import { CreativePerformanceService } from './services/creative-performance.service';
import { CreativeStoreService } from './services/creative-store.service';
import { CreativeStrategyService } from './services/creative-strategy.service';
import { CreativeThumbnailService } from './services/creative-thumbnail.service';
import { CreativeWorkflowService } from './services/creative-workflow.service';
import { CreativeAiRunService } from './services/creative-ai-run.service';
import { CreativeAiMediaService } from './services/creative-ai-media.service';
import { CreativeAiContextService } from './services/creative-ai-context.service';
import { CreativeAiAnalyzerService } from './services/creative-ai-analyzer.service';
import { ClaudeboxClientService } from './services/claudebox-client.service';
import { AiGatewayAdminClientService } from './services/ai-gateway-admin-client.service';
import { CreativeAiPolicyService } from './services/creative-ai-policy.service';
import { CreativeAiProcessor } from './processors/creative-ai.processor';
import { CREATIVE_AI_QUEUE } from './creative-agent.constants';
import { CreativeAiEnabledGuard } from './guards/creative-ai-enabled.guard';
import { isCreativeAiEnabled } from './utils/creative-ai-enabled';

@Module({
  imports: [
    CommonServicesModule,
    AiSettingsModule,
    BullModule.registerQueue({ name: CREATIVE_AI_QUEUE }),
  ],
  controllers: [
    CreativeAiController,
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
    CreativeOptionsController,
  ],
  providers: [
    PermissionsGuard,
    CreativeAiEnabledGuard,
    CreativeAccessService,
    CreativeStoreService,
    CreativeEnrollmentService,
    CreativeLibraryService,
    CreativeLegacyAttributionService,
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
    CreativeOptionsService,
    CreativeAiRunService,
    CreativeAiMediaService,
    CreativeAiContextService,
    CreativeAiAnalyzerService,
    ClaudeboxClientService,
    AiGatewayAdminClientService,
    CreativeAiPolicyService,
    ...(isCreativeAiEnabled() && resolveProcessRole() !== 'api' ? [CreativeAiProcessor] : []),
  ],
  exports: [CreativeMetaLinkService],
})
export class CreativeAgentModule {}
