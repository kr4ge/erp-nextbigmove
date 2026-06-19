'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { AlertBanner } from '@/components/ui/feedback';
import { usePermissions } from '@/hooks/use-permissions';
import { useTeams } from '@/hooks/use-teams';

type DateRangeType = 'rolling' | 'relative' | 'absolute';
type WorkflowDateRange =
  | { type: 'rolling'; offsetDays: number }
  | { type: 'relative'; days: number }
  | { type: 'absolute'; since: string; until: string };

type WorkflowCreatePayload = {
  name: string;
  description?: string;
  schedule?: string;
  teamId?: string;
  sharedTeamIds?: string[];
  config: {
    dateRange: WorkflowDateRange;
    sources: {
      meta: { enabled: boolean };
      pos: { enabled: boolean };
    };
    rateLimit: {
      metaDelayMs: number;
      posDelayMs: number;
    };
  };
};

interface WorkflowFormData {
  name: string;
  description: string;
  teamId?: string;
  schedule: string; // derived cron expression
  scheduleUnit: 'minutes' | 'hours' | 'days';
  everyMinutes: number; // 1-59
  everyHours: number; // 1-23
  atMinutes: number; // 0-59
  everyDays: number; // 1-31
  atHours: number; // 0-23
  // Shared date range (applies to both Meta and POS)
  dateRangeType: DateRangeType;
  offsetDays: number;
  days: number;
  since: string;
  until: string;
  metaEnabled: boolean;
  metaDelayMs: number;
  posEnabled: boolean;
  posDelayMs: number;
  enabled: boolean;
  scheduleType: 'manual' | 'scheduled';
}

const sanitizeTeamId = (value?: string | null) => {
  if (!value || value === 'ALL_TEAMS') return undefined;
  return value;
};

const filterSharedForSave = (ids: string[], owner?: string | null | undefined) => {
  const ownerClean = sanitizeTeamId(owner);
  return ids.filter((id) => id && id !== ownerClean);
};

const parseErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object') return fallback;
  const maybeError = error as {
    response?: { data?: { message?: unknown } };
    message?: unknown;
  };
  const responseMessage = maybeError.response?.data?.message;
  if (Array.isArray(responseMessage)) return responseMessage.join(', ');
  if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) return responseMessage;
  if (typeof maybeError.message === 'string' && maybeError.message.trim().length > 0) return maybeError.message;
  return fallback;
};

const toWorkflowFieldValue = (value: unknown) =>
  value as WorkflowFormData[keyof WorkflowFormData];

