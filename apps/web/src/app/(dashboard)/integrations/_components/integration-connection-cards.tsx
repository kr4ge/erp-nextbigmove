'use client';

import { Button } from '@/components/ui/button';
import { DashboardSection } from '../../dashboard/_components/dashboard-section';
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
      <DashboardSection
        title="Meta Marketing API"
        icon={<span className="text-primary [&>svg]:!h-3.5 [&>svg]:!w-3.5">{getProviderIcon('META_ADS')}</span>}
        contentClassName="space-y-4 p-4 sm:p-5"
      >
          <div className="space-y-1 text-center">
            <p className="text-[0.95rem] font-medium text-foreground">Connect your Meta ad accounts.</p>
            <p className="text-[0.9rem] text-slate-500 dark:text-slate-300">
              {metaCount === 0
                ? 'No APIs connected'
                : `${metaCount} API${metaCount > 1 ? 's' : ''} connected`}
            </p>
          </div>

          <Button
            onClick={onAddMeta}
            className="w-full"
          >
            Add Meta API
          </Button>
      </DashboardSection>

      <DashboardSection
        title="Pancake POS"
        icon={<span className="text-primary [&>svg]:!h-3.5 [&>svg]:!w-3.5">{getProviderIcon('PANCAKE_POS')}</span>}
        contentClassName="space-y-4 p-4 sm:p-5"
      >
          <div className="space-y-1 text-center">
            <p className="text-[0.95rem] font-medium text-foreground">Connect your POS system.</p>
            <p className="text-[0.9rem] text-slate-500 dark:text-slate-300">
              {posCount === 0
                ? 'No stores connected'
                : `${posCount} store${posCount > 1 ? 's' : ''} connected`}
            </p>
          </div>

          <Button
            onClick={onAddPos}
            className="w-full"
          >
            {posCount === 0 ? 'Connect Pancake POS' : 'Add Another Store'}
          </Button>
      </DashboardSection>
    </div>
  );
}
