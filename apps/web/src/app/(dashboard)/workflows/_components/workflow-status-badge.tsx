'use client';

import type { WorkflowItem } from '../_types/workflow';

export function WorkflowStatusBadge({ workflow }: { workflow: WorkflowItem }) {
  if (!workflow.enabled) {
    return (
      <span className="pill pill-neutral inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#94A3B8]" />
        Disabled
      </span>
    );
  }

  if (workflow.schedule) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
        <span className="h-2 w-2 rounded-full bg-success" />
        Enabled
      </span>
    );
  }

  return (
    <span className="pill pill-info inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-info/60" />
      Manual
    </span>
  );
}
