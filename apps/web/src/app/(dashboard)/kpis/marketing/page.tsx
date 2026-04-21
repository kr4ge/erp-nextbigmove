'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers, Lock, Target, Users, Zap } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DashboardTabs } from '@/components/ui/dashboard-tabs';
import { HeaderFilters } from './_components/header-filters';
import { TeamTargetForm } from './_components/team-target-form';
import { CategoryTargetForm } from './_components/category-target-form';
import { UserCategoryAssignmentForm } from './_components/user-category-assignment-form';
import { UserTargetOverrideForm } from './_components/user-target-override-form';
import { TeamCategoryHistory } from './_components/team-category-history';
import { UserHistory } from './_components/user-history';
import { OverviewError } from './_components/overview-error';
import { useMarketingKpiManager } from './hooks/use-marketing-kpi-manager';

type SetupTab = 'team' | 'category' | 'assignment' | 'override';

export default function MarketingKpiPage() {
  const {
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
    isEditingTeamTarget,
    isEditingCategoryTarget,
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
    refreshOverview,
    categories,
  } = useMarketingKpiManager();

  const teamCategoryRows = useMemo(
    () => [...(overview?.teamTargets || []), ...(overview?.categoryTargets || [])],
    [overview?.categoryTargets, overview?.teamTargets],
  );

  const hasSelectedTeam = Boolean(selectedTeamCode);
  const eligibleUsers = overview?.eligibleUsers || [];
  const teamName = selectedTeam?.name || '';
  const teamCode = selectedTeam?.teamCode || selectedTeamCode;
  const [activeSetupTab, setActiveSetupTab] = useState<SetupTab>(
    canManageTeamKpi ? 'team' : 'category',
  );

  useEffect(() => {
    if (!canManageTeamKpi && activeSetupTab === 'team') {
      setActiveSetupTab('category');
    }
  }, [activeSetupTab, canManageTeamKpi]);

  const setupTabs = useMemo(
    () => {
      const tabs = [];
      if (canManageTeamKpi) {
        tabs.push({
          value: 'team' as const,
          label: 'Team KPI',
          icon: <Target className="h-3.5 w-3.5" />,
        });
      }
      tabs.push(
        {
          value: 'category' as const,
          label: 'Category Template',
          icon: <Layers className="h-3.5 w-3.5" />,
        },
        {
          value: 'assignment' as const,
          label: 'User Category',
          icon: <Users className="h-3.5 w-3.5" />,
          badge: eligibleUsers.length,
        },
        {
          value: 'override' as const,
          label: 'User Override',
          icon: <Zap className="h-3.5 w-3.5" />,
          badge: eligibleUsers.length,
        },
      );
      return tabs;
    },
    [canManageTeamKpi, eligibleUsers.length],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing KPI"
        description="Set targets and manage assignments."
        actions={
          <HeaderFilters
            selectedTeamCode={selectedTeamCode}
            filterStartDate={filterStartDate}
            filterEndDate={filterEndDate}
            teamOptions={overview?.teamOptions || []}
            showTeamSelector={!isMarketingLeaderOnly}
            fixedTeamLabel={
              isMarketingLeaderOnly
                ? teamName || teamCode || 'Assigned team'
                : undefined
            }
            onTeamCodeChange={setSelectedTeamCode}
            onFilterStartDateChange={setFilterStartDate}
            onFilterEndDateChange={setFilterEndDate}
          />
        }
      />

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
          Refreshing…
        </div>
      ) : null}

      {overviewError ? (
        <OverviewError
          message={overviewError}
          onRetry={() => void refreshOverview(selectedTeamCode)}
          loading={loading}
        />
      ) : null}

      {canManageMarketingKpi ? (
        <section className="panel panel-content">
          <div className="panel-header">
            <Target className="h-3.5 w-3.5 text-orange-500" />
            <h2 className="panel-title">
              KPI Settings
            </h2>
            <span className="ml-auto text-xs text-slate-500">{teamName || teamCode || 'No team selected'}</span>
          </div>

          <div className="space-y-3 p-3">
            <DashboardTabs
              items={setupTabs}
              value={activeSetupTab}
              onValueChange={setActiveSetupTab}
            />

            {!hasSelectedTeam ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                Select a team to configure KPI settings.
              </div>
            ) : null}

            {canManageTeamKpi && activeSetupTab === 'team' ? (
              <TeamTargetForm
                form={teamTargetForm}
                setForm={setTeamTargetForm}
                loading={submittingKey === 'team-targets'}
                disabled={!hasSelectedTeam || loading}
                onSave={() => void saveTeamTargets()}
                variant="plain"
                targets={teamTargetGroups}
                isEditing={isEditingTeamTarget}
                onEditTarget={beginEditTeamTarget}
                onCancelEdit={cancelEditTeamTarget}
                onDeleteTarget={(target) => {
                  if (window.confirm('Delete this team KPI target?')) {
                    void deleteTeamTarget(target);
                  }
                }}
                submittingKey={submittingKey}
              />
            ) : null}

            {activeSetupTab === 'category' ? (
              <CategoryTargetForm
                form={categoryTargetForm}
                setForm={setCategoryTargetForm}
                categories={categories}
                loading={submittingKey === 'category-targets'}
                disabled={!hasSelectedTeam || loading}
                onSave={() => void saveCategoryTargets()}
                variant="plain"
                targets={categoryTargetGroups}
                isEditing={isEditingCategoryTarget}
                onEditTarget={beginEditCategoryTarget}
                onCancelEdit={cancelEditCategoryTarget}
                onDeleteTarget={(target) => {
                  if (window.confirm('Delete this category KPI template?')) {
                    void deleteCategoryTarget(target);
                  }
                }}
                submittingKey={submittingKey}
              />
            ) : null}

            {activeSetupTab === 'assignment' ? (
              <UserCategoryAssignmentForm
                form={assignmentForm}
                setForm={setAssignmentForm}
                categories={categories}
                eligibleUsers={eligibleUsers}
                loading={submittingKey === 'user-category'}
                disabled={!hasSelectedTeam || loading}
                onSave={() => void saveUserCategoryAssignment()}
                variant="plain"
              />
            ) : null}

            {activeSetupTab === 'override' ? (
              <UserTargetOverrideForm
                form={userTargetForm}
                setForm={setUserTargetForm}
                eligibleUsers={eligibleUsers}
                loading={submittingKey === 'user-targets'}
                disabled={!hasSelectedTeam || loading}
                onSave={() => void saveUserTargetOverride()}
                variant="plain"
              />
            ) : null}
          </div>
        </section>
      ) : (
        <section className="panel panel-content">
          <div className="panel-header">
            <Lock className="h-3.5 w-3.5 text-orange-500" />
            <h2 className="panel-title">
              KPI Settings
            </h2>
          </div>
          <div className="p-3">
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              Read-only mode. Request{' '}
              <span className="font-semibold text-slate-900">kpi.marketing.manage</span> to edit KPI settings.
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TeamCategoryHistory teamName={teamName} rows={teamCategoryRows} />
        <UserHistory
          teamName={teamName}
          userCategoryAssignments={overview?.userCategoryAssignments || []}
          userTargets={overview?.userTargets || []}
        />
      </div>
    </div>
  );
}
