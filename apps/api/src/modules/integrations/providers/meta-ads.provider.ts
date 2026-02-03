import { BaseIntegrationProvider } from './base-provider.abstract';
import {
  ConnectionTestResult,
  ConfigSchema,
  ValidationResult,
} from '../interfaces/integration-provider.interface';
import { IntegrationProvider } from '../dto/create-integration.dto';

/**
 * META Ads integration provider
 * Handles META Marketing API integration
 */
export class MetaAdsProvider extends BaseIntegrationProvider {
  private readonly GRAPH_API_BASE = 'https://graph.facebook.com/v23.0';

  /**
   * Test connection to META Marketing API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Validate required credentials
      const credValidation = this.validateCredentials(['accessToken']);
      if (!credValidation.valid) {
        return this.createFailureResult(
          'Invalid credentials',
          { errors: credValidation.errors },
        );
      }

      const { accessToken } = this.credentials;

      // Test 1: Verify token is valid by calling /me endpoint
      const meResponse = await fetch(`${this.GRAPH_API_BASE}/me?access_token=${accessToken}`);

      if (!meResponse.ok) {
        const error = await meResponse.json();
        return this.createFailureResult(
          'Failed to verify access token',
          { error: error.error?.message || 'Invalid token' },
        );
      }

      const meData = await meResponse.json();

      // Test 2: If ad account ID is configured, verify access to it
      if (this.config.adAccountId) {
        const adAccountResponse = await fetch(
          `${this.GRAPH_API_BASE}/act_${this.config.adAccountId}?fields=id,name,account_status&access_token=${accessToken}`,
        );

        if (!adAccountResponse.ok) {
          const error = await adAccountResponse.json();
          return this.createFailureResult(
            'Cannot access configured ad account',
            {
              adAccountId: this.config.adAccountId,
              error: error.error?.message || 'Access denied',
            },
          );
        }

        const adAccountData = await adAccountResponse.json();

        return this.createSuccessResult(
          'Successfully connected to META Ads',
          {
            userId: meData.id,
            userName: meData.name,
            adAccountId: adAccountData.id,
            adAccountName: adAccountData.name,
            adAccountStatus: adAccountData.account_status,
          },
        );
      }

      // No ad account configured, just verify token works
      return this.createSuccessResult(
        'Successfully authenticated with META',
        {
          userId: meData.id,
          userName: meData.name,
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
   * Fetch all ad accounts assigned to this access token
   * Uses pagination to fetch all accounts (matches Laravel implementation)
   */
  async fetchAdAccounts(): Promise<any[]> {
    try {
      // Validate required credentials
      const credValidation = this.validateCredentials(['accessToken']);
      if (!credValidation.valid) {
        throw new Error('Invalid credentials: accessToken is required');
      }

      const { accessToken } = this.credentials;
      const url = `${this.GRAPH_API_BASE}/me/assigned_ad_accounts`;
      const accounts: any[] = [];
      let after: string | null = null;

      // Paginate through all ad accounts
      do {
        const params = new URLSearchParams({
          fields: 'account_id,name,currency,timezone_name,account_status',
          limit: '100',
          access_token: accessToken,
        });

        if (after) {
          params.append('after', after);
        }

        const response = await fetch(`${url}?${params.toString()}`);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(
            error.error?.message || `Failed to fetch ad accounts: ${response.statusText}`,
          );
        }

        const data = await response.json();

        if (data.data && Array.isArray(data.data)) {
          accounts.push(...data.data);
        }

        // Get pagination cursor for next page
        after = data.paging?.cursors?.after || null;
      } while (after);

      return accounts;
    } catch (error) {
      throw new Error(`Failed to fetch Meta ad accounts: ${error.message}`);
    }
  }

  /**
   * Fetch ad insights for a specific account and date
   * @param accountId - Meta account ID (without act_ prefix)
   * @param date - Date string in YYYY-MM-DD format
   * @returns Array of ad insights
   */
  async fetchAdInsights(accountId: string, date: string): Promise<any[]> {
    try {
      // Validate required credentials
      const credValidation = this.validateCredentials(['accessToken']);
      if (!credValidation.valid) {
        throw new Error('Invalid credentials: accessToken is required');
      }

      const { accessToken } = this.credentials;
      let nextUrl: string | null = `${this.GRAPH_API_BASE}/act_${accountId}/insights`;

      // Initial params (matching Laravel implementation)
      let nextParams: Record<string, string> = {
        level: 'ad',
        time_increment: '1',
        time_range: JSON.stringify({
          since: date,
          until: date,
        }),
        fields: 'account_id,campaign_id,adset_id,ad_id,ad_name,campaign_name,spend,inline_link_clicks,clicks,impressions,actions,date_start,date_stop,created_time',
        timezone: 'Asia/Manila',
        access_token: accessToken,
      };

      const insights: any[] = [];

      // Paginate through all ad insights using paging.next URL
      while (nextUrl) {
        const params = new URLSearchParams(nextParams);
        const response = await fetch(`${nextUrl}?${params.toString()}`);

        // Handle rate limiting (429)
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
          await new Promise(resolve => setTimeout(resolve, Math.max(retryAfter, 1) * 1000));
          continue;
        }

        if (!response.ok) {
          const error = await response.json();
          const errorMsg = error.error?.message || `Failed to fetch ad insights: ${response.statusText}`;
          throw new Error(
            `Meta ad fetch failed for account ${accountId} (status ${response.status}): ${errorMsg}`,
          );
        }

        const data = await response.json();

        if (data.data && Array.isArray(data.data)) {
          insights.push(...data.data);
        }

        // Get next page URL from paging.next
        const next = data.paging?.next;
        if (next) {
          const parsedUrl = new URL(next);
          nextUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;

          // Parse query params from next URL
          nextParams = {};
          parsedUrl.searchParams.forEach((value: string, key: string) => {
            nextParams[key] = value;
          });

          // Ensure access token is set
          nextParams.access_token = accessToken;
        } else {
          nextUrl = null;
        }
      }

      return insights;
    } catch (error) {
      throw new Error(`Failed to fetch Meta ad insights for account ${accountId} on ${date}: ${error.message}`);
    }
  }

  /**
   * Fetch ad statuses for multiple ads using Graph API "ids" lookup
   * @param adIds - Array of Meta ad IDs
   * @returns Map of adId -> status
   */
  async fetchAdStatuses(adIds: string[]): Promise<Record<string, string>> {
    try {
      if (adIds.length === 0) return {};

      const credValidation = this.validateCredentials(['accessToken']);
      if (!credValidation.valid) {
        throw new Error('Invalid credentials: accessToken is required');
      }

      const { accessToken } = this.credentials;
      const statusMap: Record<string, string> = {};

      // Batch process ad IDs (Meta API supports up to 50 ids per request)
      const batchSize = 50;
      for (let i = 0; i < adIds.length; i += batchSize) {
        const batch = adIds.slice(i, i + batchSize);
        const url = `${this.GRAPH_API_BASE}/`;

        const params = new URLSearchParams({
          ids: batch.join(','),
          fields: 'id,status',
          access_token: accessToken,
        });

        const response = await fetch(`${url}?${params.toString()}`);

        if (!response.ok) {
          // If batch fails, log warning but continue with other batches
          console.warn(`Failed to fetch ad statuses for batch: ${response.statusText}`);
          continue;
        }

        const data = await response.json();

        // Response format: { "ad_id_1": { "id": "...", "status": "..." }, "ad_id_2": {...} }
        for (const [adId, adData] of Object.entries(data)) {
          if (adData && typeof adData === 'object' && 'status' in adData) {
            statusMap[adId] = (adData as any).status;
          }
        }
      }

      return statusMap;
    } catch (error) {
      throw new Error(`Failed to fetch ad statuses: ${error.message}`);
    }
  }

  /**
   * Validate configuration for META Ads
   */
  validateConfig(config: any): ValidationResult {
    // Use base validation
    const baseValidation = super.validateConfig(config);

    if (!baseValidation.valid) {
      return baseValidation;
    }

    // No additional validation needed for Meta Ads config
    return {
      valid: true,
    };
  }

  /**
   * Get configuration schema for META Ads
   */
  getConfigSchema(): ConfigSchema {
    return {
      fields: [
        {
          name: 'apiVersion',
          type: 'string',
          required: false,
          description: 'META Graph API version',
          default: 'v18.0',
        },
      ],
    };
  }

  /**
   * Get provider type identifier
   */
  getProviderType(): string {
    return IntegrationProvider.META_ADS;
  }
}
