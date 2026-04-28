'use client';

import { Plus, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { WorkflowsTable } from './_components/workflows-table';
import { ManualMetaUploadModal } from './_components/manual-meta-upload-modal';
import { useWorkflowsController } from './_hooks/use-workflows-controller';

export default function WorkflowsPage() {
  const {
    workflows,
    isLoading,
    error,
    runningById,
    teamNames,
    metaIntegrations,
    showUploadModal,
    selectedIntegrationId,
    selectedUploadFile,
    isUploadingMeta,
    manualUploadJob,
    manualUploadError,
    handleRunWorkflow,
    openUploadModal,
    closeUploadModal,
    setSelectedIntegrationId,
    setSelectedUploadFile,
    handleUploadMeta,
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
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            iconLeft={<Upload className="h-4 w-4" />}
            onClick={openUploadModal}
          >
            Upload Meta
          </Button>
          <Button
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={navigateToNew}
          >
            Create Workflow
          </Button>
        </div>
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

      <ManualMetaUploadModal
        isOpen={showUploadModal}
        integrations={metaIntegrations}
        selectedIntegrationId={selectedIntegrationId}
        selectedFile={selectedUploadFile}
        isUploading={isUploadingMeta}
        uploadJob={manualUploadJob}
        uploadError={manualUploadError}
        onClose={closeUploadModal}
        onIntegrationChange={setSelectedIntegrationId}
        onFileChange={setSelectedUploadFile}
        onSubmit={handleUploadMeta}
      />
    </div>
  );
}
