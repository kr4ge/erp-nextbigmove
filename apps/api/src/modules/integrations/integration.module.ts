import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { IntegrationController } from './integration.controller';
import { PancakeWebhookController } from './pancake-webhook.controller';
import { IntegrationService } from './integration.service';
import { EncryptionService } from './services/encryption.service';
import { MetaInsightService } from './services/meta-insight.service';
import { PosOrderService } from './services/pos-order.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ProviderFactory } from './providers/provider.factory';
import { ProviderRegistry } from './providers/provider.registry';
import { MetaAdsProvider } from './providers/meta-ads.provider';
import { PancakePosProvider } from './providers/pancake-pos.provider';
import { IntegrationProvider } from './dto/create-integration.dto';
import { PANCAKE_WEBHOOK_QUEUE } from './pancake-webhook.constants';
import { PancakeWebhookQueueProcessor } from './processors/pancake-webhook.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: PANCAKE_WEBHOOK_QUEUE,
    }),
  ],
  controllers: [IntegrationController, PancakeWebhookController],
  providers: [
    IntegrationService,
    EncryptionService,
    MetaInsightService,
    PosOrderService,
    PancakeWebhookQueueProcessor,
    ProviderRegistry,
    ProviderFactory,
  ],
  exports: [IntegrationService, EncryptionService, ProviderFactory, MetaInsightService, PosOrderService],
})
export class IntegrationModule implements OnModuleInit {
  constructor(private readonly providerRegistry: ProviderRegistry) {}

  /**
   * Register all available integration providers when module initializes
   */
  onModuleInit() {
    this.providerRegistry.registerProvider(
      IntegrationProvider.META_ADS,
      MetaAdsProvider,
    );
    this.providerRegistry.registerProvider(
      IntegrationProvider.PANCAKE_POS,
      PancakePosProvider,
    );
  }
}