export default function CreateWorkflowPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [teamId, setTeamId] = useState<string>('ALL_TEAMS');
  const [sharedTeamIds, setSharedTeamIds] = useState<string[]>([]);
  const [canShareWorkflows, setCanShareWorkflows] = useState(false);
  const [hasTeamReadAll, setHasTeamReadAll] = useState(false);
  const permissionsQuery = usePermissions();
  const teamsQuery = useTeams(hasTeamReadAll);

  const [formData, setFormData] = useState<WorkflowFormData>({
    name: '',
    description: '',
    schedule: '0 2 * * *',
    scheduleUnit: 'days',
    everyMinutes: 15,
    everyHours: 6,
    atMinutes: 0,
    everyDays: 1,
    atHours: 2,
    dateRangeType: 'rolling',
    offsetDays: 1,
    days: 7,
    since: '',
    until: '',
    metaEnabled: true,
    metaDelayMs: 3000,
    posEnabled: true,
    posDelayMs: 3000,
    enabled: true,
    scheduleType: 'scheduled',
  });

  const toggleSharedTeam = (id: string) => {
    setSharedTeamIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  useEffect(() => {
    const perms = permissionsQuery.data;
    if (perms && Array.isArray(perms)) {
      setCanShareWorkflows(perms.includes('workflow.share'));
      setHasTeamReadAll(perms.includes('team.read_all') || perms.includes('permission.assign'));
    }
  }, [permissionsQuery.data]);

  useEffect(() => {
    const list = (teamsQuery.data || []) as { id: string; name: string }[];
    setTeams(list);

    const storedTeam = typeof window !== 'undefined' ? localStorage.getItem('current_team_id') : null;
    const defaultTeam = typeof window !== 'undefined' ? localStorage.getItem('default_team_id') : null;
    const candidate =
      sanitizeTeamId(storedTeam) ||
      sanitizeTeamId(defaultTeam) ||
      sanitizeTeamId(list[0]?.id) ||
      undefined;

    if (candidate) {
      setTeamId(candidate);
      setFormData((prev) => ({ ...prev, teamId: candidate }));
    } else if (list.length === 0) {
      setTeamId('');
      setFormData((prev) => ({ ...prev, teamId: undefined }));
      setError('You must belong to a team before creating a workflow.');
    }
  }, [teamsQuery.data]);

  useEffect(() => {
    // drop owner team from shared list if changed
    setSharedTeamIds((prev) => filterSharedForSave(prev, teamId));
  }, [teamId]);

  const updateField = (field: keyof WorkflowFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: toWorkflowFieldValue(value) }));
  };

  const computeCron = (data: Pick<WorkflowFormData, 'scheduleUnit' | 'everyMinutes' | 'everyHours' | 'atMinutes' | 'everyDays' | 'atHours'>) => {
    if (data.scheduleUnit === 'minutes') {
      const n = Math.min(59, Math.max(1, Math.round(data.everyMinutes || 1)));
      return `*/${n} * * * *`;
    }
    if (data.scheduleUnit === 'hours') {
      const h = Math.min(23, Math.max(1, Math.round(data.everyHours || 1)));
      const m = Math.min(59, Math.max(0, Math.round(data.atMinutes || 0)));
      return `${m} */${h} * * *`;
    }
    // days
    const d = Math.min(31, Math.max(1, Math.round(data.everyDays || 1)));
    const h = Math.min(23, Math.max(0, Math.round(data.atHours || 0)));
    const m = Math.min(59, Math.max(0, Math.round(data.atMinutes || 0)));
    return `${m} ${h} */${d} * *`;
  };

  // keep cron in sync with friendly inputs
  useEffect(() => {
    if (formData.scheduleType !== 'scheduled') return;
    const cron = computeCron({
      scheduleUnit: formData.scheduleUnit,
      everyMinutes: formData.everyMinutes,
      everyHours: formData.everyHours,
      atMinutes: formData.atMinutes,
      everyDays: formData.everyDays,
      atHours: formData.atHours,
    });
    setFormData((prev) => ({ ...prev, schedule: cron }));
  }, [
    formData.scheduleType,
    formData.scheduleUnit,
    formData.everyMinutes,
    formData.everyHours,
    formData.atMinutes,
    formData.everyDays,
    formData.atHours,
  ]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Build shared date range (applies to all enabled sources)
      let dateRange: WorkflowDateRange;
      if (formData.dateRangeType === 'rolling') {
        dateRange = { type: 'rolling', offsetDays: formData.offsetDays };
      } else if (formData.dateRangeType === 'relative') {
        dateRange = { type: 'relative', days: formData.days };
      } else {
        dateRange = { type: 'absolute', since: formData.since, until: formData.until };
      }

      // Resolve selected team
      const chosenTeamId = sanitizeTeamId(teamId) || sanitizeTeamId(formData.teamId);

      // Build the workflow payload
      const payload: WorkflowCreatePayload = {
        name: formData.name,
        ...(formData.description && { description: formData.description }),
        ...(formData.scheduleType === 'scheduled' && { schedule: formData.schedule }),
        ...(chosenTeamId ? { teamId: chosenTeamId } : {}),
        ...(canShareWorkflows
          ? { sharedTeamIds: filterSharedForSave(sharedTeamIds, chosenTeamId) }
          : {}),
        config: {
          dateRange,
          sources: {
            meta: {
              enabled: formData.metaEnabled,
            },
            pos: {
              enabled: formData.posEnabled,
            },
          },
          rateLimit: {
            metaDelayMs: formData.metaDelayMs,
            posDelayMs: formData.posDelayMs,
          },
        },
      };

      console.log('Submitting payload:', JSON.stringify(payload, null, 2));

      const response = await apiClient.post('/workflows', payload);

      // Redirect to workflow detail page
      router.push(`/workflows/${response.data.id}`);
    } catch (error: unknown) {
      console.error('Error creating workflow:', error);
      setError(parseErrorMessage(error, 'Failed to create workflow'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Create Workflow</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Step {step} of 3</p>
        </div>
        <Link
          href="/workflows"
          className="btn btn-md btn-outline"
        >
          Cancel
        </Link>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-slate-200 dark:bg-border'}`}></div>
        <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-slate-200 dark:bg-border'}`}></div>
        <div className={`flex-1 h-2 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-slate-200 dark:bg-border'}`}></div>
      </div>

      {error && (
        <AlertBanner tone="error" message={error} />
      )}

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="bg-surface rounded-xl border border-slate-200 p-6 space-y-6 dark:border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Basic Information</h3>
          </div>

          <div>
            <label className="form-label">
              Workflow Name <span className="text-primary">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., Daily Meta & POS Sync"
              className="input w-full rounded-2xl border border-slate-200 bg-surface dark:border-border px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="form-label">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="e.g., Fetch yesterday's Meta ads and POS orders daily at 2am"
              rows={3}
              className="w-full rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
            />
          </div>

          <div>
            <label className="form-label">Team</label>
            <select
              value={teamId}
          onChange={(e) => {
            const value = e.target.value;
            setTeamId(value);
            setFormData((prev) => ({
              ...prev,
              teamId: sanitizeTeamId(value),
            }));
            if (typeof window !== 'undefined') {
              localStorage.setItem('current_team_id', value);
            }
          }}
          className="w-full rounded-2xl border border-slate-200 dark:border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
          </div>

          {canShareWorkflows && (
            <div>
              <label className="form-label">
                Share with teams
              </label>
              <div className="space-y-2 rounded-2xl border border-slate-200 dark:border-border bg-surface px-4 py-3">
                {teams.filter((t) => t.id !== sanitizeTeamId(teamId)).length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-300">No other teams available</p>
                ) : (
                  teams
                    .filter((t) => t.id !== sanitizeTeamId(teamId))
                    .map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm text-slate-800 dark:text-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-primary focus:ring-primary"
                          checked={sharedTeamIds.includes(t.id)}
                          onChange={() => toggleSharedTeam(t.id)}
                        />
                        <span className='text-foreground'>{t.name}</span>
                      </label>
                    ))
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setStep(2)}
              disabled={!formData.name || !formData.teamId}
              className="btn btn-lg btn-primary disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:border-border dark:disabled:bg-surface dark:disabled:text-slate-500"
            >
              Next Step
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure Sources */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Shared Date Range */}
          <div className="bg-surface rounded-xl border border-slate-200 p-6 space-y-4 dark:border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Date Range</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">Applies to both Meta Ads and Pancake POS</p>
              </div>
            </div>

            <div>
              <label className="form-label">
                Date Range Type
              </label>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-surface px-4 py-3 dark:border-border">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.dateRangeType === 'rolling'}
                    onChange={() => updateField('dateRangeType', 'rolling')}
                    className="h-4 w-4 border-slate-300 accent-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-700 dark:text-foreground">Rolling (Offset from today)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.dateRangeType === 'relative'}
                    onChange={() => updateField('dateRangeType', 'relative')}
                    className="h-4 w-4 border-slate-300 accent-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-700 dark:text-foreground">Relative (Last N days)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.dateRangeType === 'absolute'}
                    onChange={() => updateField('dateRangeType', 'absolute')}
                    className="h-4 w-4 border-slate-300 accent-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-700 dark:text-foreground">Absolute (Specific dates)</span>
                </label>
              </div>
            </div>

            {formData.dateRangeType === 'rolling' && (
              <div>
                <label className="form-label mr-2">Offset Days</label>
                <input
                  type="number"
                  min="0"
                  value={formData.offsetDays}
                  onChange={(e) => updateField('offsetDays', parseInt(e.target.value) || 0)}
                  className="w-32 rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">0 = today, 1 = yesterday</p>
              </div>
            )}

            {formData.dateRangeType === 'relative' && (
              <div>
                <label className="form-label">Last N Days</label>
                <input
                  type="number"
                  min="1"
                  value={formData.days}
                  onChange={(e) => updateField('days', parseInt(e.target.value) || 1)}
                  className="w-32 rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                />
              </div>
            )}

            {formData.dateRangeType === 'absolute' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">From</label>
                  <input
                    type="date"
                    value={formData.since}
                    onChange={(e) => updateField('since', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                  />
                </div>
                <div>
                  <label className="form-label">To</label>
                  <input
                    type="date"
                    value={formData.until}
                    onChange={(e) => updateField('until', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Meta Ads */}
          <div className="bg-surface rounded-xl border border-slate-200 p-6 space-y-4 dark:border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Meta Ads</h3>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.metaEnabled}
                  onChange={(e) => updateField('metaEnabled', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-foreground">Enable Meta Ads fetching</span>
              </label>
            </div>

            {formData.metaEnabled && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">Uses the shared date range above.</p>
                <div>
                  <label className="form-label mr-2">
                    Rate Limit Delay (ms)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="100"
                    value={formData.metaDelayMs}
                    onChange={(e) => updateField('metaDelayMs', parseInt(e.target.value) || 3000)}
                    className="w-40 rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Recommended: 3000ms (3 seconds)</p>
                </div>
              </>
            )}
          </div>

          {/* POS */}
          <div className="bg-surface rounded-xl border border-slate-200 p-6 space-y-4 dark:border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Pancake POS</h3>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.posEnabled}
                  onChange={(e) => updateField('posEnabled', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-foreground">Enable POS fetching</span>
              </label>
            </div>

            {formData.posEnabled && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">Uses the shared date range above.</p>
                <div>
                  <label className="form-label mr-2">
                    Rate Limit Delay (ms)
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="100"
                    value={formData.posDelayMs}
                    onChange={(e) => updateField('posDelayMs', parseInt(e.target.value) || 3000)}
                    className="w-40 rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Recommended: 3000ms (3 seconds)</p>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="btn btn-lg btn-ghost"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!formData.metaEnabled && !formData.posEnabled}
              className="btn btn-lg btn-primary disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:border-border dark:disabled:bg-surface dark:disabled:text-slate-500"
            >
              Next Step →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Schedule */}
      {step === 3 && (
        <div className="bg-surface rounded-xl border border-slate-200 p-6 space-y-6 dark:border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Execution Schedule</h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={formData.scheduleType === 'manual'}
                onChange={() => updateField('scheduleType', 'manual')}
                className="h-4 w-4 border-slate-300 accent-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-foreground">Manual only (no automatic schedule)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={formData.scheduleType === 'scheduled'}
                onChange={() => updateField('scheduleType', 'scheduled')}
                className="h-4 w-4 border-slate-300 accent-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-foreground">Scheduled (cron expression)</span>
            </label>
          </div>

          {formData.scheduleType === 'scheduled' && (
            <>
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(['minutes', 'hours', 'days'] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => updateField('scheduleUnit', unit)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                        formData.scheduleUnit === unit ? 'bg-primary text-surface' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-surface dark:text-slate-300 dark:hover:bg-background-secondary'
                      }`}
                    >
                      {unit === 'minutes' ? 'Minutes' : unit === 'hours' ? 'Hours' : 'Days'}
                    </button>
                  ))}
                </div>

                {formData.scheduleUnit === 'minutes' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Every (minutes)</label>
                      <input
                        type="number"
                        min={1}
                        max={59}
                        value={formData.everyMinutes}
                        onChange={(e) => updateField('everyMinutes', Math.max(1, Math.min(59, parseInt(e.target.value) || 1)))}
                        className="w-full rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                      />
                    </div>
                  </div>
                )}

                {formData.scheduleUnit === 'hours' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Every (hours)</label>
                      <input
                        type="number"
                        min={1}
                        max={23}
                        value={formData.everyHours}
                        onChange={(e) => updateField('everyHours', Math.max(1, Math.min(23, parseInt(e.target.value) || 1)))}
                        className="w-full rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                      />
                    </div>
                    <div>
                      <label className="form-label">At minute</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={formData.atMinutes}
                        onChange={(e) => updateField('atMinutes', Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                      />
                    </div>
                  </div>
                )}

                {formData.scheduleUnit === 'days' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="form-label">Every (days)</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={formData.everyDays}
                        onChange={(e) => updateField('everyDays', Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                        className="w-full rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                      />
                    </div>
                    <div>
                      <label className="form-label">At hour</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={formData.atHours}
                        onChange={(e) => updateField('atHours', Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                        className="w-full rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                      />
                    </div>
                    <div>
                      <label className="form-label">At minute</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={formData.atMinutes}
                        onChange={(e) => updateField('atMinutes', Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-sm text-foreground focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 dark:border-border"
                      />
                    </div>
                  </div>
                )}

                <div className="text-sm text-slate-700 dark:text-foreground">
                  <span className="font-medium">Runs: </span>
                  {formData.scheduleUnit === 'minutes' &&
                    `Every ${formData.everyMinutes} minute${formData.everyMinutes === 1 ? '' : 's'}`}
                  {formData.scheduleUnit === 'hours' &&
                    `Every ${formData.everyHours} hour${formData.everyHours === 1 ? '' : 's'} at minute ${formData.atMinutes}`}
                  {formData.scheduleUnit === 'days' &&
                    `Every ${formData.everyDays} day${formData.everyDays === 1 ? '' : 's'} at ${String(formData.atHours).padStart(2, '0')}:${String(formData.atMinutes).padStart(2, '0')}`}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-300">Cron generated: <span className="font-mono">{formData.schedule}</span></p>
              </div>
            </>
          )}

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => updateField('enabled', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-foreground">Enable workflow immediately</span>
            </label>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="btn btn-lg btn-ghost"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className='btn btn-lg btn-primary'
            >
              {isSubmitting ? 'Creating...' : 'Create Workflow'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
