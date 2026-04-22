import { ModulePlaceholder } from '../_components/module-placeholder';

export default function OrdersPage() {
  return (
    <ModulePlaceholder
      eyebrow="Phase 6"
      title="Fulfillment"
      description="Confirmed POS orders will flow here before picking, basket assignment, and packing."
      milestones={[
        'Order intake',
        'Pick queue',
        'Basket assignment',
        'Packing handoff',
      ]}
    />
  );
}
