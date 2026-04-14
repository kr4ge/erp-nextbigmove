'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/feedback';
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/form-select';
import { FormTextarea } from '@/components/ui/form-textarea';
import { useToast } from '@/components/ui/toast';

type IntegrationProvider = 'META_ADS' | 'PANCAKE_POS';

interface Shop {
  id: string;
  name: string;
  status?: string;
  avatar_url?: string;
}

interface AdAccount {
  id: string;
  name: string;
  account_status?: number;
}

const parseCreateIntegrationError = (error: unknown, fallback: string) => {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};

function ProviderGlyph({
  provider,
  className = 'h-4 w-4',
}: {
  provider: IntegrationProvider;
  className?: string;
}) {
  if (provider === 'META_ADS') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

export default function CreateIntegrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerParam = searchParams.get('provider') as IntegrationProvider | null;
  const { addToast } = useToast();

  const [step, setStep] = useState<'select' | 'credentials' | 'configure'>('select');
  const [provider, setProvider] = useState<IntegrationProvider | null>(providerParam);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Pancake POS fields
  const [apiKey, setApiKey] = useState('');
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState('');

  // Meta Ads fields
  const [accessToken, setAccessToken] = useState('');
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (providerParam) {
      setStep('credentials');
      if (providerParam === 'META_ADS') {
        setName('Meta Ads Integration');
      } else if (providerParam === 'PANCAKE_POS') {
        setName('Pancake POS Integration');
      }
    }
  }, [providerParam]);

  const handleProviderSelect = (selectedProvider: IntegrationProvider) => {
    setProvider(selectedProvider);
    setStep('credentials');
    setError('');

    if (selectedProvider === 'META_ADS') {
      setName('Meta Ads Integration');
    } else {
      setName('Pancake POS Integration');
    }
  };

  const handleCreateIntegration = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');

      // For Pancake POS, fetch shops first
      if (provider === 'PANCAKE_POS') {
        // Fetch shops directly using the API
        const shopsResponse = await fetch(
          `https://pos.pages.fm/api/v1/shops?api_key=${apiKey}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!shopsResponse.ok) {
          const errorText = await shopsResponse.text();
          const message = errorText || 'Invalid API key or access denied';
          setError(message);
          addToast('error', message);
          setIsLoading(false);
          return;
        }

        const responseData = await shopsResponse.json();

        if (!responseData.success || !responseData.shops) {
          const message = 'Invalid API response from Pancake POS';
          setError(message);
          addToast('error', message);
          setIsLoading(false);
          return;
        }

        const fetchedShops = responseData.shops;

        // If only one shop, create integration automatically
        if (fetchedShops.length === 1) {
          const shop = fetchedShops[0];
          const credentials = { apiKey };
          const config = {
            shopId: shop.id.toString(),
            shopName: shop.name,
            shopAvatarUrl: shop.avatar_url,
          };

          await apiClient.post('/integrations', {
            name: shop.name,
            description,
            provider,
            credentials,
            config,
          }, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          addToast('success', 'Integration created successfully');
          router.push('/integrations');
        } else {
          // Multiple shops, show dropdown
          setShops(fetchedShops);
          setStep('configure');
        }
      } else if (provider === 'META_ADS') {
        // For Meta Ads, fetch ad accounts first
        await fetchAdAccounts(accessToken);
        setStep('configure');
      }
    } catch (error: unknown) {
      const message = parseCreateIntegrationError(error, 'Failed to create integration');
      setError(message);
      addToast('error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdAccounts = async (token: string) => {
    try {
      // Fetch ad accounts using Meta Graph API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status&access_token=${token}`
      );

      const data = await response.json();

      if (data.data) {
        setAdAccounts(data.data);
      } else {
        throw new Error('Failed to fetch ad accounts');
      }
    } catch (error: unknown) {
      const message = parseCreateIntegrationError(error, 'Failed to fetch ad accounts');
      setError(message);
      addToast('error', message);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');

      const credentials = provider === 'META_ADS'
        ? { accessToken }
        : { apiKey };

      const selectedShop = shops.find(
        (shop) => shop.id.toString() === selectedShopId.toString(),
      );

      const config = provider === 'META_ADS'
        ? { adAccountId: selectedAdAccountId.replace('act_', '') }
        : {
            shopId: selectedShopId,
            shopName: selectedShop?.name,
            shopAvatarUrl: selectedShop?.avatar_url,
          };

      await apiClient.post('/integrations', {
        name,
        description,
        provider,
        credentials,
        config,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      addToast('success', 'Integration created successfully');
      router.push('/integrations');
    } catch (error: unknown) {
      const message = parseCreateIntegrationError(error, 'Failed to create integration');
      setError(message);
      addToast('error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const canTestConnection = () => {
    if (provider === 'META_ADS') {
      return accessToken.trim().length > 0;
    } else if (provider === 'PANCAKE_POS') {
      return apiKey.trim().length > 0;
    }
    return false;
  };

  const canSubmit = () => {
    if (provider === 'META_ADS') {
      return accessToken.trim().length > 0 && selectedAdAccountId.length > 0;
    } else if (provider === 'PANCAKE_POS') {
      return apiKey.trim().length > 0 && selectedShopId.length > 0 && name.trim().length > 0;
    }

    return false;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-600">
            Integrations
          </span>
        }
        title="Create Integration"
        description="Connect your Meta Ads or Pancake POS account"
      />

      {error && <AlertBanner tone="error" message={error} />}

      {/* Step 1: Select Provider */}
      {step === 'select' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Meta Ads Card */}
          <button
            onClick={() => handleProviderSelect('META_ADS')}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-orange-200 hover:bg-orange-50/30"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
              <ProviderGlyph provider="META_ADS" className="h-3.5 w-3.5 text-orange-500" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">Meta Ads</h3>
            </div>
            <div className="space-y-3 px-5 py-5">
              <p className="text-[0.82rem] text-slate-600">
                Connect your Meta Marketing API to sync ad campaign data.
              </p>
              <ul className="space-y-1 text-[0.82rem] text-slate-500">
                <li>- Campaign performance</li>
                <li>- Ad spend tracking</li>
                <li>- Conversion data</li>
              </ul>
            </div>
          </button>

          {/* Pancake POS Card */}
          <button
            onClick={() => handleProviderSelect('PANCAKE_POS')}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-orange-200 hover:bg-orange-50/30"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
              <ProviderGlyph provider="PANCAKE_POS" className="h-3.5 w-3.5 text-orange-500" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">Pancake POS</h3>
            </div>
            <div className="space-y-3 px-5 py-5">
              <p className="text-[0.82rem] text-slate-600">
                Connect your Pancake POS to sync sales and product data.
              </p>
              <ul className="space-y-1 text-[0.82rem] text-slate-500">
                <li>- Product catalog</li>
                <li>- Sales transactions</li>
                <li>- Inventory data</li>
              </ul>
            </div>
          </button>
        </div>
      )}
      {/* Step 2: Enter Credentials */}
      {step === 'credentials' && provider && (
        <section className="overflow-visible rounded-xl border border-orange-100 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/25 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
            <ProviderGlyph provider={provider} className="h-3.5 w-3.5 text-orange-500" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">Credentials</h2>
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-5">
              <p className="text-[0.82rem] font-semibold text-slate-900">
                {provider === 'META_ADS' ? 'Meta Ads' : 'Pancake POS'} Credentials
              </p>
              <p className="mt-1 text-[0.82rem] text-slate-500">
                Enter your API credentials to connect.
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCreateIntegration(); }} className="space-y-6">
              {provider === 'META_ADS' ? (
                <FormInput
                  type="password"
                  label="Access Token"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Enter your Meta access token"
                  helper="Get your access token from the Meta Developer Portal"
                  required
                />
              ) : (
                <FormInput
                  type="password"
                  label="API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Pancake POS API key"
                  helper="Get your API key from your Pancake POS settings"
                  required
                />
              )}

              <FormTextarea
                label="Description (Optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description of this integration"
              />

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setStep('select');
                    setProvider(null);
                    setError('');
                  }}
                  className="flex-1 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={!canTestConnection() || isLoading}
                  loading={isLoading}
                  className="flex-1 !border !border-orange-200 !bg-orange-50 !text-orange-700 hover:!bg-orange-100 hover:!text-orange-800 focus-visible:!ring-orange-200"
                >
                  {isLoading ? 'Creating...' : 'Create Integration'}
                </Button>
              </div>
            </form>
          </div>
        </section>
      )}
      {/* Step 3: Configure (Select Shop or Ad Account) */}
      {step === 'configure' && provider && (
        <section className="overflow-visible rounded-xl border border-orange-100 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/25 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
            <ProviderGlyph provider={provider} className="h-3.5 w-3.5 text-orange-500" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">Configuration</h2>
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-5">
              <p className="text-[0.82rem] font-semibold text-slate-900">
                {provider === 'META_ADS' ? 'Select Ad Account' : 'Select Shop'}
              </p>
              <p className="mt-1 text-[0.82rem] text-slate-500">
                {provider === 'META_ADS'
                  ? 'Choose which ad account to sync data from.'
                  : 'Choose which shop to sync data from.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {provider === 'PANCAKE_POS' && shops.length > 0 && (
                <FormSelect
                  label="Shop"
                  value={selectedShopId}
                  onChange={(e) => {
                    const shopId = e.target.value;
                    setSelectedShopId(shopId);
                    if (shopId) {
                      const selectedShop = shops.find((s) => s.id === shopId);
                      if (selectedShop) {
                        setName(selectedShop.name);
                      }
                    }
                  }}
                  options={shops.map((shop) => ({
                    value: shop.id,
                    label: `${shop.name}${shop.status ? ` (${shop.status})` : ''}`,
                  }))}
                  placeholder="Select a shop"
                  helper="Products will be synced from this shop"
                  required
                />
              )}

              {provider === 'META_ADS' && adAccounts.length > 0 && (
                <FormSelect
                  label="Ad Account"
                  value={selectedAdAccountId}
                  onChange={(e) => setSelectedAdAccountId(e.target.value)}
                  options={adAccounts.map((account) => ({
                    value: account.id,
                    label: `${account.name} (${account.id})`,
                  }))}
                  placeholder="Select an ad account"
                  helper="Campaign data will be synced from this ad account"
                  required
                />
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setStep('credentials');
                    setShops([]);
                    setAdAccounts([]);
                    setSelectedShopId('');
                    setSelectedAdAccountId('');
                  }}
                  className="flex-1 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit() || isLoading}
                  loading={isLoading}
                  className="flex-1 !border !border-orange-200 !bg-orange-50 !text-orange-700 hover:!bg-orange-100 hover:!text-orange-800 focus-visible:!ring-orange-200"
                >
                  {isLoading ? 'Creating...' : 'Create Integration'}
                </Button>
              </div>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}

