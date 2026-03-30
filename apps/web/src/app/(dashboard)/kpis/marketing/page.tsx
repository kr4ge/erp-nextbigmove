'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { HeaderFilters } from './_components/header-filters';
import { TeamTargetForm } from './_components/team-target-form';
import { CategoryTargetForm } from './_components/category-target-form';
import { UserCategoryAssignmentForm } from './_components/user-category-assignment-form';
import { UserTargetOverrideForm } from './_components/user-target-override-form';
import { TeamCategoryHistory } from './_components/team-category-history';
import { UserHistory } from './_components/user-history';
import { OverviewStrip } from './_components/overview-strip';
import { OverviewError } from './_components/overview-error';
import { useMarketingKpiManager } from './hooks/use-marketing-kpi-manager';
import { formatDateRangeLabel } from './utils';

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI Marketing"
        description="Assign team KPI, category KPI, and individual KPI for marketing."
        actions={
          <HeaderFilters
            selectedTeamCode={selectedTeamCode}
            filterStartDate={filterStartDate}
            filterEndDate={filterEndDate}
            teamOptions={overview?.teamOptions || []}
            onTeamCodeChange={setSelectedTeamCode}
            onFilterStartDateChange={setFilterStartDate}
            onFilterEndDateChange={setFilterEndDate}
          />
        }
      />

      <OverviewStrip
        teamName={teamName}
        teamCode={teamCode}
        dateRange={formatDateRangeLabel(filterStartDate, filterEndDate)}
        eligibleUserCount={eligibleUsers.length}
        loading={loading}
      />

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Refreshing KPI data…
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
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TeamTargetForm
              form={teamTargetForm}
              setForm={setTeamTargetForm}
              loading={submittingKey === 'team-targets'}
              disabled={!hasSelectedTeam || loading}
              onSave={() => void saveTeamTargets()}
            />

            <CategoryTargetForm
              form={categoryTargetForm}
              setForm={setCategoryTargetForm}
              categories={categories}
              loading={submittingKey === 'category-targets'}
              disabled={!hasSelectedTeam || loading}
              onSave={() => void saveCategoryTargets()}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <UserCategoryAssignmentForm
              form={assignmentForm}
              setForm={setAssignmentForm}
              categories={categories}
              eligibleUsers={eligibleUsers}
              loading={submittingKey === 'user-category'}
              disabled={!hasSelectedTeam || loading}
              onSave={() => void saveUserCategoryAssignment()}
            />

            <UserTargetOverrideForm
              form={userTargetForm}
              setForm={setUserTargetForm}
              eligibleUsers={eligibleUsers}
              loading={submittingKey === 'user-targets'}
              disabled={!hasSelectedTeam || loading}
              onSave={() => void saveUserTargetOverride()}
            />
          </div>
        </>
      ) : (
        <Card>
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Read-only KPI view. Historical targets and assignments are visible below, but write access is limited to users with <span className="font-semibold text-slate-900">`kpi.marketing.manage`</span>.
          </div>
        </Card>
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
