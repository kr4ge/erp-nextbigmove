import { type Dispatch, type SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import {
  DATE_FIELD_CLASS,
  FIELD_GROUP_CLASS,
  FIELD_LABEL_CLASS,
  NUMBER_FIELD_CLASS,
  SELECT_FIELD_CLASS,
} from '../constants';
import type {
  CategoryTargetFormState,
  CategoryTargetGroup,
  MarketingKpiCategory,
} from '../types';
import { formatMarketingMetricValue } from '../utils';
import { FormSection } from './form-section';

type CategoryTargetFormProps = {
  form: CategoryTargetFormState;
  setForm: Dispatch<SetStateAction<CategoryTargetFormState>>;
  categories: MarketingKpiCategory[];
  loading: boolean;
  disabled: boolean;
  onSave: () => void;
  variant?: 'card' | 'plain';
  targets: CategoryTargetGroup[];
  isEditing: boolean;
  onEditTarget: (target: CategoryTargetGroup) => void;
  onDeleteTarget: (target: CategoryTargetGroup) => void;
  onCancelEdit: () => void;
  submittingKey: string | null;
};

export function CategoryTargetForm({
  form,
  setForm,
  categories,
  loading,
  disabled,
  onSave,
  variant = 'card',
  targets,
  isEditing,
  onEditTarget,
  onDeleteTarget,
  onCancelEdit,
  submittingKey,
}: CategoryTargetFormProps) {
  return (
    <FormSection
      title="Category KPI Templates"
      description="Set default KPI targets by category."
      actionLabel={isEditing ? 'Update Category KPI' : 'Save Category KPI'}
      onAction={onSave}
      loading={loading}
      disabled={disabled}
      variant={variant}
      secondaryActionLabel={isEditing ? 'Cancel edit' : undefined}
      onSecondaryAction={isEditing ? onCancelEdit : undefined}
      secondaryActionDisabled={disabled}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div className={FIELD_GROUP_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Scope + Validity
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="category-kpi-category" className={FIELD_LABEL_CLASS}>
                  Category
                </label>
                <select
                  id="category-kpi-category"
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
              <div className="space-y-1">
                <label htmlFor="category-kpi-start-date" className={FIELD_LABEL_CLASS}>
                  Start
                </label>
                <input
                  id="category-kpi-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                  className={DATE_FIELD_CLASS}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="category-kpi-end-date" className={FIELD_LABEL_CLASS}>
                  End
                </label>
                <input
                  id="category-kpi-end-date"
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
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              KPI Targets
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="category-kpi-creatives" className={FIELD_LABEL_CLASS}>
                  Creatives Target
                </label>
                <input
                  id="category-kpi-creatives"
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
                <label htmlFor="category-kpi-ar-pct" className={FIELD_LABEL_CLASS}>
                  AR% Target
                </label>
                <input
                  id="category-kpi-ar-pct"
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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Existing Category Templates
            </p>
            <span className="text-[11px] tabular-nums text-slate-500">{targets.length}</span>
          </div>

          {targets.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {targets.map((target) => (
                <div
                  key={target.id}
                  className="grid gap-2 border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">
                      {target.category} · {target.startDate} to {target.endDate || 'Open ended'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                      <span className="tabular-nums">
                        Creatives: {formatMarketingMetricValue(target.creativesTarget || 0, 'number')}
                      </span>
                      <span className="tabular-nums">
                        AR%: {formatMarketingMetricValue(target.arPctTarget || 0, 'percent')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-md px-2 text-[11px]"
                      disabled={disabled || Boolean(submittingKey)}
                      onClick={() => onEditTarget(target)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-md border-rose-200 px-2 text-[11px] text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                      loading={submittingKey === `delete-category-target-${target.id}`}
                      disabled={disabled || Boolean(submittingKey && submittingKey !== `delete-category-target-${target.id}`)}
                      onClick={() => onDeleteTarget(target)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No category templates found.
            </div>
          )}
        </div>
      </div>
    </FormSection>
  );
}
