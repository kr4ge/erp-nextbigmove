'use client';

import {
  type ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Workflow } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable, DataTableState } from '@/components/data-table';
import type { WorkflowItem } from '../_types/workflow';
import { getDateRangeLabel } from '../_utils/workflow-formatters';
import { WorkflowActionsMenu } from './workflow-actions-menu';
import { WorkflowStatusBadge } from './workflow-status-badge';

interface WorkflowsTableProps {
  workflows: WorkflowItem[];
  teamNames: Record<string, string>;
  runningById: Record<string, boolean>;
  onView: (workflow: WorkflowItem) => void;
  onSettings: (workflow: WorkflowItem) => void;
  onRun: (workflow: WorkflowItem) => void;
  onCreateWorkflow: () => void;
}

export function WorkflowsTable({
  workflows,
  teamNames,
  runningById,
  onView,
  onSettings,
  onRun,
  onCreateWorkflow,
}: WorkflowsTableProps) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const columns = useMemo<ColumnDef<WorkflowItem>[]>(
    () => [
      {
        id: 'workflow',
        header: 'Workflow',
        cell: ({ row }) => {
          const workflow = row.original;
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <WorkflowStatusBadge workflow={workflow} />
                <span className="text-sm font-semibold text-[#0F172A]">{workflow.name}</span>
              </div>
              {workflow.description ? (
                <p className="text-sm text-[#475569]">{workflow.description}</p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'team',
        header: 'Team',
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#475569]">
            {row.original.teamId ? `Team: ${teamNames[row.original.teamId] || row.original.teamId}` : 'All teams'}
          </span>
        ),
      },
      {
        id: 'schedule',
        header: 'Schedule',
        cell: ({ row }) => row.original.schedule || 'Manual only',
      },
      {
        id: 'sources',
        header: 'Sources',
        cell: ({ row }) => {
          const metaEnabled = Boolean(row.original.config?.sources?.meta?.enabled);
          const posEnabled = Boolean(row.original.config?.sources?.pos?.enabled);
          return (
            <div className="flex flex-col gap-1 text-sm">
              <div className="text-[#475569]">
                <span className="font-medium">Meta:</span>{' '}
                <span className={metaEnabled ? 'text-emerald-600' : 'text-slate-400'}>
                  {metaEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="text-[#475569]">
                <span className="font-medium">POS:</span>{' '}
                <span className={posEnabled ? 'text-emerald-600' : 'text-slate-400'}>
                  {posEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'dateRange',
        header: 'Date Range',
        cell: ({ row }) => (
          <span className="text-sm text-[#475569]">{getDateRangeLabel(row.original)}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        meta: {
          align: 'right',
          cellClassName: 'w-[72px]',
          headerClassName: 'w-[72px]',
        },
        cell: ({ row }) => (
          <WorkflowActionsMenu
            workflow={row.original}
            isRunning={Boolean(runningById[row.original.id])}
            onView={onView}
            onSettings={onSettings}
            onRun={onRun}
          />
        ),
      },
    ],
    [onRun, onSettings, onView, runningById, teamNames],
  );

  const table = useReactTable({
    data: workflows,
    columns,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <DataTable
      table={table}
      totalRows={workflows.length}
      showPagination={workflows.length > pagination.pageSize}
      emptyState={
        <DataTableState
          title="No workflows yet"
          description="Create your first workflow to automate data fetching."
          icon={<Workflow className="h-6 w-6 text-primary" />}
          action={
            <Button
              variant="primary"
              onClick={onCreateWorkflow}
            >
              Create Workflow
            </Button>
          }
        />
      }
    />
  );
}
