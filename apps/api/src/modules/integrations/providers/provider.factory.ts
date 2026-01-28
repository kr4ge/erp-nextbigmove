import { Injectable, BadRequestException } from '@nestjs/common';
import { IntegrationProvider } from '../dto/create-integration.dto';
import { IIntegrationProvider } from '../interfaces/integration-provider.interface';
import { ProviderRegistry } from './provider.registry';

/**
 * Factory service for creating integration provider instances
 */
@Injectable()
export class ProviderFactory {
  constructor(private readonly providerRegistry: ProviderRegistry) {}

  /**
   * Create a provider instance based on the provider type
   */
  createProvider(
    providerType: IntegrationProvider,
    credentials: Record<string, any>,
    config: Record<string, any> = {},
  ): IIntegrationProvider {
    const ProviderClass = this.providerRegistry.getProvider(providerType);

    if (!ProviderClass) {
      throw new BadRequestException(`Unsupported integration provider: ${providerType}`);
    }

    return new ProviderClass(credentials, config);
  }

  /**
   * Get list of all supported provider types
   */
  getSupportedProviders(): IntegrationProvider[] {
    return this.providerRegistry.getSupportedProviders();
  }
}
