'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getProviderIcon } from '../utils';

interface IntegrationConnectionCardsProps {
  metaCount: number;
  posCount: number;
  onAddMeta: () => void;
  onAddPos: () => void;
}

export function IntegrationConnectionCards({
  metaCount,
  posCount,
  onAddMeta,
  onAddPos,
}: IntegrationConnectionCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            {getProviderIcon('META_ADS')}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#0F172A]">Meta Marketing API</h3>
            <p className="text-sm text-[#475569]">Connect your Meta ad accounts</p>
          </div>
        </div>
        <div className="py-4 text-center">
          <p className="mb-4 text-[#475569]">
            {metaCount === 0
              ? 'No APIs connected'
              : `${metaCount} API${metaCount > 1 ? 's' : ''} connected`}
          </p>
          <Button onClick={onAddMeta}>Add Meta API</Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            {getProviderIcon('PANCAKE_POS')}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#0F172A]">Pancake POS</h3>
            <p className="text-sm text-[#475569]">Connect your POS system</p>
          </div>
        </div>
        <div className="py-4 text-center">
          <p className="mb-4 text-[#475569]">
            {posCount === 0
              ? 'No stores connected'
              : `${posCount} store${posCount > 1 ? 's' : ''} connected`}
          </p>
          <Button onClick={onAddPos}>
            {posCount === 0 ? 'Connect Pancake POS' : 'Add Another Store'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
