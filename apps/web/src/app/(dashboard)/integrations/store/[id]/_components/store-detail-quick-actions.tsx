'use client';

import { Button } from '@/components/ui/button';
import { Building2, DollarSign, RefreshCcw, Tags } from 'lucide-react';

interface StoreDetailQuickActionsProps {
  isSyncingProducts: boolean;
  isSyncingTags: boolean;
  isSyncingWarehouses: boolean;
  onSetInitialOffer: () => void;
  onSyncProducts: () => void;
  onSyncTags: () => void;
  onSyncWarehouses: () => void;
}

export function StoreDetailQuickActions({
  isSyncingProducts,
  isSyncingTags,
  isSyncingWarehouses,
  onSetInitialOffer,
  onSyncProducts,
  onSyncTags,
  onSyncWarehouses,
}: StoreDetailQuickActionsProps) {
  return (
    <section className="panel panel-content">
      <div className="panel-header">
        <RefreshCcw className="h-3.5 w-3.5 text-primary" />
        <h4 className="panel-title">Quick Actions</h4>
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <Button
          variant="outline"
          size="sm"
          iconLeft={<DollarSign className="h-3.5 w-3.5" />}
          onClick={onSetInitialOffer}
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
        >
          {isSyncingWarehouses ? 'Syncing...' : 'Sync Warehouses'}
        </Button>
      </div>
    </section>
  );
}

