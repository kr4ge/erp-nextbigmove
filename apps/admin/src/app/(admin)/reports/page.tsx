import { ModulePlaceholder } from '../_components/module-placeholder';

export default function ReportsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Future"
      title="Forecast"
      description="Demand planning and forecast preparation will stay isolated here until it moves into ERP purchasing."
      milestones={[
        'Demand inputs',
        'Forecast snapshots',
        'Request preparation',
        'ERP handoff',
      ]}
    />
  );
}
