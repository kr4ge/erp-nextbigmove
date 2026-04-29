'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { LiveExecutionMonitor } from '@/components/workflows/live-execution-monitor';
import { useExecutionStore } from '@/stores/workflow-execution-store';
import { Activity, ArrowBigLeft, CalendarClock, Settings, SlidersHorizontal } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

type WorkflowDateRange = {
  type?: 'rolling' | 'relative' | 'absolute';
  offsetDays?: number;
  days?: number;
  since?: string;
  until?: string;
};

type WorkflowConfig = {
  dateRange?: WorkflowDateRange;
  sources?: {
    meta?: { enabled?: boolean; dateRange?: WorkflowDateRange };
    pos?: { enabled?: boolean; dateRange?: WorkflowDateRange };
  };
  rateLimit?: {
    metaDelayMs?: number;
    posDelayMs?: number;
  };
};

type WorkflowExecutionError = {
  date?: string;
  source?: string;
  accountId?: string;
  shopId?: string;
  error?: string;
  message?: string;
};

interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule?: string | null;
  config: WorkflowConfig;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
}

interface WorkflowExecution {
  id: string;
  status: string;
  triggerType: string;
  dateRangeSince?: string;
  dateRangeUntil?: string;
  totalDays: number;
  daysProcessed: number;
  metaFetched: number;
  posFetched: number;
  errors: WorkflowExecutionError[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

function parseErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const maybeError = error as {
    response?: { data?: { message?: unknown } };
    message?: unknown;
  };
  const responseMessage = maybeError.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) return responseMessage;
  if (typeof maybeError.message === 'string' && maybeError.message.trim().length > 0) return maybeError.message;
  return fallback;
}

function getDateRangeLabel(workflow?: Workflow) {
  const dateRange =
    workflow?.config?.dateRange ||
    workflow?.config?.sources?.meta?.dateRange ||
    workflow?.config?.sources?.pos?.dateRange;

  if (!dateRange) return 'Not configured';

  switch (dateRange.type) {
    case 'rolling':
      return `Rolling (offset ${dateRange.offsetDays ?? 0})`;
    case 'relative':
      return `Relative (last ${dateRange.days} days)`;
    case 'absolute':
      return `Absolute (${dateRange.since} to ${dateRange.until})`;
    default:
      return 'Unknown';
  }
}

