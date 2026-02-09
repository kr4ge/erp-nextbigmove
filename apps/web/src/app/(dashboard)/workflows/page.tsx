'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { MoreHorizontal, Play, Eye, Settings, Plus, Workflow } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/emptystate';
import { useToast } from '@/components/ui/toast';

const getSelectedTeamIds = () => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('current_team_ids');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((t) => typeof t === 'string' && t.length > 0);
      }
    } catch {
      // ignore
    }
  }
  const single = localStorage.getItem('current_team_id');
  return single && single !== 'ALL_TEAMS' ? [single] : [];
};

interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule?: string;
  config: any;
  createdAt: string;
  updatedAt: string;
  teamId?: string | null;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  useEffect(() => {
    // Load team names for badges
    const fetchTeams = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        if (!token) return;
        const res =
          (await apiClient
            .get('/teams', { headers: { Authorization: `Bearer ${token}` } })
            .catch(() => apiClient.get('/teams/my-teams', { headers: { Authorization: `Bearer ${token}` } })));
        const list = res?.data || [];
        const map: Record<string, string> = {};
        list.forEach((t: any) => {
          if (t.id && t.name) map[t.id] = t.name;
        });
        setTeamNames(map);
      } catch {
        setTeamNames({});
      }
    };
    fetchTeams();
  }, []);

  useEffect(() => {
    const selected = getSelectedTeamIds();
    setSelectedTeamIds(selected);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'current_team_ids' || e.key === 'current_team_id') {
        const next = getSelectedTeamIds();
        setSelectedTeamIds(next);
        fetchWorkflows();
      }
    };
    const onTeamScope = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const arr = Array.isArray(detail) ? detail : [];
      setSelectedTeamIds(arr);
      fetchWorkflows();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('teamScopeChanged', onTeamScope as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('teamScopeChanged', onTeamScope as EventListener);
    };
  }, []);

  const fetchWorkflows = async () => {
    try {
      const response = await apiClient.get('/workflows');
      setWorkflows(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch workflows');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunWorkflow = async (workflowId: string) => {
    if (running[workflowId]) return;
    setRunning((prev) => ({ ...prev, [workflowId]: true }));
    try {
      const response = await apiClient.post(`/workflows/${workflowId}/trigger`, {});
      router.push(`/workflows/${workflowId}`);
      return response;
    } catch (err: any) {
      addToast(
        'error',
        err.response?.data?.message || err.message || 'Failed to trigger workflow',
      );
    } finally {
      setRunning((prev) => ({ ...prev, [workflowId]: false }));
    }
  };

  const getStatusBadge = (workflow: WorkflowItem) => {
    if (!workflow.enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#64748B]">
          <span className="h-2 w-2 rounded-full bg-[#94A3B8]"></span>
          Disabled
        </span>
      );
    }
    if (workflow.schedule) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-2.5 py-1 text-xs font-medium text-[#10B981]">
          <span className="h-2 w-2 rounded-full bg-[#10B981]"></span>
          Enabled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#2563EB]">
        <span className="h-2 w-2 rounded-full bg-[#2563EB]"></span>
        Manual
      </span>
    );
  };

  const getDateRangeLabel = (workflow: WorkflowItem) => {
    const dateRange =
      workflow.config?.dateRange ||
      workflow.config?.sources?.meta?.dateRange ||
      workflow.config?.sources?.pos?.dateRange;

    if (!dateRange) return 'Not configured';

    switch (dateRange.type) {
      case 'rolling':
        return `Yesterday (Rolling, offset ${dateRange.offsetDays ?? 0})`;
      case 'relative':
        return `Last ${dateRange.days} days (Relative)`;
      case 'absolute':
        return `${dateRange.since} to ${dateRange.until} (Absolute)`;
      default:
        return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <Card className="py-12 text-center text-[#475569]">
        Loading workflows...
      </Card>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Workflows"
          description="Automate Meta Ads and POS data fetching on a schedule"
        />
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="Workflows"
          description="Automate Meta Ads and POS data fetching on a schedule"
        />
        <Link href="/workflows/new">
          <Button iconLeft={<Plus className="h-4 w-4" />}>
            Create Workflow
          </Button>
        </Link>
      </div>

      {/* Workflows List */}
      {workflows.length === 0 ? (
        <EmptyState
          title="No workflows yet"
          description="Create your first workflow to automate data fetching"
          actionLabel="Create Workflow"
          onAction={() => router.push('/workflows/new')}
          icon={<Workflow className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <Card
              key={workflow.id}
              className="transition-all hover:border-[#CBD5E1] hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    {getStatusBadge(workflow)}
                    <h3 className="text-lg font-semibold text-[#0F172A]">{workflow.name}</h3>
                  </div>

                  <div className="mb-2">
                    <span className="inline-flex items-center rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#475569]">
                      {workflow.teamId
                        ? `Team: ${teamNames[workflow.teamId] || workflow.teamId}`
                        : 'All teams'}
                    </span>
                  </div>

                  {workflow.description && (
                    <p className="mb-3 text-sm text-[#475569]">{workflow.description}</p>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-[#475569]">
                    <div>
                      <span className="font-medium">Schedule:</span>{' '}
                      {workflow.schedule || 'Manual only'}
                    </div>
                    <div>
                      <span className="font-medium">Meta:</span>{' '}
                      {workflow.config?.sources?.meta?.enabled ? (
                        <span className="text-[#10B981]">Enabled</span>
                      ) : (
                        <span className="text-[#94A3B8]">Disabled</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium">POS:</span>{' '}
                      {workflow.config?.sources?.pos?.enabled ? (
                        <span className="text-[#10B981]">Enabled</span>
                      ) : (
                        <span className="text-[#94A3B8]">Disabled</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-[#94A3B8]">
                    Date Range: {getDateRangeLabel(workflow)}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="ml-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#0F172A] hover:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2563EB]"
                      aria-label="Workflow actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => router.push(`/workflows/${workflow.id}`)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push(`/workflows/${workflow.id}/edit`)}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleRunWorkflow(workflow.id)}
                      disabled={running[workflow.id]}
                      className={`flex items-center gap-2 ${running[workflow.id] ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <Play className="h-4 w-4" />
                      {running[workflow.id] ? 'Starting...' : 'Run Now'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
