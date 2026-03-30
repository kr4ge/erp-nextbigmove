import { type Dispatch, type SetStateAction } from 'react';
import { FIELD_CLASS } from '../constants';
import type { EligibleUser, UserTargetFormState } from '../types';
import { FormSection } from './form-section';

type UserTargetOverrideFormProps = {
  form: UserTargetFormState;
  setForm: Dispatch<SetStateAction<UserTargetFormState>>;
  eligibleUsers: EligibleUser[];
  loading: boolean;
  disabled: boolean;
  onSave: () => void;
};

export function UserTargetOverrideForm({
  form,
  setForm,
  eligibleUsers,
  loading,
  disabled,
  onSave,
}: UserTargetOverrideFormProps) {
  return (
    <FormSection
      title="Direct User KPI Override"
      description="Optional override per user. Any metric not set here continues using the category KPI template."
      actionLabel="Save User KPI"
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
              {user.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.startDate}
          onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
          className={FIELD_CLASS}
        />
        <input
          type="date"
          value={form.endDate}
          onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
          className={FIELD_CLASS}
          placeholder="Open ended"
        />
        <input
          type="number"
          value={form.creativesCreated}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, creativesCreated: event.target.value }))
          }
          className={FIELD_CLASS}
          placeholder="Creative Created target"
        />
        <input
          type="number"
          value={form.arPct}
          onChange={(event) => setForm((prev) => ({ ...prev, arPct: event.target.value }))}
          className={FIELD_CLASS}
          placeholder="AR% target"
        />
      </div>
    </FormSection>
  );
}
