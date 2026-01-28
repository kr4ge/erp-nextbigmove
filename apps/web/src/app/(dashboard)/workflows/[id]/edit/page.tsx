'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { usePermissions } from '@/hooks/use-permissions';
import { useTeams } from '@/hooks/use-teams';

type DateRangeType = 'rolling' | 'relative' | 'absolute';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule?: string;
  config: any;
  teamId?: string | null;
  sharedTeamIds?: string[];
}

interface WorkflowFormData {
  name: string;
  description: string;
  enabled: boolean;
  schedule: string;
  scheduleType: 'manual' | 'scheduled';
  scheduleUnit: 'minutes' | 'hours' | 'days';
  everyMinutes: number;
  everyHours: number;
  atMinutes: number;
  everyDays: number;
  atHours: number;
  dateRangeType: DateRangeType;
  offsetDays: number;
  days: number;
  since: string;
  until: string;
  metaEnabled: boolean;
  posEnabled: boolean;
  metaDelayMs: number;
  posDelayMs: number;
}

const defaultFormData: WorkflowFormData = {
  name: '',
  description: '',
  enabled: true,
  schedule: '',
  scheduleType: 'scheduled',
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
  posEnabled: true,
  metaDelayMs: 3000,
  posDelayMs: 3000,
};

function extractDateRange(config: any) {
  return (
    config?.dateRange ||
    config?.sources?.meta?.dateRange ||
    config?.sources?.pos?.dateRange || { type: 'rolling', offsetDays: 1 }
  );
}

