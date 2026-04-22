import { ModulePlaceholder } from '../_components/module-placeholder';

export default function HelpPage() {
  return (
    <ModulePlaceholder
      eyebrow="Future"
      title="Help Center"
      description="Runbooks, operator guides, and quick references for warehouse flows will be published here."
      milestones={[
        'Runbooks',
        'Scan guides',
        'Role guides',
        'Support links',
      ]}
    />
  );
}
