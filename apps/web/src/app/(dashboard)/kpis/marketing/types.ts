import type { KpiValueFormat } from '@/lib/kpi/format';

export type MarketingKpiCategory = 'SCALING' | 'TESTING';

export type TeamOption = {
  id: string;
  name: string;
  teamCode: string;
};

export type EligibleUser = {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
  currentCategory: MarketingKpiCategory | null;
};

export type KpiTargetRow = {
  id: string;
  scopeType: 'TEAM' | 'CATEGORY' | 'USER';
  teamCode: string;
  userId: string | null;
  userName: string | null;
  category: MarketingKpiCategory | null;
  metricKey: string;
  label: string;
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  format: KpiValueFormat;
  targetValue: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

export type CategoryAssignmentRow = {
  id: string;
  userId: string;
  userName: string;
  category: MarketingKpiCategory;
  createdAt: string;
};

export type OverviewResponse = {
  selected: {
    startDate: string;
    endDate: string;
    teamCode: string | null;
    teamId: string | null;
  };
  teamOptions: TeamOption[];
  categories: MarketingKpiCategory[];
  teamTargets: KpiTargetRow[];
  categoryTargets: KpiTargetRow[];
  userTargets: KpiTargetRow[];
  userCategoryAssignments: CategoryAssignmentRow[];
  eligibleUsers: EligibleUser[];
};

export type TeamTargetFormState = {
  startDate: string;
  endDate: string;
  adSpend: string;
  arPct: string;
};

export type CategoryTargetFormState = {
  category: MarketingKpiCategory;
  startDate: string;
  endDate: string;
  creativesCreated: string;
  arPct: string;
};

export type UserCategoryFormState = {
  userId: string;
  category: MarketingKpiCategory;
};

export type UserTargetFormState = {
  userId: string;
  startDate: string;
  endDate: string;
  creativesCreated: string;
  arPct: string;
};

export type TeamTargetGroup = {
  id: string;
  teamCode: string;
  startDate: string;
  endDate: string | null;
  adSpendTarget: number | null;
  arPctTarget: number | null;
};

export type CategoryTargetGroup = {
  id: string;
  teamCode: string;
  category: MarketingKpiCategory;
  startDate: string;
  endDate: string | null;
  creativesTarget: number | null;
  arPctTarget: number | null;
};
