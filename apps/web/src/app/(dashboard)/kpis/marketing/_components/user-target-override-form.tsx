import { type Dispatch, type SetStateAction } from 'react';
import {
  DATE_FIELD_CLASS,
  FIELD_GROUP_CLASS,
  FIELD_LABEL_CLASS,
  NUMBER_FIELD_CLASS,
  SELECT_FIELD_CLASS,
} from '../constants';
import type { EligibleUser, UserTargetFormState } from '../types';
import { FormSection } from './form-section';

type UserTargetOverrideFormProps = {
  form: UserTargetFormState;
  setForm: Dispatch<SetStateAction<UserTargetFormState>>;
  eligibleUsers: EligibleUser[];
  loading: boolean;
  disabled: boolean;
  onSave: () => void;
  variant?: 'card' | 'plain';
};

export function UserTargetOverrideForm({
  form,
  setForm,
  eligibleUsers,
  loading,
  disabled,
  onSave,
  variant = 'card',
}: UserTargetOverrideFormProps) {
  return (
    <FormSection
      title="Direct User KPI Override"
      description="Optional per-user KPI override."
      actionLabel="Save User KPI"
      onAction={onSave}
      loading={loading}
      disabled={disabled}
      variant={variant}
      footerHint="Use overrides for exceptions, not baseline targets."
    >
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className={FIELD_GROUP_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Member + Validity
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="override-user" className={FIELD_LABEL_CLASS}>
                Member
              </label>
              <select
                id="override-user"
                value={form.userId}
                onChange={(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
                className={SELECT_FIELD_CLASS}
              >
                <option value="">Select user</option>
                {eligibleUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="override-start-date" className={FIELD_LABEL_CLASS}>
                Start
              </label>
              <input
                id="override-start-date"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                className={DATE_FIELD_CLASS}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="override-end-date" className={FIELD_LABEL_CLASS}>
                End
              </label>
              <input
                id="override-end-date"
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                className={DATE_FIELD_CLASS}
                placeholder="Open ended"
              />
            </div>
          </div>
        </div>

        <div className={FIELD_GROUP_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Override Targets
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="override-creatives" className={FIELD_LABEL_CLASS}>
                Creatives Target
              </label>
              <input
                id="override-creatives"
                type="number"
                value={form.creativesCreated}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, creativesCreated: event.target.value }))
                }
                className={NUMBER_FIELD_CLASS}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="override-ar-pct" className={FIELD_LABEL_CLASS}>
                AR% Target
              </label>
              <input
                id="override-ar-pct"
                type="number"
                value={form.arPct}
                onChange={(event) => setForm((prev) => ({ ...prev, arPct: event.target.value }))}
                className={NUMBER_FIELD_CLASS}
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </div>
    </FormSection>
  );
}
