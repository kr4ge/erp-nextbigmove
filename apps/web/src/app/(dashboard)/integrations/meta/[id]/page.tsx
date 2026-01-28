'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import dynamic from 'next/dynamic';
const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

interface MetaIntegration {
  id: string;
  name: string;
  provider: string;
  status: string;
  enabled: boolean;
  config: any;
  createdAt: string;
  updatedAt: string;
}

interface MetaAdAccount {
  id: string;
  accountId: string;
  name: string;
  currency: string | null;
  currencyMultiplier?: number | null;
  timezone: string | null;
  accountStatus: number | null;
  lastSyncAt: string | null;
}

interface MetaAdInsight {
  accountId: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adId: string;
  adName: string;
  date: string;
  spend: number;
  clicks?: number;
  impressions?: number;
  leads?: number;
  status?: string;
  marketingAssociate?: string | null;
}

export default function MetaDetailPage() {
  const router = useRouter();
  const params = useParams();
  const integrationId = params.id as string;

  const [integration, setIntegration] = useState<MetaIntegration | null>(null);
  const [adAccounts, setAdAccounts] = useState<MetaAdAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'accounts' | 'insights'>('accounts');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [insights, setInsights] = useState<MetaAdInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [insightsPage, setInsightsPage] = useState(1);
  const insightsPageSize = 15;
  const [insightsDateRange, setInsightsDateRange] = useState<{
    startDate: string | Date | null;
    endDate: string | Date | null;
  }>({ startDate: null, endDate: null });
  const [insightsAccount, setInsightsAccount] = useState<string>('all');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [showMultiplierModal, setShowMultiplierModal] = useState(false);
  const [multiplierInput, setMultiplierInput] = useState<string>('');

  useEffect(() => {
    fetchIntegration();
    fetchAdAccounts();
  }, [integrationId]);

  useEffect(() => {
    if (activeTab === 'insights') {
      fetchInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, insightsAccount, insightsDateRange.startDate, insightsDateRange.endDate]);

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

      setIntegration(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load integration');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdAccounts = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await apiClient.get(`/integrations/${integrationId}/meta/accounts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setAdAccounts(response.data);
      // Remove selections that no longer exist
      setSelectedAccounts((prev) =>
        prev.filter((id) => response.data.some((acc: MetaAdAccount) => acc.accountId === id)),
      );
    } catch (err: any) {
      console.error('Failed to load ad accounts:', err);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const token = localStorage.getItem('access_token');

      const response = await apiClient.post(`/integrations/${integrationId}/meta/sync-accounts`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        alert(`Success!\n\n${response.data.message}`);
        await fetchAdAccounts();
      }
    } catch (err: any) {
      alert('Sync failed!\n\n' + (err.response?.data?.message || 'Unknown error'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      const token = localStorage.getItem('access_token');

      const response = await apiClient.post(`/integrations/${integrationId}/test-connection`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        alert(`Connection test successful!\n\n${JSON.stringify(response.data.data, null, 2)}`);
        await fetchIntegration();
      }
    } catch (err: any) {
      alert('Connection test failed!\n\n' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAccountStatusText = (status: number | null) => {
    if (status === null) return 'Unknown';
    switch (status) {
      case 1:
        return 'Active';
      case 2:
        return 'Disabled';
      case 3:
        return 'Unsettled';
      case 7:
        return 'Pending Review';
      case 9:
        return 'In Grace Period';
      case 100:
        return 'Pending Closure';
      case 101:
        return 'Closed';
      default:
        return `Status ${status}`;
    }
  };

  const getAccountStatusColor = (status: number | null) => {
    if (status === 1) return 'text-emerald-600 bg-emerald-50';
    if (status === 2 || status === 101) return 'text-rose-600 bg-rose-50';
    return 'text-slate-600 bg-slate-50';
  };

  const handleUpdateMultiplier = async () => {
    const value = parseFloat(multiplierInput);
    if (!Number.isFinite(value) || value <= 0) {
      alert('Please enter a positive multiplier.');
      return;
    }
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      await apiClient.patch(
        `/integrations/${integrationId}/meta/accounts/multiplier`,
        { accountIds: selectedAccounts, multiplier: value },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setShowMultiplierModal(false);
      setMultiplierInput('');
      await fetchAdAccounts();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update currency multiplier');
    }
  };

  const fetchInsights = async () => {
    try {
      setInsightsLoading(true);
      setInsightsError('');
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const params: Record<string, string> = {};
      if (insightsAccount && insightsAccount !== 'all') {
        params.accountId = insightsAccount;
      }
      if (insightsDateRange.startDate) {
        params.dateFrom =
          typeof insightsDateRange.startDate === 'string'
            ? insightsDateRange.startDate
            : insightsDateRange.startDate.toISOString().slice(0, 10);
      }
      if (insightsDateRange.endDate) {
        params.dateTo =
          typeof insightsDateRange.endDate === 'string'
            ? insightsDateRange.endDate
            : insightsDateRange.endDate.toISOString().slice(0, 10);
      }

      const response = await apiClient.get(`/integrations/${integrationId}/meta/insights`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setInsights(response.data || []);
      setInsightsPage(1);
    } catch (err: any) {
      setInsightsError(err.response?.data?.message || 'Failed to load insights');
    } finally {
      setInsightsLoading(false);
    }
  };

  const paginatedInsights = useMemo(() => {
    const start = (insightsPage - 1) * insightsPageSize;
    const end = insightsPage * insightsPageSize;
    return insights.slice(start, end);
  }, [insights, insightsPage, insightsPageSize]);

  const totalInsights = insights.length;
  const insightsCanPrev = insightsPage > 1;
  const insightsCanNext = insightsPage * insightsPageSize < totalInsights;

  const paginatedAccounts = adAccounts.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(adAccounts.length / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const eligibleAccounts = useMemo(
    () => adAccounts.filter((acc) => (acc.currency || '').toUpperCase() !== 'PHP'),
    [adAccounts],
  );
  const allEligibleSelected =
    eligibleAccounts.length > 0 &&
    eligibleAccounts.every((acc) => selectedAccounts.includes(acc.accountId));

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-600 ring-emerald-200';
      case 'ERROR':
        return 'bg-rose-50 text-rose-600 ring-rose-200';
      case 'PENDING':
        return 'bg-amber-50 text-amber-600 ring-amber-200';
      case 'DISABLED':
        return 'bg-slate-50 text-slate-600 ring-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 ring-slate-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500 text-lg">Loading integration...</div>
      </div>
    );
  }

  if (error || !integration) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
        {error || 'Integration not found'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex-shrink-0">
        <button
          onClick={() => router.push('/integrations/meta')}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Meta Integrations
        </button>

        <div className="sm:flex sm:items-center sm:justify-between">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{integration.name}</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-slate-500">View and manage ad accounts for this integration</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={handleTestConnection}
              className="inline-flex items-center justify-center px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            >
              Test Connection
            </button>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center justify-center px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSyncing ? 'Syncing...' : 'Sync Ad Accounts'}
            </button>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="mt-6 border-b border-slate-200 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
          <div className="flex gap-4 min-w-max sm:min-w-0">
            <button
              className={`px-3 pb-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'accounts'
                  ? 'text-slate-900 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab('accounts')}
            >
              Ad Accounts
            </button>
            <button
              className={`px-3 pb-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'insights'
                  ? 'text-slate-900 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab('insights')}
            >
              Ad Insights
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'accounts' && (
        <div className="flex flex-1 flex-col gap-4 min-h-0">
          {/* Integration Details Card */}
          <div className="bg-white shadow-sm rounded-2xl border border-slate-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Integration Details</h2>
              <span className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-medium ring-1 ring-inset self-start ${getStatusBadgeClasses(integration.status)}`}>
                {integration.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {integration.config?.userId && (
                <div>
                  <p className="text-sm text-slate-500">User ID</p>
                  <p className="text-sm font-mono text-slate-900 mt-1 break-all">{integration.config.userId}</p>
                </div>
              )}
              {integration.config?.userName && (
                <div>
                  <p className="text-sm text-slate-500">User Name</p>
                  <p className="text-sm text-slate-900 mt-1">{integration.config.userName}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-500">Created</p>
                <p className="text-sm text-slate-900 mt-1">{formatDate(integration.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Last Updated</p>
                <p className="text-sm text-slate-900 mt-1">{formatDate(integration.updatedAt)}</p>
              </div>
            </div>
          </div>

          {/* Ad Accounts Section */}
          <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Ad Accounts ({adAccounts.length})
                </h2>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={allEligibleSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAccounts(eligibleAccounts.map((acc) => acc.accountId));
                        } else {
                          setSelectedAccounts([]);
                        }
                      }}
                    />
                    <span>Select all non-PHP</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMultiplierModal(true)}
                    disabled={selectedAccounts.length === 0}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add currency multiplier
                  </button>
                </div>
              </div>
            </div>

        {adAccounts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex-1 flex items-center justify-center">
            No ad accounts synced yet. Click "Sync Ad Accounts" to fetch them.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Select</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Account ID</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Name</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Currency</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Multiplier</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Timezone</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Status</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Last Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedAccounts.map((account) => {
                    const isPhp = (account.currency || '').toUpperCase() === 'PHP';
                    const selected = selectedAccounts.includes(account.accountId);
                    return (
                    <tr key={account.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {!isPhp ? (
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedAccounts((prev) => {
                                const set = new Set(prev);
                                if (checked) set.add(account.accountId);
                                else set.delete(account.accountId);
                                return Array.from(set);
                              });
                            }}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-900">
                        <div className="max-w-[150px] truncate" title={account.accountId}>
                          {account.accountId}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        <div className="max-w-[200px] truncate" title={account.name}>
                          {account.name}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {account.currency || 'N/A'}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {account.currencyMultiplier != null ? Number(account.currencyMultiplier).toFixed(4) : '—'}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div className="max-w-[150px] truncate" title={account.timezone || 'N/A'}>
                          {account.timezone || 'N/A'}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getAccountStatusColor(account.accountStatus)}`}>
                          {getAccountStatusText(account.accountStatus)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div className="min-w-[120px]">
                          {formatDate(account.lastSyncAt)}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
              <p className="text-sm text-slate-600">
                Showing {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, adAccounts.length)} of {adAccounts.length}
              </p>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!canPrev}
                >
                  Previous
                </button>
                <button
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!canNext}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="flex flex-1 flex-col gap-4 min-h-0">
        <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex-shrink-0">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Ad Insights</h2>
                <p className="text-sm text-slate-600">Data from meta_ad_insights</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={insightsAccount}
                  onChange={(e) => setInsightsAccount(e.target.value)}
                  className="w-full sm:w-auto rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All accounts</option>
                  {adAccounts.map((acct) => (
                    <option key={acct.accountId} value={acct.accountId}>
                      {acct.name || acct.accountId}
                    </option>
                  ))}
                </select>
                <div className="relative w-full sm:w-64">
                  <Datepicker
                    value={insightsDateRange as any}
                    onChange={(value: any) => setInsightsDateRange(value)}
                    inputClassName="w-full rounded-lg border border-slate-200 pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    containerClassName="w-full"
                    displayFormat="YYYY-MM-DD"
                    toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer"
                    placeholder="Select date range"
                  />
                </div>
              </div>
            </div>
          </div>

          {insightsLoading ? (
            <div className="p-6 text-slate-500 flex-1 flex items-center justify-center">Loading insights…</div>
          ) : insightsError ? (
            <div className="p-6 text-rose-600 flex-1 flex items-center justify-center">Failed to load insights: {insightsError}</div>
          ) : insights.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex-1 flex items-center justify-center">No insights found.</div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Date</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Account</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Campaign</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ad Set</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ad</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Spend</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Clicks</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Impr.</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Leads</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedInsights.map((row) => (
                      <tr key={`${row.accountId}-${row.adId}-${row.date}-${row.campaignId}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.date?.slice(0, 10) || '—'}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                          <div className="max-w-[120px] truncate" title={row.accountId}>{row.accountId}</div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                          <div className="min-w-[150px] max-w-[250px]">
                            <div className="font-medium text-slate-900 truncate" title={row.campaignName || row.campaignId || '—'}>
                              {row.campaignName || row.campaignId || '—'}
                            </div>
                            <div className="text-xs text-slate-500 truncate" title={row.campaignId}>ID: {row.campaignId || '—'}</div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                          <div className="max-w-[120px] truncate" title={row.adsetId}>{row.adsetId || '—'}</div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                          <div className="min-w-[150px] max-w-[250px]">
                            <div className="font-medium text-slate-900 truncate" title={row.adName || row.adId || '—'}>
                              {row.adName || row.adId || '—'}
                            </div>
                            <div className="text-xs text-slate-500 truncate" title={row.adId}>ID: {row.adId || '—'}</div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap font-medium">
                          {row.spend != null
                            ? Number(row.spend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '0.00'}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.clicks ?? 0}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.impressions ?? 0}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.leads ?? 0}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
                <p className="text-sm text-slate-600">
                  Showing {(insightsPage - 1) * insightsPageSize + 1}-
                  {Math.min(insightsPage * insightsPageSize, totalInsights)} of {totalInsights}
                </p>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => setInsightsPage((p) => Math.max(1, p - 1))}
                    disabled={!insightsCanPrev}
                  >
                    Previous
                  </button>
                  <button
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => setInsightsPage((p) => (insightsCanNext ? p + 1 : p))}
                    disabled={!insightsCanNext}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      )}

      {showMultiplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Add currency multiplier</h3>
            <p className="text-sm text-slate-600 mb-4">
              Apply a conversion multiplier to the selected non-PHP ad accounts.
            </p>
            <label className="block text-sm font-medium text-slate-700 mb-1">Multiplier</label>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={multiplierInput}
              onChange={(e) => setMultiplierInput(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 56.00"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50"
                onClick={() => {
                  setShowMultiplierModal(false);
                  setMultiplierInput('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500"
                onClick={handleUpdateMultiplier}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
