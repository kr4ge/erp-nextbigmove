'use client';

import { Button } from '@/components/ui/button';
import { Building2, DollarSign, RefreshCcw, Tags, Target } from 'lucide-react';

interface StoreDetailQuickActionsProps {
  isSyncingProducts: boolean;
  isSyncingTags: boolean;
  isSyncingWarehouses: boolean;
  onSetInitialOffer: () => void;
  /** Opens the creative targets modal; omitted when the viewer cannot read them. */
  onSetCreativeTargets?: () => void;
  onSyncProducts: () => void;
  onSyncTags: () => void;
  onSyncWarehouses: () => void;
}

export function StoreDetailQuickActions({
  isSyncingProducts,
  isSyncingTags,
  isSyncingWarehouses,
  onSetInitialOffer,
  onSetCreativeTargets,
  onSyncProducts,
  onSyncTags,
  onSyncWarehouses,
}: StoreDetailQuickActionsProps) {
  return (
    <section className="panel panel-content">
      <div className="panel-header">
        <RefreshCcw className="panel-icon" />
        <h4 className="panel-title">Quick Actions</h4>
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3">
        {onSetCreativeTargets ? (
          <Button
            variant="outline"
            size="sm"
            iconLeft={<Target className="h-3.5 w-3.5" />}
            onClick={onSetCreativeTargets}
            className='btn-icon'
          >
            Creative Targets
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          iconLeft={<DollarSign className="h-3.5 w-3.5" />}
          onClick={onSetInitialOffer}
          className='btn-icon'
        >
          Set Initial Offer
        </Button>
        <Button
          variant="outline"
          size="sm"
          iconLeft={<RefreshCcw className="h-3.5 w-3.5" />}
          onClick={onSyncProducts}
          disabled={isSyncingProducts}
          loading={isSyncingProducts}
          className='btn-icon'
        >
          {isSyncingProducts ? 'Syncing...' : 'Sync Products'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          iconLeft={<Tags className="h-3.5 w-3.5" />}
          onClick={onSyncTags}
          disabled={isSyncingTags}
          loading={isSyncingTags}
          className='btn-icon'
        >
          {isSyncingTags ? 'Syncing...' : 'Sync Tags'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          iconLeft={<Building2 className="h-3.5 w-3.5" />}
          onClick={onSyncWarehouses}
          disabled={isSyncingWarehouses}
          loading={isSyncingWarehouses}
          className='btn-icon'
        >
          {isSyncingWarehouses ? 'Syncing...' : 'Sync Warehouses'}
        </Button>
      </div>
    </section>
  );
}

