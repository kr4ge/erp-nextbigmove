/**
 * Connection test result interface
 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}

/**
 * Config validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Config schema field definition
 */
export interface ConfigSchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  placeholder?: string;
  default?: any;
}

/**
 * Config schema definition
 */
export interface ConfigSchema {
  fields: ConfigSchemaField[];
}

/**
 * Base interface that all integration providers must implement
 */
export interface IIntegrationProvider {
  /**
   * Test the connection to the integration service
   */
  testConnection(): Promise<ConnectionTestResult>;

  /**
   * Validate the configuration object
   */
  validateConfig(config: any): ValidationResult;

  /**
   * Get the configuration schema for this provider
   */
  getConfigSchema(): ConfigSchema;

  /**
   * Get the provider type
   */
  getProviderType(): string;
}
