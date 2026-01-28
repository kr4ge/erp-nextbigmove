import {
  IIntegrationProvider,
  ConnectionTestResult,
  ValidationResult,
  ConfigSchema,
} from '../interfaces/integration-provider.interface';

/**
 * Abstract base class for all integration providers
 * Provides common functionality that can be shared across providers
 */
export abstract class BaseIntegrationProvider implements IIntegrationProvider {
  protected credentials: Record<string, any>;
  protected config: Record<string, any>;

  constructor(credentials: Record<string, any>, config: Record<string, any> = {}) {
    this.credentials = credentials;
    this.config = config;
  }

  /**
   * Test connection to the integration service
   * Must be implemented by concrete provider classes
   */
  abstract testConnection(): Promise<ConnectionTestResult>;

  /**
   * Get the provider type identifier
   * Must be implemented by concrete provider classes
   */
  abstract getProviderType(): string;

  /**
   * Get the configuration schema
   * Must be implemented by concrete provider classes
   */
  abstract getConfigSchema(): ConfigSchema;

  /**
   * Validate configuration object against schema
   * Default implementation that can be overridden
   */
  validateConfig(config: any): ValidationResult {
    const schema = this.getConfigSchema();
    const errors: string[] = [];

    for (const field of schema.fields) {
      if (field.required && !config[field.name]) {
        errors.push(`${field.name} is required`);
      }

      if (config[field.name] && typeof config[field.name] !== field.type) {
        errors.push(`${field.name} must be of type ${field.type}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Helper method to validate credentials
   * Can be used by concrete providers
   */
  protected validateCredentials(requiredFields: string[]): ValidationResult {
    const errors: string[] = [];

    for (const field of requiredFields) {
      if (!this.credentials[field]) {
        errors.push(`Credential field '${field}' is required`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Helper method to create success result
   */
  protected createSuccessResult(message: string, details?: Record<string, any>): ConnectionTestResult {
    return {
      success: true,
      message,
      details,
    };
  }

  /**
   * Helper method to create failure result
   */
  protected createFailureResult(message: string, details?: Record<string, any>): ConnectionTestResult {
    return {
      success: false,
      message,
      details,
    };
  }
}
