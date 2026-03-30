'use client';

import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { WorkflowsTable } from './_components/workflows-table';
import { useWorkflowsController } from './_hooks/use-workflows-controller';

export default function WorkflowsPage() {
  const {
    workflows,
    isLoading,
    error,
    runningById,
    teamNames,
    handleRunWorkflow,
    navigateToNew,
    navigateToView,
    navigateToSettings,
  } = useWorkflowsController();

  if (isLoading) {
    return <LoadingCard label="Loading workflows..." />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Workflows"
          description="Automate Meta Ads and POS data fetching on a schedule"
        />
        <AlertBanner tone="error" message={`Error: ${error}`} className="text-base" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Workflows"
          description="Automate Meta Ads and POS data fetching on a schedule"
        />
        <Button
          iconLeft={<Plus className="h-4 w-4" />}
          onClick={navigateToNew}
        >
          Create Workflow
        </Button>
      </div>

      <WorkflowsTable
        workflows={workflows}
        teamNames={teamNames}
        runningById={runningById}
        onCreateWorkflow={navigateToNew}
        onView={navigateToView}
        onSettings={navigateToSettings}
        onRun={(workflow) => handleRunWorkflow(workflow.id)}
      />
    </div>
  );
}
