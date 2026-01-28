'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/permissions');
      return res.data?.permissions as string[] || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
