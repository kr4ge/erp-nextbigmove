import { type Dispatch, type SetStateAction } from 'react';
import { FIELD_CLASS } from '../constants';
import type { TeamTargetFormState } from '../types';
import { FormSection } from './form-section';

type TeamTargetFormProps = {
  form: TeamTargetFormState;
  setForm: Dispatch<SetStateAction<TeamTargetFormState>>;
  loading: boolean;
  disabled: boolean;
  onSave: () => void;
};

export function TeamTargetForm({
  form,
  setForm,
  loading,
  disabled,
  onSave,
}: TeamTargetFormProps) {
  return (
    <FormSection
      title="Team KPI Targets"
      description="User 1 assigns team KPI to the selected teamCode. User 2 sees this in their leader dashboard."
      actionLabel="Save Team KPI"
      onAction={onSave}
      loading={loading}
      disabled={disabled}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          value={form.adSpend}
          onChange={(event) => setForm((prev) => ({ ...prev, adSpend: event.target.value }))}
          className={FIELD_CLASS}
          placeholder="Ad Spend target"
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
