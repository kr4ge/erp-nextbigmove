'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';

type ShareScope = 'marketing' | 'sales';

type ShareTeam = {
  id: string;
  name: string;
};

type UseAnalyticsShareResult = {
  canShare: boolean;
  shareOpen: boolean;
  shareTeams: ShareTeam[];
  shareSelected: string[];
  shareLoading: boolean;
  shareSaving: boolean;
  currentTeamId: string | null;
  setShareOpen: (open: boolean) => void;
  openShareModal: () => Promise<void>;
  toggleShareTeam: (id: string) => void;
  saveShare: () => Promise<void>;
};

export function useAnalyticsShare(scope: ShareScope): UseAnalyticsShareResult {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTeams, setShareTeams] = useState<ShareTeam[]>([]);
  const [shareSelected, setShareSelected] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedTeamId = localStorage.getItem('current_team_id');
    if (storedTeamId) setCurrentTeamId(storedTeamId);

    const userJson = localStorage.getItem('user');
    if (!userJson) return;

    try {
      const parsed = JSON.parse(userJson);
      if (Array.isArray(parsed?.permissions) && parsed.permissions.includes('analytics.share')) {
        setCanShare(true);
      }
    } catch {
      // ignore malformed localStorage payload
    }
  }, []);

  useEffect(() => {
    if (canShare) return;

    const fetchPermissions = async () => {
      try {
        const response = await apiClient.get('/auth/permissions', {
          params: { workspace: 'erp' },
        });
        const permissions: string[] = response?.data?.permissions || [];
        if (permissions.includes('analytics.share')) {
          setCanShare(true);
        }
      } catch {
        // ignore permission fallback failures
      }
    };

    fetchPermissions();
  }, [canShare]);

  const openShareModal = async () => {
    if (!canShare) return;

    setShareOpen(true);
    setShareLoading(true);

    try {
      let teamList: ShareTeam[] = [];
      try {
        const teamsResponse = await apiClient.get('/teams');
        teamList = teamsResponse.data || [];
      } catch {
        const myTeamsResponse = await apiClient.get('/teams/my-teams');
        teamList = myTeamsResponse.data || [];
      }

      setShareTeams(teamList);

      const shareResponse = await apiClient.get('/analytics/shares', {
        params: { scope },
      });

      setShareSelected(shareResponse.data?.sharedTeamIds || []);
    } catch {
      setShareTeams([]);
      setShareSelected([]);
    } finally {
      setShareLoading(false);
    }
  };

  const toggleShareTeam = (id: string) => {
    setShareSelected((prev) =>
      prev.includes(id) ? prev.filter((teamId) => teamId !== id) : [...prev, id],
    );
  };

  const saveShare = async () => {
    setShareSaving(true);
    try {
      await apiClient.post('/analytics/shares', {
        scope,
        sharedTeamIds: shareSelected,
      });
      setShareOpen(false);
    } finally {
      setShareSaving(false);
    }
  };

  return {
    canShare,
    shareOpen,
    shareTeams,
    shareSelected,
    shareLoading,
    shareSaving,
    currentTeamId,
    setShareOpen,
    openShareModal,
    toggleShareTeam,
    saveShare,
  };
}
