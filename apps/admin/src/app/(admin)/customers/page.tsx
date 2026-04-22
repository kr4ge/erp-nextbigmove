import { ModulePlaceholder } from '../_components/module-placeholder';

export default function CustomersPage() {
  return (
    <ModulePlaceholder
      eyebrow="Future"
      title="Customers"
      description="Customer-facing order context and service notes can surface here without changing stock truth."
      milestones={[
        'Order contact view',
        'Address context',
        'Service notes',
        'Issue flags',
      ]}
    />
  );
}
