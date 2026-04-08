import { WmsModulePlaceholder } from '../_components/wms-module-placeholder';

export default function RtsPage() {
  return (
    <WmsModulePlaceholder
      title="RTS"
      description="Manage return-to-sender intake, damage routing, quarantine, and return-to-stock decisions with full stock footprint tracking."
      milestones={[
        'Receive RTS parcels into WMS',
        'Classify stock as sellable, damaged, or quarantine',
        'Post quantity and cost consequences back to ledger and billing',
      ]}
      nextStep="Use RTS as the closure point of the stock lifecycle after delivery failure."
    />
  );
}
