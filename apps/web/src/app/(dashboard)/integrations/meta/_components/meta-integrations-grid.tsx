'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { MetaIntegration } from '../_types/meta-integration';
import { formatMetaDate } from '../_utils/meta-integrations';

interface MetaIntegrationsGridProps {
  integrations: MetaIntegration[];
  teamNames: Record<string, string>;
  onOpenDetail: (id: string) => void;
  onDelete: (id: string) => void;
}

function normalizeStatus(status?: string): 'ACTIVE' | 'PENDING' | 'ERROR' | 'DISABLED' | 'INFO' {
  if (!status) return 'ACTIVE';
  const upper = status.toUpperCase();
  if (upper === 'PENDING') return 'PENDING';
  if (upper === 'ERROR') return 'ERROR';
  if (upper === 'DISABLED') return 'DISABLED';
  if (upper === 'INFO') return 'INFO';
  return 'ACTIVE';
}

export function MetaIntegrationsGrid({
  integrations,
  teamNames,
  onOpenDetail,
  onDelete,
}: MetaIntegrationsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {integrations.map((integration) => (
        <Card
          key={integration.id}
          className="cursor-pointer transition hover:shadow-md"
          onClick={() => onOpenDetail(integration.id)}
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex shrink-0 items-center text-orange-500">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold leading-5 text-[#0F172A]">{integration.name}</h3>
                <p className="text-sm-custom text-[#475569]">Meta Marketing API</p>
                <span className="mt-1 inline-flex items-center rounded-full border border-orange-100 bg-orange-50/60 px-2.5 py-1 text-xs font-medium text-orange-600">
                  {integration.teamId
                    ? `Team: ${teamNames[integration.teamId] || 'Unknown team'}`
                    : 'All teams'}
                </span>
              </div>
            </div>
            <StatusBadge status={normalizeStatus(integration.status)} />
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-[#E2E8F0] pt-3">
            <div>
              <p className="text-xs text-[#475569]">Created</p>
              <p className="text-sm text-[#0F172A]">{formatMetaDate(integration.createdAt)}</p>
            </div>
            <div />
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetail(integration.id);
              }}
            >
              View Details
            </Button>
            <Button
              variant="ghost"
              className="text-[#EF4444]"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(integration.id);
              }}
            >
              Delete
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
