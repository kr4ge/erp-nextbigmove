import { type Dispatch, type SetStateAction } from 'react';
import { FIELD_CLASS } from '../constants';
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
};

export function UserCategoryAssignmentForm({
  form,
  setForm,
  categories,
  eligibleUsers,
  loading,
  disabled,
  onSave,
}: UserCategoryAssignmentFormProps) {
  return (
    <FormSection
      title="User Category Assignment"
      description="Team leaders can assign only operational User 3 members in their team."
      actionLabel="Save User Category"
      onAction={onSave}
      loading={loading}
      disabled={disabled}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select
          value={form.userId}
          onChange={(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
          className={`${FIELD_CLASS} sm:col-span-2`}
        >
          <option value="">Select user</option>
          {eligibleUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} {user.currentCategory ? `(${user.currentCategory})` : ''}
            </option>
          ))}
        </select>
        <select
          value={form.category}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              category: event.target.value as MarketingKpiCategory,
            }))
          }
          className={FIELD_CLASS}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
    </FormSection>
  );
}
