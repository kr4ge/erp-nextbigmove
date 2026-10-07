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
import { CreativeAiFrameService } from './services/creative-ai-frame.service';
import { CreativeAiDocumentService } from './services/creative-ai-document.service';
import { CreativeAiContextService } from './services/creative-ai-context.service';
import { CreativeAiAnalyzerService } from './services/creative-ai-analyzer.service';
import { ClaudeboxClientService } from './services/claudebox-client.service';
import { AiGatewayAdminClientService } from './services/ai-gateway-admin-client.service';
import { CreativeAiPolicyService } from './services/creative-ai-policy.service';
import { CreativeKnowledgeController } from './creative-knowledge.controller';
import { CreativeStoreTargetController } from './creative-store-target.controller';
import { CreativeKnowledgeService } from './services/creative-knowledge.service';
import { CreativePromptContextService } from './services/creative-prompt-context.service';
import { CreativePromptTemplateService } from './services/creative-prompt-template.service';
import { CreativeMediaFetchService } from './services/creative-media-fetch.service';
import { CreativeStoreTargetService } from './services/creative-store-target.service';
import { CreativeEnrollmentReviewService } from './services/creative-enrollment-review.service';
import { CreativeAiMaintenanceService } from './services/creative-ai-maintenance.service';
import { CreativeAiProcessor } from './processors/creative-ai.processor';
import { CREATIVE_AI_QUEUE, CREATIVE_META_DRAFT_QUEUE } from './creative-agent.constants';
import { EncryptionService } from '../integrations/services/encryption.service';
import { CreativeHandoffController } from './creative-handoff.controller';
import { CreativeStorePublishingController } from './creative-store-publishing.controller';
import { CreativeSourceMediaService } from './services/creative-source-media.service';
import { CreativeMetaCredentialsService } from './services/creative-meta-credentials.service';
import { CreativeStorePublishingService } from './services/creative-store-publishing.service';
import { CreativeMetaDraftService } from './services/creative-meta-draft.service';
import { CreativeHandoffService } from './services/creative-handoff.service';
import { CreativeMediaMaintenanceService } from './services/creative-media-maintenance.service';
import { CreativeMetaDraftProcessor } from './processors/creative-meta-draft.processor';
import { CreativeAiEnabledGuard } from './guards/creative-ai-enabled.guard';
import { isCreativeAiEnabled } from './utils/creative-ai-enabled';

function metaDraftRatePerMinute() {
  const value = Number(process.env.CREATIVE_META_DRAFT_RATE_PER_MINUTE || '10');
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 10;
}

@Module({
  imports: [
    CommonServicesModule,
    AiSettingsModule,
    BullModule.registerQueue({ name: CREATIVE_AI_QUEUE }),
    // Meta drafting: its own queue, rate-limited so a burst of sends drains
    // over minutes instead of earning the ad account a throttle.
    BullModule.registerQueue({
      name: CREATIVE_META_DRAFT_QUEUE,
      limiter: { max: metaDraftRatePerMinute(), duration: 60_000 },
    }),
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
    CreativeKnowledgeController,
    CreativeStoreTargetController,
    CreativeStorePublishingController,
    CreativeHandoffController,
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
    CreativeAiFrameService,
    CreativeAiDocumentService,
    CreativeAiContextService,
    CreativeAiAnalyzerService,
    ClaudeboxClientService,
    AiGatewayAdminClientService,
    CreativeAiPolicyService,
    CreativeKnowledgeService,
    CreativePromptContextService,
    CreativePromptTemplateService,
    CreativeMediaFetchService,
    CreativeStoreTargetService,
    CreativeEnrollmentReviewService,
    CreativeSourceMediaService,
    // The integrations module imports this one, so its encryption helper is
    // provided here directly rather than by importing the module back.
    EncryptionService,
    CreativeMetaCredentialsService,
    CreativeStorePublishingService,
    CreativeMetaDraftService,
    CreativeHandoffService,
    ...(isCreativeAiEnabled() && resolveProcessRole() !== 'api'
      ? [CreativeAiProcessor, CreativeAiMaintenanceService]
      : []),
    // Drafting does not need the AI flag: it only needs a worker to run in.
    ...(resolveProcessRole() !== 'api'
      ? [CreativeMetaDraftProcessor, CreativeMediaMaintenanceService]
      : []),
  ],
  exports: [CreativeMetaLinkService, CreativeEnrollmentReviewService],
})
export class CreativeAgentModule {}
