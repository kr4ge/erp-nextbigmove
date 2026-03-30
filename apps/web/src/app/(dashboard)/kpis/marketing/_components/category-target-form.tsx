import { type Dispatch, type SetStateAction } from 'react';
import { FIELD_CLASS } from '../constants';
import type { CategoryTargetFormState, MarketingKpiCategory } from '../types';
import { FormSection } from './form-section';

type CategoryTargetFormProps = {
  form: CategoryTargetFormState;
  setForm: Dispatch<SetStateAction<CategoryTargetFormState>>;
  categories: MarketingKpiCategory[];
  loading: boolean;
  disabled: boolean;
  onSave: () => void;
};

export function CategoryTargetForm({
  form,
  setForm,
  categories,
  loading,
  disabled,
  onSave,
}: CategoryTargetFormProps) {
  return (
    <FormSection
      title="Category KPI Templates"
      description="Default KPI template for User 3 by category. Direct user KPI can still override it later."
      actionLabel="Save Category KPI"
      onAction={onSave}
      loading={loading}
      disabled={disabled}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          className={`${FIELD_CLASS} sm:col-span-2`}
          placeholder="AR% target"
        />
      </div>
    </FormSection>
  );
}
