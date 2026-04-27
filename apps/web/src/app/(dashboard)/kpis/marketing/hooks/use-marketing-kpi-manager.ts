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
import type {
  CategoryTargetGroup,
  KpiTargetRow,
  OverviewResponse,
  TeamTargetGroup,
} from '../types';
import { parseErrorMessage } from '../utils';

type SubmitActionConfig = {
  key: string;
  request: () => Promise<unknown>;
  successMessage: string;
};

const TEAM_KPI_ADMIN_PERMISSION_KEYS = [
  'team.manage',
  'permission.assign',
  'user.manage',
  'team.read_all',
] as const;

const buildTeamTargetGroups = (rows: KpiTargetRow[]): TeamTargetGroup[] => {
  const grouped = new Map<string, TeamTargetGroup>();

  rows.forEach((row) => {
    const startDate = row.startDate || TODAY;
    const key = `${row.teamCode}|${startDate}|${row.endDate || ''}`;
    const existing = grouped.get(key) || {
      id: key,
      teamCode: row.teamCode,
      startDate,
      endDate: row.endDate || null,
      adSpendTarget: null,
      arPctTarget: null,
    };

    if (row.metricKey === 'TEAM_AD_SPEND') {
      existing.adSpendTarget = row.targetValue;
    }
    if (row.metricKey === 'TEAM_AR_PCT') {
      existing.arPctTarget = row.targetValue;
    }

    grouped.set(key, existing);
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.startDate !== b.startDate) return b.startDate.localeCompare(a.startDate);
    return (b.endDate || '').localeCompare(a.endDate || '');
  });
};

