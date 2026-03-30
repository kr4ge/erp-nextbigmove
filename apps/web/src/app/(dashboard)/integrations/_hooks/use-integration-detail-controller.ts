'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Integration } from '../types';
import { parseIntegrationErrorMessage } from '../_utils/integration-error';
import type { AdAccountOption, ShopOption } from '../_types/integration-detail';
import { integrationDetailService } from '../_services/integration-detail.service';

export function useIntegrationDetailController(integrationId: string) {
  const router = useRouter();

  const [integration, setIntegration] = useState<Integration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [selectedAdAccountId, setSelectedAdAccountId] = useState('');
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccountOption[]>([]);
  const [showCredentials, setShowCredentials] = useState(false);

  const fetchIntegration = useCallback(async () => {
    try {
      const data = await integrationDetailService.fetchIntegration(integrationId);
      setIntegration(data);
      setName(data.name);
      setDescription(data.description || '');
      setSelectedShopId((data.config?.shopId as string) || '');
      setSelectedAdAccountId((data.config?.adAccountId as string) || '');
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

  useEffect(() => {
    void fetchIntegration();
  }, [fetchIntegration]);

  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await integrationDetailService.testConnection(integrationId);
      if (response.success) {
        setSuccessMessage('Connection test successful!');
        await fetchIntegration();
      } else {
        setError(`Connection test failed: ${response.message || 'Unknown error'}`);
      }
    } catch (testError) {
      setError(parseIntegrationErrorMessage(testError));
    } finally {
      setIsTesting(false);
    }
  }, [fetchIntegration, integrationId]);

  const fetchShopsOrAccounts = useCallback(async () => {
    if (!integration) return;

    setIsLoading(true);
    setError('');

    let tempIntegrationId: string | null = null;
    try {
      if (integration.provider === 'PANCAKE_POS' && apiKey) {
        const temp = await integrationDetailService.createTemporaryPosIntegration(apiKey);
        tempIntegrationId = temp.id;

        const testResponse = await integrationDetailService.testConnection(tempIntegrationId);
        if (testResponse.success && testResponse.details?.shops) {
          setShops(testResponse.details.shops);
        }
      } else if (integration.provider === 'META_ADS' && accessToken) {
        const accounts = await integrationDetailService.fetchMetaAdAccounts(accessToken);
        setAdAccounts(accounts);
      }
    } catch (fetchError) {
      setError(parseIntegrationErrorMessage(fetchError));
    } finally {
      if (tempIntegrationId) {
        try {
          await integrationDetailService.deleteIntegration(tempIntegrationId);
        } catch {
          // ignore cleanup error
        }
      }
      setIsLoading(false);
    }
  }, [accessToken, apiKey, integration]);

  const handleUpdate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSaving(true);
      setError('');
      setSuccessMessage('');

      try {
        const updateData: Record<string, unknown> = {
          name,
          description,
        };

        if (integration?.provider === 'PANCAKE_POS' && apiKey) {
          updateData.credentials = { apiKey };
        } else if (integration?.provider === 'META_ADS' && accessToken) {
          updateData.credentials = { accessToken };
        }

        if (integration?.provider === 'PANCAKE_POS' && selectedShopId) {
          updateData.config = { shopId: selectedShopId };
        } else if (integration?.provider === 'META_ADS' && selectedAdAccountId) {
          updateData.config = { adAccountId: selectedAdAccountId };
        }

        await integrationDetailService.updateIntegration(integrationId, updateData);
        setSuccessMessage('Integration updated successfully!');
        setShowCredentials(false);
        setApiKey('');
        setAccessToken('');
        await fetchIntegration();
      } catch (updateError) {
        setError(parseIntegrationErrorMessage(updateError));
      } finally {
        setIsSaving(false);
      }
    },
    [
      accessToken,
      apiKey,
      description,
      fetchIntegration,
      integration?.provider,
      integrationId,
      name,
      selectedAdAccountId,
      selectedShopId,
    ],
  );

  const handleToggleEnabled = useCallback(async () => {
    if (!integration) return;
    try {
      await integrationDetailService.toggleIntegration(integrationId, integration.enabled);
      setSuccessMessage(
        `Integration ${integration.enabled ? 'disabled' : 'enabled'} successfully!`,
      );
      await fetchIntegration();
    } catch (toggleError) {
      setError(parseIntegrationErrorMessage(toggleError));
    }
  }, [fetchIntegration, integration, integrationId]);

  const handleDelete = useCallback(async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this integration? This action cannot be undone.',
    );
    if (!confirmed) return;

    try {
      await integrationDetailService.deleteIntegration(integrationId);
      router.push('/integrations');
    } catch (deleteError) {
      setError(parseIntegrationErrorMessage(deleteError));
    }
  }, [integrationId, router]);

  return {
    integration,
    isLoading,
    isSaving,
    isTesting,
    error,
    successMessage,
    name,
    setName,
    description,
    setDescription,
    apiKey,
    setApiKey,
    accessToken,
    setAccessToken,
    selectedShopId,
    setSelectedShopId,
    selectedAdAccountId,
    setSelectedAdAccountId,
    shops,
    adAccounts,
    showCredentials,
    setShowCredentials,
    handleTestConnection,
    fetchShopsOrAccounts,
    handleUpdate,
    handleToggleEnabled,
    handleDelete,
  };
}
