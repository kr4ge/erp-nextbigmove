import type {
  CategoryTargetFormState,
  TeamTargetFormState,
  UserCategoryFormState,
  UserTargetFormState,
} from './types';

export const TODAY = new Date().toISOString().slice(0, 10);
export const DEFAULT_CATEGORIES = ['SCALING', 'TESTING'] as const;

const FIELD_BASE =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100';

export const FIELD_CLASS = FIELD_BASE;
export const DATE_FIELD_CLASS = `${FIELD_BASE} tabular-nums`;
export const NUMBER_FIELD_CLASS = `${FIELD_BASE} tabular-nums`;
export const SELECT_FIELD_CLASS =
  `${FIELD_BASE} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394A3B8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")] bg-[length:1rem_1rem] bg-[position:right_0.75rem_center] bg-no-repeat pr-9`;
export const FIELD_LABEL_CLASS =
  'block text-xs font-semibold uppercase tracking-wide text-slate-500';
export const FIELD_GROUP_CLASS =
  'space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3';

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
