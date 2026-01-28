'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import type { Integration } from '../types';
import { formatIntegrationDate, getProviderName, getStatusBadgeClasses } from '../utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionCard } from '@/components/ui/section-card';
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/form-select';
import { FormTextarea } from '@/components/ui/form-textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { ArrowLeft } from 'lucide-react';

interface Shop {
  id: string;
  name: string;
  status?: string;
}

interface AdAccount {
  id: string;
  name: string;
  account_status?: number;
}

export default function IntegrationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const integrationId = params.id as string;

  const [integration, setIntegration] = useState<Integration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [selectedAdAccountId, setSelectedAdAccountId] = useState('');

  const [shops, setShops] = useState<Shop[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [showCredentials, setShowCredentials] = useState(false);

  useEffect(() => {
    fetchIntegration();
  }, [integrationId]);

  const fetchIntegration = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await apiClient.get(`/integrations/${integrationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.data;
      setIntegration(data);
      setName(data.name);
      setDescription(data.description || '');
      setSelectedShopId(data.config?.shopId || '');
      setSelectedAdAccountId(data.config?.adAccountId || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load integration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');

      const response = await apiClient.post(
        `/integrations/${integrationId}/test-connection`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setSuccessMessage('Connection test successful!');
        await fetchIntegration(); // Refresh to get updated status
      } else {
        setError('Connection test failed: ' + response.data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to test connection');
    } finally {
      setIsTesting(false);
    }
  };

  const fetchShopsOrAccounts = async () => {
    if (!integration) return;

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');

      if (integration.provider === 'PANCAKE_POS' && apiKey) {
        // Test connection with new API key to get shops
        const tempResponse = await apiClient.post('/integrations', {
          name: 'temp-test',
          provider: 'PANCAKE_POS',
          credentials: { apiKey },
          config: {},
        }, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const testResponse = await apiClient.post(
          `/integrations/${tempResponse.data.id}/test-connection`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (testResponse.data.success && testResponse.data.details?.shops) {
          setShops(testResponse.data.details.shops);
        }

        // Delete temp integration
        await apiClient.delete(`/integrations/${tempResponse.data.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

      } else if (integration.provider === 'META_ADS' && accessToken) {
        // Fetch ad accounts using Meta Graph API
        const response = await fetch(
          `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
        );

        const data = await response.json();

        if (data.data) {
          setAdAccounts(data.data);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch options');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');

      const updateData: any = {
        name,
        description,
      };

      // Only include credentials if they were changed
      if (integration?.provider === 'PANCAKE_POS' && apiKey) {
        updateData.credentials = { apiKey };
      } else if (integration?.provider === 'META_ADS' && accessToken) {
        updateData.credentials = { accessToken };
      }

      // Update config if shop or ad account was changed
      if (integration?.provider === 'PANCAKE_POS' && selectedShopId) {
        updateData.config = { shopId: selectedShopId };
      } else if (integration?.provider === 'META_ADS' && selectedAdAccountId) {
        updateData.config = { adAccountId: selectedAdAccountId };
      }

      await apiClient.patch(`/integrations/${integrationId}`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSuccessMessage('Integration updated successfully!');
      setShowCredentials(false);
      setApiKey('');
      setAccessToken('');
      await fetchIntegration();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update integration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!integration) return;

    try {
      const token = localStorage.getItem('access_token');
      const endpoint = integration.enabled ? 'disable' : 'enable';

      await apiClient.post(`/integrations/${integrationId}/${endpoint}`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSuccessMessage(`Integration ${integration.enabled ? 'disabled' : 'enabled'} successfully!`);
      await fetchIntegration();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle integration');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this integration? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');

      await apiClient.delete(`/integrations/${integrationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      router.push('/integrations');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete integration');
    }
  };

  if (isLoading) {
    return (
      <Card className="py-12 text-center text-[#475569]">
        Loading integration...
      </Card>
    );
  }

  if (!integration) {
    return (
      <div className="space-y-6">
        <Card className="py-12 text-center">
          <p className="text-[#475569]">Integration not found</p>
          <Link href="/integrations" className="mt-4 inline-block text-[#2563EB] hover:underline">
            Back to Integrations
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/integrations"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <PageHeader
            title={integration.name}
            description={`${getProviderName(integration.provider)} Integration`}
          />
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={integration.status as any} />
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              integration.enabled
                ? 'bg-[#ECFDF3] text-[#10B981]'
                : 'bg-[#F1F5F9] text-[#64748B]'
            }`}
          >
            {integration.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">
          {successMessage}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleUpdate} className="space-y-6">
        {/* Basic Information */}
        <SectionCard title="Basic Information">
          <div className="space-y-4">
            <FormInput
              label="Integration Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <FormTextarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </SectionCard>

        {/* Configuration */}
        <SectionCard title="Configuration">
          <div className="space-y-4">
            {integration.provider === 'PANCAKE_POS' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A]">
                    Current Shop
                  </label>
                  <p className="mt-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 font-mono text-sm text-[#0F172A]">
                    {integration.config?.shopId || 'Not configured'}
                  </p>
                </div>

                {showCredentials && (
                  <>
                    <FormInput
                      type="password"
                      label="API Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter new API key to update"
                    />
                    <button
                      type="button"
                      onClick={fetchShopsOrAccounts}
                      disabled={!apiKey}
                      className="text-sm text-[#2563EB] hover:underline disabled:text-[#94A3B8]"
                    >
                      Fetch available shops
                    </button>

                    {shops.length > 0 && (
                      <FormSelect
                        label="Select Shop"
                        value={selectedShopId}
                        onChange={(e) => setSelectedShopId(e.target.value)}
                        options={shops.map((shop) => ({
                          value: shop.id,
                          label: `${shop.name}${shop.status ? ` (${shop.status})` : ''}`,
                        }))}
                        placeholder="Select a shop"
                      />
                    )}
                  </>
                )}
              </>
            )}

            {integration.provider === 'META_ADS' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A]">
                    Current Ad Account ID
                  </label>
                  <p className="mt-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 font-mono text-sm text-[#0F172A]">
                    {integration.config?.adAccountId || 'Not configured'}
                  </p>
                </div>

                {showCredentials && (
                  <>
                    <FormInput
                      type="password"
                      label="Access Token"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="Enter new access token to update"
                    />
                    <button
                      type="button"
                      onClick={fetchShopsOrAccounts}
                      disabled={!accessToken}
                      className="text-sm text-[#2563EB] hover:underline disabled:text-[#94A3B8]"
                    >
                      Fetch available ad accounts
                    </button>

                    {adAccounts.length > 0 && (
                      <FormSelect
                        label="Select Ad Account"
                        value={selectedAdAccountId}
                        onChange={(e) => setSelectedAdAccountId(e.target.value)}
                        options={adAccounts.map((account) => ({
                          value: account.id,
                          label: `${account.name} (${account.id})`,
                        }))}
                        placeholder="Select an ad account"
                      />
                    )}
                  </>
                )}
              </>
            )}

            {!showCredentials && (
              <button
                type="button"
                onClick={() => setShowCredentials(true)}
                className="text-sm text-[#2563EB] hover:underline"
              >
                Update credentials
              </button>
            )}
          </div>
        </SectionCard>

        {/* Metadata */}
        <SectionCard title="Metadata">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-[#475569]">Created</dt>
              <dd className="mt-1 text-sm text-[#0F172A]">{formatIntegrationDate(integration.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-[#475569]">Last Updated</dt>
              <dd className="mt-1 text-sm text-[#0F172A]">{formatIntegrationDate(integration.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-[#475569]">Last Sync</dt>
              <dd className="mt-1 text-sm text-[#0F172A]">
                {integration.lastSyncAt ? formatIntegrationDate(integration.lastSyncAt) : 'Never'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-[#475569]">Provider</dt>
              <dd className="mt-1 text-sm text-[#0F172A]">
                {getProviderName(integration.provider)}
              </dd>
            </div>
          </dl>
        </SectionCard>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="submit"
            disabled={isSaving}
            loading={isSaving}
            className="flex-1"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleTestConnection}
            disabled={isTesting}
            loading={isTesting}
            className="flex-1"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>

          <Button
            type="button"
            variant={integration.enabled ? 'secondary' : 'secondary'}
            onClick={handleToggleEnabled}
            className="flex-1"
          >
            {integration.enabled ? 'Disable' : 'Enable'}
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </form>
    </div>
  );
}
