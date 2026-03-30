'use client';

import { Button } from '@/components/ui/button';

interface IntegrationDetailActionsProps {
  isSaving: boolean;
  isTesting: boolean;
  enabled: boolean;
  onTestConnection: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}

export function IntegrationDetailActions({
  isSaving,
  isTesting,
  enabled,
  onTestConnection,
  onToggleEnabled,
  onDelete,
}: IntegrationDetailActionsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button type="submit" disabled={isSaving} loading={isSaving} className="flex-1">
        {isSaving ? 'Saving...' : 'Save Changes'}
      </Button>

      <Button
        type="button"
        variant="secondary"
        onClick={onTestConnection}
        disabled={isTesting}
        loading={isTesting}
        className="flex-1"
      >
        {isTesting ? 'Testing...' : 'Test Connection'}
      </Button>

      <Button type="button" variant="secondary" onClick={onToggleEnabled} className="flex-1">
        {enabled ? 'Disable' : 'Enable'}
      </Button>

      <Button type="button" variant="danger" onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}