const buildCategoryTargetGroups = (rows: KpiTargetRow[]): CategoryTargetGroup[] => {
  const grouped = new Map<string, CategoryTargetGroup>();

  rows.forEach((row) => {
    const startDate = row.startDate || TODAY;
    const category = (row.category || 'SCALING') as CategoryTargetGroup['category'];
    const key = `${row.teamCode}|${category}|${startDate}|${row.endDate || ''}`;
    const existing = grouped.get(key) || {
      id: key,
      teamCode: row.teamCode,
      category,
      startDate,
      endDate: row.endDate || null,
      creativesTarget: null,
      arPctTarget: null,
    };

    if (row.metricKey === 'USER_CREATIVES_CREATED') {
      existing.creativesTarget = row.targetValue;
    }
    if (row.metricKey === 'USER_AR_PCT') {
      existing.arPctTarget = row.targetValue;
    }

    grouped.set(key, existing);
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.startDate !== b.startDate) return b.startDate.localeCompare(a.startDate);
    return (b.endDate || '').localeCompare(a.endDate || '');
  });
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
  const [editingTeamTargetId, setEditingTeamTargetId] = useState<string | null>(null);
  const [editingCategoryTargetId, setEditingCategoryTargetId] = useState<string | null>(null);

  const selectedTeam = useMemo(
    () => overview?.teamOptions.find((team) => team.teamCode === selectedTeamCode) || null,
    [overview?.teamOptions, selectedTeamCode],
  );

  const canManageMarketingKpi = useMemo(
    () => permissions.includes('kpi.marketing.manage'),
    [permissions],
  );

  const isMarketingLeader = useMemo(
    () => permissions.includes('dashboard.marketing_leader'),
    [permissions],
  );

  const isMarketingLeaderOnly = useMemo(
    () =>
      isMarketingLeader &&
      !permissions.includes('dashboard.executives'),
    [isMarketingLeader, permissions],
  );

  const canManageTeamKpi = useMemo(
    () =>
      canManageMarketingKpi &&
      !isMarketingLeader &&
      TEAM_KPI_ADMIN_PERMISSION_KEYS.some((permissionKey) =>
        permissions.includes(permissionKey),
      ),
    [canManageMarketingKpi, isMarketingLeader, permissions],
  );

  const teamTargetGroups = useMemo(
    () => buildTeamTargetGroups(overview?.teamTargets || []),
    [overview?.teamTargets],
  );

  const categoryTargetGroups = useMemo(
    () => buildCategoryTargetGroups(overview?.categoryTargets || []),
    [overview?.categoryTargets],
  );

  const fetchPermissions = useCallback(async () => {
    try {
      const response = await apiClient.get<{ permissions?: string[] }>('/auth/permissions', {
        params: { workspace: 'erp' },
      });
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
        return false;
      }

      setSubmittingKey(key);
      try {
        await request();
        addToast('success', successMessage);
        await fetchOverview(selectedTeamCode);
        return true;
      } catch (error) {
        addToast('error', parseErrorMessage(error));
        return false;
      } finally {
        setSubmittingKey(null);
      }
    },
    [addToast, fetchOverview, selectedTeamCode],
  );

  const saveTeamTargets = useCallback(
    async () => {
      const success = await runSubmitAction({
        key: 'team-targets',
        successMessage: editingTeamTargetId ? 'Team KPI updated.' : 'Team KPI saved.',
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
      });

      if (success) {
        setEditingTeamTargetId(null);
      }
    },
    [editingTeamTargetId, runSubmitAction, selectedTeamCode, teamTargetForm],
  );

  const saveCategoryTargets = useCallback(
    async () => {
      const success = await runSubmitAction({
        key: 'category-targets',
        successMessage: editingCategoryTargetId ? 'Category KPI updated.' : 'Category KPI saved.',
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
      });

      if (success) {
        setEditingCategoryTargetId(null);
      }
    },
    [categoryTargetForm, editingCategoryTargetId, runSubmitAction, selectedTeamCode],
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

  const beginEditTeamTarget = useCallback((target: TeamTargetGroup) => {
    setTeamTargetForm({
      startDate: target.startDate,
      endDate: target.endDate || '',
      adSpend: target.adSpendTarget !== null ? target.adSpendTarget.toString() : '',
      arPct: target.arPctTarget !== null ? target.arPctTarget.toString() : '',
    });
    setEditingTeamTargetId(target.id);
  }, []);

  const cancelEditTeamTarget = useCallback(() => {
    setTeamTargetForm(INITIAL_TEAM_TARGET_FORM);
    setEditingTeamTargetId(null);
  }, []);

  const beginEditCategoryTarget = useCallback((target: CategoryTargetGroup) => {
    setCategoryTargetForm({
      category: target.category,
      startDate: target.startDate,
      endDate: target.endDate || '',
      creativesCreated:
        target.creativesTarget !== null ? target.creativesTarget.toString() : '',
      arPct: target.arPctTarget !== null ? target.arPctTarget.toString() : '',
    });
    setEditingCategoryTargetId(target.id);
  }, []);

  const cancelEditCategoryTarget = useCallback(() => {
    setCategoryTargetForm(INITIAL_CATEGORY_TARGET_FORM);
    setEditingCategoryTargetId(null);
  }, []);

  const deleteTeamTarget = useCallback(
    async (target: TeamTargetGroup) => {
      const success = await runSubmitAction({
        key: `delete-team-target-${target.id}`,
        successMessage: 'Team KPI deleted.',
        request: () =>
          apiClient.post('/kpis/marketing/target-groups/delete', {
            teamCode: target.teamCode,
            scopeType: 'TEAM',
            startDate: target.startDate,
            endDate: target.endDate || undefined,
          }),
      });

      if (success && editingTeamTargetId === target.id) {
        cancelEditTeamTarget();
      }
    },
    [cancelEditTeamTarget, editingTeamTargetId, runSubmitAction],
  );

  const deleteCategoryTarget = useCallback(
    async (target: CategoryTargetGroup) => {
      const success = await runSubmitAction({
        key: `delete-category-target-${target.id}`,
        successMessage: 'Category template deleted.',
        request: () =>
          apiClient.post('/kpis/marketing/target-groups/delete', {
            teamCode: target.teamCode,
            scopeType: 'CATEGORY',
            category: target.category,
            startDate: target.startDate,
            endDate: target.endDate || undefined,
          }),
      });

      if (success && editingCategoryTargetId === target.id) {
        cancelEditCategoryTarget();
      }
    },
    [cancelEditCategoryTarget, editingCategoryTargetId, runSubmitAction],
  );

  useEffect(() => {
    if (editingTeamTargetId && !teamTargetGroups.some((group) => group.id === editingTeamTargetId)) {
      setEditingTeamTargetId(null);
    }
  }, [editingTeamTargetId, teamTargetGroups]);

  useEffect(() => {
    if (
      editingCategoryTargetId &&
      !categoryTargetGroups.some((group) => group.id === editingCategoryTargetId)
    ) {
      setEditingCategoryTargetId(null);
    }
  }, [categoryTargetGroups, editingCategoryTargetId]);

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
    canManageTeamKpi,
    isMarketingLeaderOnly,
    teamTargetForm,
    setTeamTargetForm,
    categoryTargetForm,
    setCategoryTargetForm,
    assignmentForm,
    setAssignmentForm,
    userTargetForm,
    setUserTargetForm,
    submittingKey,
    teamTargetGroups,
    categoryTargetGroups,
    isEditingTeamTarget: Boolean(editingTeamTargetId),
    isEditingCategoryTarget: Boolean(editingCategoryTargetId),
    beginEditTeamTarget,
    cancelEditTeamTarget,
    beginEditCategoryTarget,
    cancelEditCategoryTarget,
    deleteTeamTarget,
    deleteCategoryTarget,
    saveTeamTargets,
    saveCategoryTargets,
    saveUserCategoryAssignment,
    saveUserTargetOverride,
    refreshOverview: fetchOverview,
    categories: overview?.categories || [...DEFAULT_CATEGORIES],
  };
};
