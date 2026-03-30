'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseIntegrationErrorMessage } from '../../../_utils/integration-error';
import type { InsightsDateRange, MetaAdAccount, MetaAdInsight, MetaIntegration } from '../types';
import {
  formatMetaDetailDate,
  getMetaAccountStatusColor,
  getMetaAccountStatusText,
  getMetaIntegrationStatusBadgeClasses,
} from '../_utils/meta-detail-formatters';
import { metaDetailService } from '../_services/meta-detail.service';

export function useMetaDetailController(integrationId: string) {
  const router = useRouter();

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
  const [insightsDateRange, setInsightsDateRange] = useState<InsightsDateRange>({
    startDate: null,
    endDate: null,
  });
  const [insightsAccount, setInsightsAccount] = useState<string>('all');

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [showMultiplierModal, setShowMultiplierModal] = useState(false);
  const [multiplierInput, setMultiplierInput] = useState<string>('');

  const fetchIntegration = useCallback(async () => {
    try {
      const data = await metaDetailService.fetchIntegration(integrationId);
      setIntegration(data);
    } catch (fetchError) {
      const message = parseIntegrationErrorMessage(fetchError);
      if (message.toLowerCase().includes('unauthorized')) {
        router.push('/login');
        return;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [integrationId, router]);

  const fetchAdAccounts = useCallback(async () => {
    try {
      const data = await metaDetailService.fetchAdAccounts(integrationId);
      setAdAccounts(data);
      setSelectedAccounts((prev) =>
        prev.filter((id) => data.some((account) => account.accountId === id)),
      );
    } catch (fetchError) {
      console.error('Failed to load ad accounts:', fetchError);
    }
  }, [integrationId]);

  const fetchInsights = useCallback(async () => {
    try {
      setInsightsLoading(true);
      setInsightsError('');
      const data = await metaDetailService.fetchInsights({
        integrationId,
        accountId: insightsAccount,
        startDate: insightsDateRange.startDate,
        endDate: insightsDateRange.endDate,
      });
      setInsights(data);
      setInsightsPage(1);
    } catch (fetchError) {
      setInsightsError(parseIntegrationErrorMessage(fetchError));
    } finally {
      setInsightsLoading(false);
    }
  }, [
    insightsAccount,
    insightsDateRange.endDate,
    insightsDateRange.startDate,
    integrationId,
  ]);

  useEffect(() => {
    void fetchIntegration();
    void fetchAdAccounts();
  }, [fetchAdAccounts, fetchIntegration]);

  useEffect(() => {
    if (activeTab === 'insights') {
      void fetchInsights();
    }
  }, [activeTab, fetchInsights]);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await metaDetailService.syncAccounts(integrationId);
      if (response.success) {
        window.alert(`Success!\n\n${response.message || 'Ad accounts synced.'}`);
        await fetchAdAccounts();
      }
    } catch (syncError) {
      window.alert(`Sync failed!\n\n${parseIntegrationErrorMessage(syncError)}`);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchAdAccounts, integrationId]);

  const handleTestConnection = useCallback(async () => {
    try {
      const response = await metaDetailService.testConnection(integrationId);
      if (response.success) {
        window.alert(
          `Connection test successful!\n\n${JSON.stringify(response.data, null, 2)}`,
        );
        await fetchIntegration();
      }
    } catch (testError) {
      window.alert(`Connection test failed!\n\n${parseIntegrationErrorMessage(testError)}`);
    }
  }, [fetchIntegration, integrationId]);

  const handleUpdateMultiplier = useCallback(async () => {
    const value = parseFloat(multiplierInput);
    if (!Number.isFinite(value) || value <= 0) {
      window.alert('Please enter a positive multiplier.');
      return;
    }
    try {
      await metaDetailService.updateAccountMultiplier({
        integrationId,
        accountIds: selectedAccounts,
        multiplier: value,
      });
      setShowMultiplierModal(false);
      setMultiplierInput('');
      await fetchAdAccounts();
    } catch (updateError) {
      window.alert(parseIntegrationErrorMessage(updateError));
    }
  }, [fetchAdAccounts, integrationId, multiplierInput, selectedAccounts]);

  const paginatedInsights = useMemo(() => {
    const start = (insightsPage - 1) * insightsPageSize;
    const end = insightsPage * insightsPageSize;
    return insights.slice(start, end);
  }, [insights, insightsPage, insightsPageSize]);

  const totalInsights = insights.length;
  const insightsCanPrev = insightsPage > 1;
  const insightsCanNext = insightsPage * insightsPageSize < totalInsights;

  const paginatedAccounts = useMemo(
    () => adAccounts.slice((page - 1) * pageSize, page * pageSize),
    [adAccounts, page],
  );
  const totalPages = Math.max(1, Math.ceil(adAccounts.length / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const eligibleAccounts = useMemo(
    () => adAccounts.filter((account) => (account.currency || '').toUpperCase() !== 'PHP'),
    [adAccounts],
  );
  const allEligibleSelected =
    eligibleAccounts.length > 0 &&
    eligibleAccounts.every((account) => selectedAccounts.includes(account.accountId));

  return {
    integration,
    adAccounts,
    isLoading,
    error,
    isSyncing,
    activeTab,
    setActiveTab,
    page,
    setPage,
    pageSize,
    insights,
    insightsLoading,
    insightsError,
    insightsPage,
    setInsightsPage,
    insightsPageSize,
    insightsDateRange,
    setInsightsDateRange,
    insightsAccount,
    setInsightsAccount,
    selectedAccounts,
    setSelectedAccounts,
    showMultiplierModal,
    setShowMultiplierModal,
    multiplierInput,
    setMultiplierInput,
    handleSync,
    handleTestConnection,
    handleUpdateMultiplier,
    paginatedInsights,
    totalInsights,
    insightsCanPrev,
    insightsCanNext,
    paginatedAccounts,
    totalPages,
    canPrev,
    canNext,
    eligibleAccounts,
    allEligibleSelected,
    formatDate: formatMetaDetailDate,
    getAccountStatusText: getMetaAccountStatusText,
    getAccountStatusColor: getMetaAccountStatusColor,
    getStatusBadgeClasses: getMetaIntegrationStatusBadgeClasses,
    onBack: () => router.push('/integrations/meta'),
  };
}
