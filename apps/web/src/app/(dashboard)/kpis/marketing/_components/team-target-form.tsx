import { type Dispatch, type SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import {
  DATE_FIELD_CLASS,
  FIELD_GROUP_CLASS,
  FIELD_LABEL_CLASS,
  NUMBER_FIELD_CLASS,
} from '../constants';
import type { TeamTargetFormState, TeamTargetGroup } from '../types';
import { formatMarketingMetricValue } from '../utils';
import { FormSection } from './form-section';

type TeamTargetFormProps = {
  form: TeamTargetFormState;
  setForm: Dispatch<SetStateAction<TeamTargetFormState>>;
  loading: boolean;
  disabled: boolean;
  onSave: () => void;
  variant?: 'card' | 'plain';
  targets: TeamTargetGroup[];
  isEditing: boolean;
  onEditTarget: (target: TeamTargetGroup) => void;
  onDeleteTarget: (target: TeamTargetGroup) => void;
  onCancelEdit: () => void;
  submittingKey: string | null;
};

export function TeamTargetForm({
  form,
  setForm,
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
}: TeamTargetFormProps) {
  return (
    <FormSection
      title="Team KPI Targets"
      description="Set team targets for Ad Spend and AR."
      actionLabel={isEditing ? 'Update Team KPI' : 'Save Team KPI'}
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
            Validity Window
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="team-kpi-start-date" className={FIELD_LABEL_CLASS}>
                Start
              </label>
              <input
                id="team-kpi-start-date"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                className={DATE_FIELD_CLASS}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="team-kpi-end-date" className={FIELD_LABEL_CLASS}>
                End
              </label>
              <input
                id="team-kpi-end-date"
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
              <label htmlFor="team-kpi-ad-spend" className={FIELD_LABEL_CLASS}>
                Ad Spend Target
              </label>
              <input
                id="team-kpi-ad-spend"
                type="number"
                value={form.adSpend}
                onChange={(event) => setForm((prev) => ({ ...prev, adSpend: event.target.value }))}
                className={NUMBER_FIELD_CLASS}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="team-kpi-ar-pct" className={FIELD_LABEL_CLASS}>
                AR% Target
              </label>
              <input
                id="team-kpi-ar-pct"
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
              Existing Team Targets
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
                      {target.startDate} to {target.endDate || 'Open ended'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                      <span className="tabular-nums">
                        Ad Spend: {formatMarketingMetricValue(target.adSpendTarget || 0, 'currency')}
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
                      loading={submittingKey === `delete-team-target-${target.id}`}
                      disabled={disabled || Boolean(submittingKey && submittingKey !== `delete-team-target-${target.id}`)}
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
              No team targets found.
            </div>
          )}
        </div>
      </div>
    </FormSection>
  );
}