function ExecutionCard({
  execution,
  onCancel,
  cancelling,
}: {
  execution: WorkflowExecution;
  onCancel: (id: string) => void;
  cancelling: Record<string, boolean>;
}) {
  const live = useExecutionStore((state) => state.executions[execution.id]);
  const status = live?.status || execution.status;
  const progressLabel = live?.progress
    ? `${live.progress.current}/${live.progress.total}`
    : `${execution.daysProcessed}/${execution.totalDays}`;
  const metaDisplay =
    live?.metaTotal !== undefined
      ? `${live?.metaProcessed || 0}/${live.metaTotal}`
      : live?.metaProcessed !== undefined
        ? `${live.metaProcessed}`
        : `${execution.metaFetched}`;
  const posDisplay =
    live?.posTotal !== undefined
      ? `${live?.posProcessed || 0}/${live.posTotal}`
      : live?.posProcessed !== undefined
        ? `${live.posProcessed}`
        : `${execution.posFetched}`;

  return (
    <div className="border border-slate-200 rounded-lg p-3 text-sm text-slate-700 space-y-2">
      <div className="flex flex-wrap gap-3 justify-between">
        <div>
          <div className="font-semibold text-slate-900">{status}</div>
          <div className="text-slate-500 text-xs">
            Trigger: {execution.triggerType} · Created {new Date(execution.createdAt).toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <div>
            {execution.dateRangeSince} → {execution.dateRangeUntil}
          </div>
          {status !== 'RUNNING' && (
            <div className="text-slate-500 text-xs">Processed {progressLabel} days</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-600">
        <span>Meta fetched: {metaDisplay}</span>
        <span>POS fetched: {posDisplay}</span>
      </div>

      {status === 'RUNNING' && (
        <div className="space-y-2">
          <LiveExecutionMonitor executionId={execution.id} />
          <div className="flex justify-end">
            <button
              onClick={() => onCancel(execution.id)}
              disabled={cancelling[execution.id]}
              className="px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 disabled:bg-slate-100 disabled:text-slate-400 transition"
            >
              {cancelling[execution.id] ? 'Cancelling…' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {execution.errors?.length > 0 && (
        <div className="mt-1 rounded border border-red-100 bg-red-50 p-2 text-xs text-red-700">
          <div className="font-semibold mb-1">Errors ({execution.errors.length})</div>
          <ul className="space-y-1">
            {execution.errors.map((err, idx) => (
              <li key={idx} className="leading-snug">
                {err.date ? `[${err.date}] ` : ''}
                {err.source ? `${err.source}: ` : ''}
                {err.accountId ? `acct ${err.accountId}: ` : ''}
                {err.shopId ? `shop ${err.shopId}: ` : ''}
                {err.error || JSON.stringify(err)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const { addToast } = useToast();
  const workflowId = params.id;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Record<string, boolean>>({});
  const [triggering, setTriggering] = useState(false);

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [workflowRes, execRes] = await Promise.all([
          apiClient.get(`/workflows/${workflowId}`),
          apiClient.get(`/workflows/${workflowId}/executions`),
        ]);
        setWorkflow(workflowRes.data);
        setExecutions(execRes.data || []);
      } catch (error: unknown) {
        setError(parseErrorMessage(error, 'Failed to load workflow'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [workflowId]);

  const cancelExecution = async (executionId: string) => {
    setCancelling((prev) => ({ ...prev, [executionId]: true }));
    setError(null);
    try {
      await apiClient.post(`/workflows/${workflowId}/executions/${executionId}/cancel`);
      const execRes = await apiClient.get(`/workflows/${workflowId}/executions`);
      setExecutions(execRes.data || []);
    } catch (error: unknown) {
      setError(parseErrorMessage(error, 'Failed to cancel execution'));
    } finally {
      setCancelling((prev) => ({ ...prev, [executionId]: false }));
    }
  };

  const triggerWorkflow = async () => {
    if (!workflowId) return;
    setTriggering(true);
    try {
      await apiClient.post(`/workflows/${workflowId}/trigger`, {});
      const execRes = await apiClient.get(`/workflows/${workflowId}/executions`);
      setExecutions(execRes.data || []);
    } catch (error: unknown) {
      addToast(
        'error',
        parseErrorMessage(error, 'Failed to trigger workflow'),
      );
    } finally {
      setTriggering(false);
    }
  };

  if (isLoading) {
    return <LoadingCard label="Loading workflow..." />;
  }

  if (error || !workflow) {
    return (
      <div className="space-y-4">
        <AlertBanner tone="error" message={error || 'Workflow not found'} />
        <Link
          href="/workflows"
          className="inline-flex items-center gap-2 btn btn-lg btn-primary"
          // "inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
        >
          <ArrowBigLeft className="h-4 w-4" />
          Back to Workflows
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs-tight font-semibold uppercase tracking-[0.2em] text-primary">Workflows</p>
          <div className="space-y-0.5">
            <h2 className="text-xl-loose font-semibold tracking-tight text-slate-900">{workflow.name}</h2>
            <p className="text-sm-custom text-slate-500">{workflow.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/workflows"
            className="inline-flex items-center gap-2 btn btn-md btn-ghost"
            // "inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100"
          >
            <ArrowBigLeft className="h-4 w-4" />
            Back
          </Link>
          <Link
            href={`/workflows/${workflowId}/edit`}
            className="inline-flex items-center gap-2 btn btn-md btn-primary-soft"
            // "inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="panel panel-content">
          <div className="panel-header">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">Configuration</h3>
          </div>
          <div className="space-y-3 p-4 text-sm text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-600">Status</span>
              <span className="font-medium">{workflow.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Schedule</span>
              <span className="font-medium">{workflow.schedule || 'Manual only'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Date Range</span>
              <span className="font-medium">{getDateRangeLabel(workflow)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Meta</span>
              <span className="font-medium">
                {workflow.config?.sources?.meta?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">POS</span>
              <span className="font-medium">
                {workflow.config?.sources?.pos?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        <div className="panel panel-content">
          <div className="panel-header">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">Rate Limits</h3>
          </div>
          <div className="space-y-3 p-4 text-sm text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-600">Meta delay (ms)</span>
              <span className="font-medium">{workflow.config?.rateLimit?.metaDelayMs || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">POS delay (ms)</span>
              <span className="font-medium">{workflow.config?.rateLimit?.posDelayMs || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Created</span>
              <span className="font-medium">
                {new Date(workflow.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Updated</span>
              <span className="font-medium">
                {new Date(workflow.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel panel-content p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="-mx-4 -mt-4 mb-3 flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
              Execution History
            </h3>
            <div className="mt-1 text-xs text-slate-500">
              <span className="mr-3">Last run: {formatDateTime(workflow.lastRunAt)}</span>
              <span className="mr-3">Next run: {formatDateTime(workflow.nextRunAt)}</span>
              {workflow.schedule && (
                <span className="text-slate-400">Schedule: {workflow.schedule}</span>
              )}
            </div>
          </div>
          <button
            onClick={triggerWorkflow}
            disabled={triggering}
            className="btn btn-md btn-primary-soft disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {triggering ? 'Starting…' : 'Trigger Execution'}
          </button>
        </div>

        {executions.length === 0 ? (
          <p className="text-sm text-slate-600">No executions yet.</p>
        ) : (
          <div className="space-y-3">
            {executions.map((execution) => (
              <ExecutionCard
                key={execution.id}
                execution={execution}
                onCancel={cancelExecution}
                cancelling={cancelling}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
