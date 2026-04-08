import { WmsModulePlaceholder } from '../_components/wms-module-placeholder';

export default function FulfillmentPage() {
  return (
    <WmsModulePlaceholder
      title="Fulfillment"
      description="Pick, pack, and dispatch operations linked to imported ecommerce orders while preserving operator accountability and scan checkpoints."
      milestones={[
        'Link WMS tasks to imported partner orders',
        'Assign picker and packer stages to named users',
        'Validate the flow with simulated scanning first',
      ]}
      nextStep="Build fulfillment only after inventory truth and receiving are complete."
    />
  );
}
