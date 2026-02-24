import { Module, OnModuleInit } from '@nestjs/common';
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

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationController, PancakeWebhookController],
  providers: [
    IntegrationService,
    EncryptionService,
    MetaInsightService,
    PosOrderService,
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