export default function EditWorkflowPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const workflowId = params.id;
  const [formData, setFormData] = useState<WorkflowFormData>(defaultFormData);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [teamId, setTeamId] = useState<string | undefined>(undefined);
  const [sharedTeamIds, setSharedTeamIds] = useState<string[]>([]);
  const [canShareWorkflows, setCanShareWorkflows] = useState(false);
  const [hasTeamReadAll, setHasTeamReadAll] = useState(false);
  const permissionsQuery = usePermissions();
  const teamsQuery = useTeams(hasTeamReadAll);

  const sanitizeTeamId = (value?: string | null) => {
    if (!value || value === 'ALL_TEAMS') return undefined;
    return value;
  };

  const filterSharedForSave = (ids: string[], owner?: string | null | undefined) => {
    const ownerClean = sanitizeTeamId(owner);
    return ids.filter((id) => id && id !== ownerClean);
  };

  const toggleSharedTeam = (id: string) => {
    setSharedTeamIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  useEffect(() => {
    const perms = permissionsQuery.data;
    if (perms && Array.isArray(perms)) {
      setCanShareWorkflows(perms.includes('workflow.share'));
      setHasTeamReadAll(perms.includes('team.read_all') || perms.includes('permission.assign'));
    }

    const list = (teamsQuery.data || []) as { id: string; name: string }[];
    setTeams(list);
  }, [permissionsQuery.data, teamsQuery.data]);

  const computeCron = (data: WorkflowFormData) => {
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

  useEffect(() => {
    const fetchWorkflow = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/workflows/${workflowId}`);
        const wf: Workflow = res.data;
        setWorkflow(wf);
        const dateRange = extractDateRange(wf.config || {});

        // derive friendly schedule
        const scheduleType: 'manual' | 'scheduled' = wf.schedule ? 'scheduled' : 'manual';
        let scheduleUnit: 'minutes' | 'hours' | 'days' = 'days';
        let everyMinutes = 15;
        let everyHours = 6;
        let atMinutes = 0;
        let everyDays = 1;
        let atHours = 2;
        if (wf.schedule) {
          const parts = wf.schedule.trim().split(/\s+/);
          if (parts.length === 5) {
            const [mStr, hStr, domStr] = parts;
            const minuteNum = parseInt(mStr.replace('*/', '')) || 0;
            const hourNum = parseInt(hStr.replace('*/', '')) || 0;
            const dayNum = parseInt(domStr.replace('*/', '')) || 0;
            // Detect minutes pattern "*/N * * * *"
            if (mStr.startsWith('*/') && hStr === '*' && domStr === '*') {
              scheduleUnit = 'minutes';
              everyMinutes = Math.min(59, Math.max(1, minuteNum || 15));
            } else if (hStr.startsWith('*/') && domStr === '*') {
              scheduleUnit = 'hours';
              everyHours = Math.min(23, Math.max(1, hourNum || 6));
              atMinutes = Math.min(59, Math.max(0, parseInt(mStr) || 0));
            } else if (domStr.startsWith('*/')) {
              scheduleUnit = 'days';
              everyDays = Math.min(31, Math.max(1, dayNum || 1));
              atHours = Math.min(23, Math.max(0, parseInt(hStr) || 0));
              atMinutes = Math.min(59, Math.max(0, parseInt(mStr) || 0));
            }
          }
        }

        setFormData({
          name: wf.name,
          description: wf.description || '',
          enabled: wf.enabled,
          schedule: wf.schedule || '',
          scheduleType,
          scheduleUnit,
          everyMinutes,
          everyHours,
          atMinutes,
          everyDays,
          atHours,
          dateRangeType: dateRange.type || 'rolling',
          offsetDays: dateRange.offsetDays ?? 1,
          days: dateRange.days ?? 7,
          since: dateRange.since ?? '',
          until: dateRange.until ?? '',
          metaEnabled: wf.config?.sources?.meta?.enabled ?? true,
          posEnabled: wf.config?.sources?.pos?.enabled ?? true,
          metaDelayMs: wf.config?.rateLimit?.metaDelayMs ?? 3000,
          posDelayMs: wf.config?.rateLimit?.posDelayMs ?? 3000,
        });
        setTeamId(sanitizeTeamId(wf.teamId) || undefined);
        setSharedTeamIds(filterSharedForSave(wf.sharedTeamIds || [], wf.teamId));
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to load workflow');
      } finally {
        setIsLoading(false);
      }
    };
    fetchWorkflow();
  }, [workflowId]);

  useEffect(() => {
    setSharedTeamIds((prev) => filterSharedForSave(prev, teamId));
  }, [teamId]);

  useEffect(() => {
    if (formData.scheduleType !== 'scheduled') return;
    const cron = computeCron(formData);
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

  useEffect(() => {
    if (!teamId && teams.length > 0) {
      const firstId = teams[0]?.id;
      if (firstId) {
        setTeamId(firstId);
      }
    }
  }, [teams, teamId]);

  const updateField = (field: keyof WorkflowFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = () => {
    let dateRange: any;
    if (formData.dateRangeType === 'rolling') {
      dateRange = { type: 'rolling', offsetDays: formData.offsetDays };
    } else if (formData.dateRangeType === 'relative') {
      dateRange = { type: 'relative', days: formData.days };
    } else {
      dateRange = { type: 'absolute', since: formData.since, until: formData.until };
    }

    const payload: any = {
      name: formData.name,
      description: formData.description || undefined,
      enabled: formData.enabled,
      schedule: formData.scheduleType === 'scheduled' ? formData.schedule || null : null,
      ...(sanitizeTeamId(teamId) ? { teamId: sanitizeTeamId(teamId) } : {}),
      config: {
        dateRange,
        sources: {
          meta: { enabled: formData.metaEnabled },
          pos: { enabled: formData.posEnabled },
        },
        rateLimit: {
          metaDelayMs: formData.metaDelayMs,
          posDelayMs: formData.posDelayMs,
        },
      },
    };

    if (canShareWorkflows) {
      payload.sharedTeamIds = filterSharedForSave(sharedTeamIds, sanitizeTeamId(teamId));
    }

    return payload;
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (formData.scheduleType === 'manual') {
        payload.schedule = null;
      }
      await apiClient.patch(`/workflows/${workflowId}`, payload);
      router.push(`/workflows/${workflowId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update workflow');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <p className="text-sm text-red-600">Workflow not found.</p>
        <Link
          href="/workflows"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
        >
          ← Back to Workflows
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-indigo-600">Workflow Settings</p>
          <h2 className="text-2xl font-semibold text-slate-900">Edit Workflow</h2>
          <p className="text-sm text-slate-600">
            Update schedule, sources, and date range without leaving the live view.
          </p>
        </div>
        <Link
          href={`/workflows/${workflowId}`}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
        >
          ← Back
        </Link>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid gap-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Basic Information</h3>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Workflow Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
              <label className="block text-sm font-medium text-slate-700">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />

              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-slate-700">Team</label>
                <select
                  value={teamId || ''}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
                >
                  {teams.length === 0 && <option value="">No teams</option>}
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {canShareWorkflows && (
                <div className="mt-4 space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Share with teams</label>
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
                    {teams.filter((t) => t.id !== sanitizeTeamId(teamId)).length === 0 ? (
                      <p className="text-sm text-slate-500">No other teams available</p>
                    ) : (
                      teams
                        .filter((t) => t.id !== sanitizeTeamId(teamId))
                        .map((t) => (
                          <label key={t.id} className="flex items-center gap-2 text-sm text-slate-800">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              checked={sharedTeamIds.includes(t.id)}
                              onChange={() => toggleSharedTeam(t.id)}
                            />
                            <span>{t.name}</span>
                          </label>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-indigo-600">Status</p>
                <p className="text-sm text-slate-700">
                  {formData.enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => updateField('enabled', e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700">Workflow enabled</span>
              </label>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-indigo-600">Schedule</p>
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex gap-2">
                  {(['minutes', 'hours', 'days'] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => updateField('scheduleUnit', unit)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        formData.scheduleUnit === unit ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {unit === 'minutes' ? 'Minutes' : unit === 'hours' ? 'Hours' : 'Days'}
                    </button>
                  ))}
                </div>

                {formData.scheduleUnit === 'minutes' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Every (minutes)</label>
                    <input
                      type="number"
                      min={1}
                      max={59}
                      value={formData.everyMinutes}
                      onChange={(e) => updateField('everyMinutes', Math.max(1, Math.min(59, parseInt(e.target.value) || 1)))}
                      className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}

                {formData.scheduleUnit === 'hours' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700">Every (hours)</label>
                      <input
                        type="number"
                        min={1}
                        max={23}
                        value={formData.everyHours}
                        onChange={(e) => updateField('everyHours', Math.max(1, Math.min(23, parseInt(e.target.value) || 1)))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">At minute</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={formData.atMinutes}
                        onChange={(e) => updateField('atMinutes', Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {formData.scheduleUnit === 'days' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700">Every (days)</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={formData.everyDays}
                        onChange={(e) => updateField('everyDays', Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">At hour</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={formData.atHours}
                        onChange={(e) => updateField('atHours', Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">At minute</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={formData.atMinutes}
                        onChange={(e) => updateField('atMinutes', Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="text-xs text-slate-700">
                  <span className="font-medium">Runs: </span>
                  {formData.scheduleUnit === 'minutes' &&
                    `Every ${formData.everyMinutes} minute${formData.everyMinutes === 1 ? '' : 's'}`}
                  {formData.scheduleUnit === 'hours' &&
                    `Every ${formData.everyHours} hour${formData.everyHours === 1 ? '' : 's'} at minute ${formData.atMinutes}`}
                  {formData.scheduleUnit === 'days' &&
                    `Every ${formData.everyDays} day${formData.everyDays === 1 ? '' : 's'} at ${String(formData.atHours).padStart(2, '0')}:${String(formData.atMinutes).padStart(2, '0')}`}
                </div>
                <p className="text-[11px] text-slate-500">Cron generated: <span className="font-mono">{formData.schedule}</span></p>
              </div>
              <p className="text-xs text-slate-500">Cron is derived automatically; manual override not needed.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Date Range</h3>
              <span className="text-xs text-slate-500">Applies to Meta & POS</span>
            </div>

            <div className="flex gap-2">
              {(['rolling', 'relative', 'absolute'] as DateRangeType[]).map((type) => {
                const active = formData.dateRangeType === type;
                return (
                  <button
                    key={type}
                    onClick={() => updateField('dateRangeType', type)}
                    className={`flex-1 rounded-lg border px-4 py-2 text-sm capitalize transition ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            {formData.dateRangeType === 'rolling' && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <label className="text-sm font-medium text-slate-700">Offset Days</label>
                <input
                  type="number"
                  min={0}
                  value={formData.offsetDays}
                  onChange={(e) => updateField('offsetDays', parseInt(e.target.value) || 0)}
                  className="w-32 rounded-lg border border-slate-200 bg-white px-4 py-2 focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500">0 = today, 1 = yesterday</p>
              </div>
            )}

            {formData.dateRangeType === 'relative' && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <label className="text-sm font-medium text-slate-700">Last N Days</label>
                <input
                  type="number"
                  min={1}
                  value={formData.days}
                  onChange={(e) => updateField('days', parseInt(e.target.value) || 1)}
                  className="w-32 rounded-lg border border-slate-200 bg-white px-4 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {formData.dateRangeType === 'absolute' && (
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Since</label>
                  <input
                    type="date"
                    value={formData.since}
                    onChange={(e) => updateField('since', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Until</label>
                  <input
                    type="date"
                    value={formData.until}
                    onChange={(e) => updateField('until', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Sources & Rate Limits</h3>
              <span className="text-xs text-slate-500">Control API pacing</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">Meta Ads</div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.metaEnabled}
                      onChange={(e) => updateField('metaEnabled', e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-xs text-slate-600">Enabled</span>
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Rate Limit Delay (ms)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.metaDelayMs}
                    onChange={(e) => updateField('metaDelayMs', parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">Pancake POS</div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.posEnabled}
                      onChange={(e) => updateField('posEnabled', e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-xs text-slate-600">Enabled</span>
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Rate Limit Delay (ms)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.posDelayMs}
                    onChange={(e) => updateField('posDelayMs', parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/workflows/${workflowId}`}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-white transition"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:bg-indigo-400 transition"
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
