import { ModulePlaceholder } from '../_components/module-placeholder';

export default function TrackingPage() {
  return (
    <ModulePlaceholder
      eyebrow="Future"
      title="RTS"
      description="Returned units, disposition routing, and restock versus damage decisions will be monitored here."
      milestones={[
        'Return intake',
        'Disposition routing',
        'Restock path',
        'Damage path',
      ]}
    />
  );
}
