import { Injectable } from '@nestjs/common';
import { IntegrationProvider } from '../dto/create-integration.dto';
import { BaseIntegrationProvider } from './base-provider.abstract';

/**
 * Type for provider constructor
 */
type ProviderConstructor = new (
  credentials: Record<string, any>,
  config: Record<string, any>,
) => BaseIntegrationProvider;

/**
 * Registry service for managing available integration providers
 */
@Injectable()
export class ProviderRegistry {
  private providers = new Map<IntegrationProvider, ProviderConstructor>();

  /**
   * Register a provider class
   */
  registerProvider(type: IntegrationProvider, providerClass: ProviderConstructor): void {
    this.providers.set(type, providerClass);
  }

  /**
   * Get a provider class by type
   */
  getProvider(type: IntegrationProvider): ProviderConstructor | undefined {
    return this.providers.get(type);
  }

  /**
   * Get all supported provider types
   */
  getSupportedProviders(): IntegrationProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider type is supported
   */
  isProviderSupported(type: IntegrationProvider): boolean {
    return this.providers.has(type);
  }
}
