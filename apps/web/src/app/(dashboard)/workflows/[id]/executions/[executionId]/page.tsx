'use client';

import { LiveExecutionMonitor } from '@/components/workflows/live-execution-monitor';

export default function ExecutionDetailPage({ params }: { params: { executionId: string } }) {
  const { executionId } = params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Execution Details</h1>
        <p className="text-sm text-slate-600">Execution ID: {executionId}</p>
      </div>

      <LiveExecutionMonitor executionId={executionId} />
    </div>
  );
}
