'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/form-select';
import { FormTextarea } from '@/components/ui/form-textarea';

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

export default function CreateIntegrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerParam = searchParams.get('provider') as IntegrationProvider | null;
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

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
          showToast('error', errorText || 'Invalid API key or access denied');
          setIsLoading(false);
          return;
        }

        const responseData = await shopsResponse.json();

        if (!responseData.success || !responseData.shops) {
          showToast('error', 'Invalid API response from Pancake POS');
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

          showToast('success', 'Integration created successfully');
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
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to create integration');
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
    } catch (err: any) {
      showToast('error', 'Failed to fetch ad accounts: ' + err.message);
      throw err;
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

      showToast('success', 'Integration created successfully');
      router.push('/integrations');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to create integration');
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
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`flex items-center w-full max-w-sm p-4 text-sm text-gray-700 bg-white border rounded-lg shadow ${
              toast.type === 'success' ? 'border-green-200' : 'border-red-200'
            }`}
            role="alert"
          >
            <div
              className={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg ${
                toast.type === 'success' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
              }`}
            >
              {toast.type === 'success' ? '✓' : '✕'}
            </div>
            <div className="ml-3 text-sm font-medium text-gray-900">{toast.message}</div>
            <button
              type="button"
              className="ml-auto text-gray-400 hover:text-gray-700"
              onClick={() => setToast(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <PageHeader
        title="Create Integration"
        description="Connect your Meta Ads or Pancake POS account"
      />

      {/* Error Display (kept for non-toast flows, but hidden if toast shown) */}
      {!toast && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Select Provider */}
      {step === 'select' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Meta Ads Card */}
          <button
            onClick={() => handleProviderSelect('META_ADS')}
            className="rounded-2xl border-2 border-[#E2E8F0] bg-white p-6 text-left shadow-sm transition-all hover:border-[#2563EB] hover:shadow-md"
          >
            <div className="mb-4 flex items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <h3 className="ml-4 text-xl font-semibold text-[#0F172A]">Meta Ads</h3>
            </div>
            <p className="mb-4 text-[#475569]">
              Connect your Meta Marketing API to sync ad campaign data
            </p>
            <ul className="space-y-1 text-sm text-[#94A3B8]">
              <li>• Campaign performance</li>
              <li>• Ad spend tracking</li>
              <li>• Conversion data</li>
            </ul>
          </button>

          {/* Pancake POS Card */}
          <button
            onClick={() => handleProviderSelect('PANCAKE_POS')}
            className="rounded-2xl border-2 border-[#E2E8F0] bg-white p-6 text-left shadow-sm transition-all hover:border-[#7C3AED] hover:shadow-md"
          >
            <div className="mb-4 flex items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-[#7C3AED]">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="ml-4 text-xl font-semibold text-[#0F172A]">Pancake POS</h3>
            </div>
            <p className="mb-4 text-[#475569]">
              Connect your Pancake POS to sync sales and product data
            </p>
            <ul className="space-y-1 text-sm text-[#94A3B8]">
              <li>• Product catalog</li>
              <li>• Sales transactions</li>
              <li>• Inventory data</li>
            </ul>
          </button>
        </div>
      )}

      {/* Step 2: Enter Credentials */}
      {step === 'credentials' && provider && (
        <Card>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#0F172A]">
              {provider === 'META_ADS' ? 'Meta Ads' : 'Pancake POS'} Credentials
            </h2>
            <p className="mt-1 text-sm text-[#475569]">
              Enter your API credentials to connect
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

            <div className="flex gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStep('select');
                  setProvider(null);
                  setError('');
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={!canTestConnection() || isLoading}
                loading={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Creating...' : 'Create Integration'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Step 3: Configure (Select Shop or Ad Account) */}
      {step === 'configure' && provider && (
        <Card>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#0F172A]">
              {provider === 'META_ADS' ? 'Select Ad Account' : 'Select Shop'}
            </h2>
            <p className="mt-1 text-sm text-[#475569]">
              {provider === 'META_ADS'
                ? 'Choose which ad account to sync data from'
                : 'Choose which shop to sync data from'}
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
                  // Auto-set the integration name to the shop name
                  if (shopId) {
                    const selectedShop = shops.find(s => s.id === shopId);
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

            <div className="flex gap-4">
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
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit() || isLoading}
                loading={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Creating...' : 'Create Integration'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
