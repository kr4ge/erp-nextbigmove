'use client';

import type { WorkflowItem } from '../_types/workflow';

export function WorkflowStatusBadge({ workflow }: { workflow: WorkflowItem }) {
  if (!workflow.enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#64748B]">
        <span className="h-2 w-2 rounded-full bg-[#94A3B8]" />
        Disabled
      </span>
    );
  }

  if (workflow.schedule) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-2.5 py-1 text-xs font-medium text-[#10B981]">
        <span className="h-2 w-2 rounded-full bg-[#10B981]" />
        Enabled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#2563EB]">
      <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
      Manual
    </span>
  );
}
