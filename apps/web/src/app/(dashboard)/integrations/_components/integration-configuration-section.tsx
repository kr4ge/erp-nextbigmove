'use client';

import { SectionCard } from '@/components/ui/section-card';
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/form-select';
import type { Integration } from '../types';
import type { AdAccountOption, ShopOption } from '../_types/integration-detail';

interface IntegrationConfigurationSectionProps {
  integration: Integration;
  showCredentials: boolean;
  apiKey: string;
  accessToken: string;
  selectedShopId: string;
  selectedAdAccountId: string;
  shops: ShopOption[];
  adAccounts: AdAccountOption[];
  onApiKeyChange: (value: string) => void;
  onAccessTokenChange: (value: string) => void;
  onSelectedShopIdChange: (value: string) => void;
  onSelectedAdAccountIdChange: (value: string) => void;
  onFetchOptions: () => void;
  onShowCredentials: () => void;
}

export function IntegrationConfigurationSection({
  integration,
  showCredentials,
  apiKey,
  accessToken,
  selectedShopId,
  selectedAdAccountId,
  shops,
  adAccounts,
  onApiKeyChange,
  onAccessTokenChange,
  onSelectedShopIdChange,
  onSelectedAdAccountIdChange,
  onFetchOptions,
  onShowCredentials,
}: IntegrationConfigurationSectionProps) {
  return (
    <SectionCard title="Configuration">
      <div className="space-y-4">
        {integration.provider === 'PANCAKE_POS' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A]">Current Shop</label>
              <p className="mt-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 font-mono text-sm text-[#0F172A]">
                {integration.config?.shopId || 'Not configured'}
              </p>
            </div>

            {showCredentials ? (
              <>
                <FormInput
                  type="password"
                  label="API Key"
                  value={apiKey}
                  onChange={(event) => onApiKeyChange(event.target.value)}
                  placeholder="Enter new API key to update"
                />
                <button
                  type="button"
                  onClick={onFetchOptions}
                  disabled={!apiKey}
                  className="text-sm text-[#2563EB] hover:underline disabled:text-[#94A3B8]"
                >
                  Fetch available shops
                </button>

                {shops.length > 0 ? (
                  <FormSelect
                    label="Select Shop"
                    value={selectedShopId}
                    onChange={(event) => onSelectedShopIdChange(event.target.value)}
                    options={shops.map((shop) => ({
                      value: shop.id,
                      label: `${shop.name}${shop.status ? ` (${shop.status})` : ''}`,
                    }))}
                    placeholder="Select a shop"
                  />
                ) : null}
              </>
            ) : null}
          </>
        )}

        {integration.provider === 'META_ADS' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A]">Current Ad Account ID</label>
              <p className="mt-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 font-mono text-sm text-[#0F172A]">
                {integration.config?.adAccountId || 'Not configured'}
              </p>
            </div>

            {showCredentials ? (
              <>
                <FormInput
                  type="password"
                  label="Access Token"
                  value={accessToken}
                  onChange={(event) => onAccessTokenChange(event.target.value)}
                  placeholder="Enter new access token to update"
                />
                <button
                  type="button"
                  onClick={onFetchOptions}
                  disabled={!accessToken}
                  className="text-sm text-[#2563EB] hover:underline disabled:text-[#94A3B8]"
                >
                  Fetch available ad accounts
                </button>

                {adAccounts.length > 0 ? (
                  <FormSelect
                    label="Select Ad Account"
                    value={selectedAdAccountId}
                    onChange={(event) => onSelectedAdAccountIdChange(event.target.value)}
                    options={adAccounts.map((account) => ({
                      value: account.id,
                      label: `${account.name} (${account.id})`,
                    }))}
                    placeholder="Select an ad account"
                  />
                ) : null}
              </>
            ) : null}
          </>
        )}

        {!showCredentials ? (
          <button
            type="button"
            onClick={onShowCredentials}
            className="text-sm text-[#2563EB] hover:underline"
          >
            Update credentials
          </button>
        ) : null}
      </div>
    </SectionCard>
  );
}
