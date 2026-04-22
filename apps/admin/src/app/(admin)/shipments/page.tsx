import { ModulePlaceholder } from '../_components/module-placeholder';

export default function ShipmentsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Phase 7"
      title="Dispatch"
      description="Waybill attachment, dispatch staging, courier pickup, and shipped-state confirmation will live here."
      milestones={[
        'Waybill sync',
        'Dispatch staging',
        'Courier handoff',
        'Shipped sync',
      ]}
    />
  );
}
