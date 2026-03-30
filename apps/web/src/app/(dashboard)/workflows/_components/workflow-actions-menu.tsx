'use client';

import { Eye, MoreHorizontal, Play, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTableActionCell } from '@/components/data-table';
import type { WorkflowItem } from '../_types/workflow';

interface WorkflowActionsMenuProps {
  workflow: WorkflowItem;
  isRunning: boolean;
  onView: (workflow: WorkflowItem) => void;
  onSettings: (workflow: WorkflowItem) => void;
  onRun: (workflow: WorkflowItem) => void;
}

export function WorkflowActionsMenu({
  workflow,
  isRunning,
  onView,
  onSettings,
  onRun,
}: WorkflowActionsMenuProps) {
  return (
    <DataTableActionCell>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#0F172A] transition hover:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Workflow actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-2xl">
          <DropdownMenuItem
            onClick={() => onView(workflow)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onSettings(workflow)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onRun(workflow)}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Starting...' : 'Run Now'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </DataTableActionCell>
  );
}
