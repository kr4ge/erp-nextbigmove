'use client';

import { Button } from '@/components/ui/button';
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
      <section className="overflow-visible rounded-xl border border-slate-200 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/25 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <span className="text-orange-500 [&>svg]:!h-3.5 [&>svg]:!w-3.5">
            {getProviderIcon('META_ADS')}
          </span>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
            Meta Marketing API
          </h3>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="space-y-1 text-center">
            <p className="text-[0.95rem] font-medium text-slate-700">Connect your Meta ad accounts.</p>
            <p className="text-[0.9rem] text-slate-500">
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
        </div>
      </section>

      <section className="overflow-visible rounded-xl border border-slate-200 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/25 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <span className="text-orange-500 [&>svg]:!h-3.5 [&>svg]:!w-3.5">
            {getProviderIcon('PANCAKE_POS')}
          </span>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
            Pancake POS
          </h3>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="space-y-1 text-center">
            <p className="text-[0.95rem] font-medium text-slate-700">Connect your POS system.</p>
            <p className="text-[0.9rem] text-slate-500">
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
        </div>
      </section>
    </div>
  );
}
