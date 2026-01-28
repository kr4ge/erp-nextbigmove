'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useTeams(canViewAll: boolean) {
  return useQuery({
    queryKey: ['teams', canViewAll],
    queryFn: async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (!token) throw new Error('missing token');
      if (canViewAll) {
        try {
          const res = await apiClient.get('/teams', { headers: { Authorization: `Bearer ${token}` } });
          return res.data || [];
        } catch {
          const res = await apiClient.get('/teams/my-teams', {
            headers: { Authorization: `Bearer ${token}` },
          });
          return res.data || [];
        }
      }
      const res = await apiClient.get('/teams/my-teams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data || [];
    },
    enabled: typeof window !== 'undefined',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
