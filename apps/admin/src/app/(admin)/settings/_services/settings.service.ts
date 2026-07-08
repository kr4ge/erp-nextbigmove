import apiClient from '@/lib/api-client';
import type {
  CreateWmsStoxReleaseInput,
  UpdateWmsInvoicePartnerBillingInput,
  CreateWmsSettingsRoleInput,
  CreateWmsSettingsUserInput,
  UpdateWmsInvoiceSettingsInput,
  UpdateWmsSettingsProfileInput,
  UpdateWmsSettingsRoleInput,
  UpdateWmsSettingsUserInput,
  WmsInvoiceSettingsResponse,
  WmsInvoicePartnersResponse,
  WmsSettingsProfile,
  WmsSettingsRoleOptions,
  WmsSettingsUserOptions,
  WmsSettingsRolesResponse,
  WmsSettingsUsersResponse,
  WmsStoxReleasesResponse,
} from '../_types/settings';

export async function updateWmsSettingsProfile(input: UpdateWmsSettingsProfileInput) {
  const response = await apiClient.patch<{ user: WmsSettingsProfile }>('/auth/profile', input);
  return response.data.user;
}

export async function fetchWmsSettingsUsers() {
  const response = await apiClient.get<WmsSettingsUsersResponse>('/wms/settings/users');
  return response.data;
}

export async function fetchWmsSettingsUserOptions() {
  const response = await apiClient.get<WmsSettingsUserOptions>('/wms/settings/users/options');
  return response.data;
}

export async function createWmsSettingsUser(input: CreateWmsSettingsUserInput) {
  const response = await apiClient.post('/wms/settings/users', input);
  return response.data;
}

export async function updateWmsSettingsUser(id: string, input: UpdateWmsSettingsUserInput) {
  const response = await apiClient.patch(`/wms/settings/users/${id}`, input);
  return response.data;
}

export async function deactivateWmsSettingsUser(id: string) {
  const response = await apiClient.delete(`/wms/settings/users/${id}`);
  return response.data;
}

export async function fetchWmsSettingsRoles() {
  const response = await apiClient.get<WmsSettingsRolesResponse>('/wms/settings/roles');
  return response.data;
}

export async function fetchWmsSettingsRoleOptions() {
  const response = await apiClient.get<WmsSettingsRoleOptions>('/wms/settings/roles/options');
  return response.data;
}

export async function createWmsSettingsRole(input: CreateWmsSettingsRoleInput) {
  const response = await apiClient.post('/wms/settings/roles', input);
  return response.data;
}

export async function updateWmsSettingsRole(id: string, input: UpdateWmsSettingsRoleInput) {
  const response = await apiClient.patch(`/wms/settings/roles/${id}`, input);
  return response.data;
}

export async function deleteWmsSettingsRole(id: string) {
  const response = await apiClient.delete(`/wms/settings/roles/${id}`);
  return response.data;
}

export async function fetchWmsInvoiceSettings() {
  const response = await apiClient.get<WmsInvoiceSettingsResponse>('/wms/settings/invoice');
  return response.data;
}

export async function updateWmsInvoiceSettings(input: UpdateWmsInvoiceSettingsInput) {
  const response = await apiClient.patch<WmsInvoiceSettingsResponse>(
    '/wms/settings/invoice',
    input,
  );
  return response.data;
}

export async function fetchWmsInvoicePartners() {
  const response = await apiClient.get<WmsInvoicePartnersResponse>('/wms/settings/invoice/partners');
  return response.data;
}

export async function updateWmsInvoicePartnerBilling(
  tenantId: string,
  input: UpdateWmsInvoicePartnerBillingInput,
) {
  const response = await apiClient.patch<{ partner: WmsInvoicePartnersResponse['partners'][number] }>(
    `/wms/settings/invoice/partners/${tenantId}`,
    input,
  );
  return response.data.partner;
}

export async function uploadWmsInvoiceLogo(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<{
    asset: {
      id: string;
      imageUrl: string;
      contentType: string;
      byteSize: number;
      width: number | null;
      height: number | null;
      originalFileName: string | null;
    };
  }>('/wms/settings/invoice/logo-upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.asset;
}

export async function fetchWmsStoxReleases() {
  const response = await apiClient.get<WmsStoxReleasesResponse>('/wms/settings/stox/releases');
  return response.data;
}

export async function createWmsStoxRelease(input: CreateWmsStoxReleaseInput) {
  if (input.sourceUrl?.trim()) {
    const response = await apiClient.post('/wms/settings/stox/releases/import-url', {
      version: input.version,
      buildNumber: input.buildNumber,
      releaseNotes: input.releaseNotes ?? null,
      isActive: input.isActive ?? true,
      sourceUrl: input.sourceUrl.trim(),
    });

    return response.data;
  }

  if (!input.file) {
    throw new Error('STOX Android APK file is required');
  }

  const formData = new FormData();
  formData.append('version', input.version);
  formData.append('buildNumber', `${input.buildNumber}`);
  formData.append('releaseNotes', input.releaseNotes ?? '');
  formData.append('isActive', `${input.isActive ?? true}`);
  formData.append('file', input.file);

  const response = await apiClient.post('/wms/settings/stox/releases', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function activateWmsStoxRelease(id: string) {
  const response = await apiClient.post(`/wms/settings/stox/releases/${id}/activate`);
  return response.data;
}
