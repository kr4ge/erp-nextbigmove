import { WmsModulePlaceholder } from '../_components/wms-module-placeholder';

export default function BillingPage() {
  return (
    <WmsModulePlaceholder
      title="Billing"
      description="Operational billing for partner stock purchases, warehouse fees, RTS costs, and payout calculations."
      milestones={[
        'Generate invoice lines from operational events',
        'Track partner payout summaries from fulfillment outcomes',
        'Keep billing derived from WMS source events, not manual summaries',
      ]}
      nextStep="Layer billing after inventory, fulfillment, and RTS events become stable."
    />
  );
}
