import apiClient from '@/lib/api-client';
import type { WmsProfile } from '../_types/profile';

type UpdateProfilePayload = {
  firstName?: string;
  lastName?: string;
  avatar?: string | null;
  employeeId?: string | null;
  currentPassword?: string;
  newPassword?: string;
};

export async function fetchProfile(): Promise<WmsProfile> {
  const response = await apiClient.get('/auth/me');
  return response.data.user;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<WmsProfile> {
  const response = await apiClient.patch('/auth/profile', payload);
  return response.data.user;
}
