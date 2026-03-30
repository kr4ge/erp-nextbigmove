import type {
  CategoryTargetFormState,
  TeamTargetFormState,
  UserCategoryFormState,
  UserTargetFormState,
} from './types';

export const TODAY = new Date().toISOString().slice(0, 10);
export const DEFAULT_CATEGORIES = ['SCALING', 'TESTING'] as const;

export const FIELD_CLASS =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900';

export const INITIAL_TEAM_TARGET_FORM: TeamTargetFormState = {
  startDate: TODAY,
  endDate: '',
  adSpend: '',
  arPct: '',
};

export const INITIAL_CATEGORY_TARGET_FORM: CategoryTargetFormState = {
  category: 'SCALING',
  startDate: TODAY,
  endDate: '',
  creativesCreated: '',
  arPct: '',
};

export const INITIAL_USER_CATEGORY_FORM: UserCategoryFormState = {
  userId: '',
  category: 'SCALING',
};

export const INITIAL_USER_TARGET_FORM: UserTargetFormState = {
  userId: '',
  startDate: TODAY,
  endDate: '',
  creativesCreated: '',
  arPct: '',
};
