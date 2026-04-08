import apiClient from '@/lib/api-client';
import type { WmsPermission, WmsRole } from '../_types/roles';

type RolePayload = {
  name: string;
  key: string;
  description?: string;
  permissionKeys: string[];
};

export async function fetchWmsRoles(): Promise<WmsRole[]> {
  const response = await apiClient.get('/wms/settings/roles');
  return response.data;
}

export async function fetchWmsPermissions(): Promise<WmsPermission[]> {
  const response = await apiClient.get('/wms/settings/permissions');
  return response.data;
}

export async function createWmsRole(payload: RolePayload): Promise<WmsRole> {
  const response = await apiClient.post('/wms/settings/roles', payload);
  return response.data;
}

export async function updateWmsRole(
  id: string,
  payload: Partial<RolePayload>,
): Promise<WmsRole> {
  const response = await apiClient.patch(`/wms/settings/roles/${id}`, payload);
  return response.data;
}

export async function deleteWmsRole(id: string): Promise<void> {
  await apiClient.delete(`/wms/settings/roles/${id}`);
}
