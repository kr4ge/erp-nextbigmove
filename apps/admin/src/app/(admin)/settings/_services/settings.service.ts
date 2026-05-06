import apiClient from '@/lib/api-client';
import type {
  CreateWmsSettingsRoleInput,
  CreateWmsSettingsUserInput,
  UpdateWmsSettingsProfileInput,
  UpdateWmsSettingsRoleInput,
  UpdateWmsSettingsUserInput,
  WmsSettingsProfile,
  WmsSettingsRoleOptions,
  WmsSettingsUserOptions,
  WmsSettingsRolesResponse,
  WmsSettingsUsersResponse,
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
