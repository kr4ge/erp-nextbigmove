import { BaseIntegrationProvider } from './base-provider.abstract';
import {
  ConnectionTestResult,
  ConfigSchema,
  ValidationResult,
} from '../interfaces/integration-provider.interface';
import { IntegrationProvider } from '../dto/create-integration.dto';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Pancake POS integration provider
 * Handles Pancake POS API integration
 */
export class PancakePosProvider extends BaseIntegrationProvider {
  private readonly API_BASE = 'https://pos.pages.fm/api/v1';
  private readonly RETRY_BACKOFF_MS = [2000, 5000, 10000];

  private async fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
    let attempt = 0;
    let lastError: any;

    while (true) {
      try {
        const response = await fetch(url, options);

        if (response.ok) {
          return response;
        }

        const status = response.status;
        const retryable = status === 429 || status >= 500;

        if (!retryable || attempt >= this.RETRY_BACKOFF_MS.length) {
          return response;
        }

        const delayMs = this.RETRY_BACKOFF_MS[attempt];
        await new Promise(resolve => setTimeout(resolve, delayMs));
        attempt += 1;
      } catch (error) {
        lastError = error;
        if (attempt >= this.RETRY_BACKOFF_MS.length) {
          throw lastError;
        }
        const delayMs = this.RETRY_BACKOFF_MS[attempt];
        await new Promise(resolve => setTimeout(resolve, delayMs));
        attempt += 1;
      }
    }
  }

  /**
   * Test connection to Pancake POS API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Validate required credentials
      const credValidation = this.validateCredentials(['apiKey']);
      if (!credValidation.valid) {
        return this.createFailureResult(
          'Invalid credentials',
          { errors: credValidation.errors },
        );
      }

      const { apiKey } = this.credentials;

      // Test: Fetch shops list to verify API key
      const shopsResponse = await fetch(
        `${this.API_BASE}/shops?api_key=${apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!shopsResponse.ok) {
        const errorText = await shopsResponse.text();
        return this.createFailureResult(
          'Failed to verify API key',
          {
            status: shopsResponse.status,
            error: errorText || 'Invalid API key or access denied',
          },
        );
      }

      const responseData = await shopsResponse.json();

      // Check if response is successful
      if (!responseData.success || !responseData.shops) {
        return this.createFailureResult(
          'Invalid API response',
          {
            response: responseData,
          },
        );
      }

      const shops = responseData.shops;

      // If shop ID is configured, verify it exists in the list
      if (this.config.shopId) {
        const selectedShop = shops.find(
          (shop: any) => shop.id === parseInt(this.config.shopId),
        );

        if (!selectedShop) {
          return this.createFailureResult(
            'Configured shop not found or access denied',
            {
              shopId: this.config.shopId,
              availableShops: shops.map((shop: any) => ({
                id: shop.id,
                name: shop.name,
              })),
            },
          );
        }

        return this.createSuccessResult(
          'Successfully connected to Pancake POS',
          {
            shopId: selectedShop.id,
            shopName: selectedShop.name,
            shopAvatarUrl: selectedShop.avatar_url,
            totalShops: shops.length,
          },
        );
      }

      // No shop configured, return list of accessible shops
      return this.createSuccessResult(
        'Successfully authenticated with Pancake POS',
        {
          totalShops: shops.length,
          shops: shops.map((shop: any) => ({
            id: shop.id,
            name: shop.name,
            avatarUrl: shop.avatar_url,
            pages: shop.pages?.length || 0,
          })),
        },
      );
    } catch (error) {
      return this.createFailureResult(
        'Connection test failed',
        {
          error: error.message,
          type: error.name,
        },
      );
    }
  }

  /**
   * Fetch orders for a specific shop and date
   * @param shopId - Pancake POS shop ID
   * @param date - Date string in YYYY-MM-DD format
   * @returns Array of orders
   */
  async fetchOrders(shopId: string, date: string): Promise<any[]> {
    try {
      // Validate required credentials
      const credValidation = this.validateCredentials(['apiKey']);
      if (!credValidation.valid) {
        throw new Error('Invalid credentials: apiKey is required');
      }

      const { apiKey } = this.credentials;
      const url = `${this.API_BASE}/shops/${shopId}/orders`;

      // Match Laravel logic: use Manila-local day window converted to UTC epoch seconds
      const start = dayjs.tz(date, 'Asia/Manila').startOf('day').utc().unix();
      const end = dayjs.tz(date, 'Asia/Manila').endOf('day').utc().unix();

      const orders: any[] = [];
      let currentPage = 1;
      let totalPages = 1;

      // Paginate through all orders for the date window
      do {
        const params = new URLSearchParams({
          api_key: apiKey,
          updateStatus: 'inserted_at',
          startDateTime: start.toString(),
          endDateTime: end.toString(),
          page_number: currentPage.toString(),
        });

        const response = await this.fetchWithRetry(`${url}?${params.toString()}`);

        if (!response.ok) {
          const error = await response.text();
          const err = new Error(
            error || `Failed to fetch orders: ${response.statusText}`,
          );
          (err as any).status = response.status;
          throw err;
        }

        const data = await response.json();

        const pageOrders = Array.isArray(data.orders)
          ? data.orders
          : Array.isArray(data.data)
            ? data.data
            : [];

        if (pageOrders.length > 0) {
          orders.push(...pageOrders);
        }

        // Update pagination info
        const pageNum = data.page_number ? parseInt(data.page_number, 10) : currentPage;
        totalPages = data.total_pages ? parseInt(data.total_pages, 10) : totalPages;
        currentPage = pageNum + 1;
      } while (currentPage <= totalPages);

      return orders;
    } catch (error) {
      throw new Error(`Failed to fetch POS orders for shop ${shopId} on ${date}: ${error.message}`);
    }
  }

  /**
   * Validate configuration for Pancake POS
   */
  validateConfig(config: any): ValidationResult {
    // Use base validation
    const baseValidation = super.validateConfig(config);

    if (!baseValidation.valid) {
      return baseValidation;
    }

    const errors: string[] = [];

    // Validate shop ID format if provided
    if (config.shopId && typeof config.shopId !== 'string') {
      errors.push('shopId must be a string');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get configuration schema for Pancake POS
   */
  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          name: 'shopId',
          type: 'string',
          required: true,
          description: 'Pancake POS Shop ID',
          placeholder: 'shop_abc123',
        },
        {
          name: 'webhookSecret',
          type: 'string',
          required: false,
          description: 'Webhook secret for validating webhook requests',
        },
      ],
    };
  }

  /**
   * Get provider type identifier
   */
  getProviderType(): string {
    return IntegrationProvider.PANCAKE_POS;
  }
}
