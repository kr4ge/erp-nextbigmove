import { ModulePlaceholder } from '../_components/module-placeholder';

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Future"
      title="Settings"
      description="WMS configuration, permissions, scanner behavior, and warehouse defaults will be managed here."
      milestones={[
        'Permission sets',
        'Warehouse defaults',
        'Scanner rules',
        'Module config',
      ]}
    />
  );
}
