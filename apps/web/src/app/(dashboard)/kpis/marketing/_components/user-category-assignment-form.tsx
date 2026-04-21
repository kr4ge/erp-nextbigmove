import { type Dispatch, type SetStateAction } from 'react';
import {
  FIELD_GROUP_CLASS,
  FIELD_LABEL_CLASS,
  SELECT_FIELD_CLASS,
} from '../constants';
import type { EligibleUser, MarketingKpiCategory, UserCategoryFormState } from '../types';
import { FormSection } from './form-section';

type UserCategoryAssignmentFormProps = {
  form: UserCategoryFormState;
  setForm: Dispatch<SetStateAction<UserCategoryFormState>>;
  categories: MarketingKpiCategory[];
  eligibleUsers: EligibleUser[];
  loading: boolean;
  disabled: boolean;
  onSave: () => void;
  variant?: 'card' | 'plain';
};

export function UserCategoryAssignmentForm({
  form,
  setForm,
  categories,
  eligibleUsers,
  loading,
  disabled,
  onSave,
  variant = 'card',
}: UserCategoryAssignmentFormProps) {
  return (
    <FormSection
      title="User Category Assignment"
      description="Assign category for each eligible team member."
      actionLabel="Save User Category"
      onAction={onSave}
      loading={loading}
      disabled={disabled}
      variant={variant}
      footerHint="Category assignment follows the selected category template date window and KPI targets."
    >
      <div className={FIELD_GROUP_CLASS}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Assignment Details
        </p>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="assignment-user" className={FIELD_LABEL_CLASS}>
              Member
            </label>
            <select
              id="assignment-user"
              value={form.userId}
              onChange={(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
              className={SELECT_FIELD_CLASS}
            >
              <option value="">Select user</option>
              {eligibleUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} {user.currentCategory ? `(${user.currentCategory})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="assignment-category" className={FIELD_LABEL_CLASS}>
              Category
            </label>
            <select
              id="assignment-category"
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  category: event.target.value as MarketingKpiCategory,
                }))
              }
              className={SELECT_FIELD_CLASS}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </FormSection>
  );
}
