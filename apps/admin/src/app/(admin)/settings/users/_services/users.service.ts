import apiClient from '@/lib/api-client';
import type { WmsUser, WmsUserForm } from '../_types/users';
import type { WmsRole } from '../../roles/_types/roles';

export async function fetchWmsUsers(): Promise<WmsUser[]> {
  const response = await apiClient.get('/wms/settings/users');
  return response.data;
}

export async function createWmsUser(payload: WmsUserForm): Promise<WmsUser> {
  const response = await apiClient.post('/wms/settings/users', {
    ...payload,
    roleId: payload.roleId || undefined,
  });
  return response.data;
}

export async function updateWmsUser(
  id: string,
  payload: Partial<WmsUserForm>,
): Promise<WmsUser> {
  const response = await apiClient.patch(`/wms/settings/users/${id}`, {
    ...payload,
    roleId: payload.roleId || undefined,
    password: payload.password || undefined,
  });
  return response.data;
}

export async function deleteWmsUser(id: string): Promise<void> {
  await apiClient.delete(`/wms/settings/users/${id}`);
}

export async function fetchWmsRolesForUsers(): Promise<WmsRole[]> {
  const response = await apiClient.get('/wms/settings/roles');
  return response.data;
}
