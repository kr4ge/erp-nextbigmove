'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import {
  DEFAULT_CATEGORIES,
  INITIAL_CATEGORY_TARGET_FORM,
  INITIAL_TEAM_TARGET_FORM,
  INITIAL_USER_CATEGORY_FORM,
  INITIAL_USER_TARGET_FORM,
  TODAY,
} from '../constants';
import type { OverviewResponse } from '../types';
import { parseErrorMessage } from '../utils';

type SubmitActionConfig = {
  key: string;
  request: () => Promise<unknown>;
  successMessage: string;
};

export const useMarketingKpiManager = () => {
  const { addToast } = useToast();

  const [permissions, setPermissions] = useState<string[]>([]);
  const [selectedTeamCode, setSelectedTeamCode] = useState('');
  const [filterStartDate, setFilterStartDate] = useState(TODAY);
  const [filterEndDate, setFilterEndDate] = useState(TODAY);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');

  const [teamTargetForm, setTeamTargetForm] = useState(INITIAL_TEAM_TARGET_FORM);
  const [categoryTargetForm, setCategoryTargetForm] = useState(INITIAL_CATEGORY_TARGET_FORM);
  const [assignmentForm, setAssignmentForm] = useState(INITIAL_USER_CATEGORY_FORM);
  const [userTargetForm, setUserTargetForm] = useState(INITIAL_USER_TARGET_FORM);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  const selectedTeam = useMemo(
    () => overview?.teamOptions.find((team) => team.teamCode === selectedTeamCode) || null,
    [overview?.teamOptions, selectedTeamCode],
  );

  const canManageMarketingKpi = useMemo(
    () => permissions.includes('kpi.marketing.manage'),
    [permissions],
  );

  const fetchPermissions = useCallback(async () => {
    try {
      const response = await apiClient.get<{ permissions?: string[] }>('/auth/permissions');
      setPermissions(response.data?.permissions || []);
    } catch {
      setPermissions([]);
    }
  }, []);

  const fetchOverview = useCallback(
    async (nextTeamCode?: string) => {
      setLoading(true);
      setOverviewError('');

      try {
        const effectiveTeamCode = nextTeamCode ?? selectedTeamCode;
        const params: Record<string, string> = {
          start_date: filterStartDate,
          end_date: filterEndDate,
        };

        if (effectiveTeamCode) {
          params.team_code = effectiveTeamCode;
        }

        const response = await apiClient.get<OverviewResponse>('/kpis/marketing/overview', { params });
        const data = response.data;
        setOverview(data);

        if (!effectiveTeamCode && data.selected.teamCode) {
          setSelectedTeamCode(data.selected.teamCode);
        }

        const defaultUserId = data.eligibleUsers[0]?.id || '';
        if (defaultUserId) {
          setAssignmentForm((prev) => (prev.userId ? prev : { ...prev, userId: defaultUserId }));
          setUserTargetForm((prev) => (prev.userId ? prev : { ...prev, userId: defaultUserId }));
        }
      } catch (error) {
        const message = parseErrorMessage(error);
        setOverviewError(message);
        addToast('error', message);
      } finally {
        setLoading(false);
      }
    },
    [addToast, filterEndDate, filterStartDate, selectedTeamCode],
  );

  useEffect(() => {
    void fetchPermissions();
  }, [fetchPermissions]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  const runSubmitAction = useCallback(
    async ({ key, request, successMessage }: SubmitActionConfig) => {
      if (!selectedTeamCode) {
        addToast('error', 'Select a team first.');
        return;
      }

      setSubmittingKey(key);
      try {
        await request();
        addToast('success', successMessage);
        await fetchOverview(selectedTeamCode);
      } catch (error) {
        addToast('error', parseErrorMessage(error));
      } finally {
        setSubmittingKey(null);
      }
    },
    [addToast, fetchOverview, selectedTeamCode],
  );

  const saveTeamTargets = useCallback(
    () =>
      runSubmitAction({
        key: 'team-targets',
        successMessage: 'Team KPI saved.',
        request: () =>
          apiClient.post('/kpis/marketing/team-targets', {
            teamCode: selectedTeamCode,
            startDate: teamTargetForm.startDate,
            endDate: teamTargetForm.endDate || undefined,
            metrics: [
              {
                metricKey: 'TEAM_AD_SPEND',
                targetValue: Number(teamTargetForm.adSpend || 0),
              },
              {
                metricKey: 'TEAM_AR_PCT',
                targetValue: Number(teamTargetForm.arPct || 0),
              },
            ],
          }),
      }),
    [runSubmitAction, selectedTeamCode, teamTargetForm],
  );

  const saveCategoryTargets = useCallback(
    () =>
      runSubmitAction({
        key: 'category-targets',
        successMessage: 'Category KPI saved.',
        request: () =>
          apiClient.post('/kpis/marketing/category-targets', {
            teamCode: selectedTeamCode,
            category: categoryTargetForm.category,
            startDate: categoryTargetForm.startDate,
            endDate: categoryTargetForm.endDate || undefined,
            metrics: [
              {
                metricKey: 'USER_CREATIVES_CREATED',
                targetValue: Number(categoryTargetForm.creativesCreated || 0),
              },
              {
                metricKey: 'USER_AR_PCT',
                targetValue: Number(categoryTargetForm.arPct || 0),
              },
            ],
          }),
      }),
    [categoryTargetForm, runSubmitAction, selectedTeamCode],
  );

  const saveUserCategoryAssignment = useCallback(
    () =>
      runSubmitAction({
        key: 'user-category',
        successMessage: 'User category saved.',
        request: () =>
          apiClient.post('/kpis/marketing/user-category-assignments', {
            teamCode: selectedTeamCode,
            userId: assignmentForm.userId,
            category: assignmentForm.category,
          }),
      }),
    [assignmentForm, runSubmitAction, selectedTeamCode],
  );

  const saveUserTargetOverride = useCallback(
    () =>
      runSubmitAction({
        key: 'user-targets',
        successMessage: 'User KPI override saved.',
        request: () =>
          apiClient.post('/kpis/marketing/user-targets', {
            teamCode: selectedTeamCode,
            userId: userTargetForm.userId,
            startDate: userTargetForm.startDate,
            endDate: userTargetForm.endDate || undefined,
            metrics: [
              {
                metricKey: 'USER_CREATIVES_CREATED',
                targetValue: Number(userTargetForm.creativesCreated || 0),
              },
              {
                metricKey: 'USER_AR_PCT',
                targetValue: Number(userTargetForm.arPct || 0),
              },
            ],
          }),
      }),
    [runSubmitAction, selectedTeamCode, userTargetForm],
  );

  return {
    permissions,
    selectedTeamCode,
    setSelectedTeamCode,
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    overview,
    loading,
    overviewError,
    selectedTeam,
    canManageMarketingKpi,
    teamTargetForm,
    setTeamTargetForm,
    categoryTargetForm,
    setCategoryTargetForm,
    assignmentForm,
    setAssignmentForm,
    userTargetForm,
    setUserTargetForm,
    submittingKey,
    saveTeamTargets,
    saveCategoryTargets,
    saveUserCategoryAssignment,
    saveUserTargetOverride,
    refreshOverview: fetchOverview,
    categories: overview?.categories || [...DEFAULT_CATEGORIES],
  };
};
