'use client';

import { SectionCard } from '@/components/ui/section-card';
import type { Integration } from '../types';
import { formatIntegrationDate, getProviderName } from '../utils';

interface IntegrationMetadataSectionProps {
  integration: Integration;
}

export function IntegrationMetadataSection({ integration }: IntegrationMetadataSectionProps) {
  return (
    <SectionCard title="Metadata">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-[#475569]">Created</dt>
          <dd className="mt-1 text-sm text-[#0F172A]">{formatIntegrationDate(integration.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[#475569]">Last Updated</dt>
          <dd className="mt-1 text-sm text-[#0F172A]">{formatIntegrationDate(integration.updatedAt)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[#475569]">Last Sync</dt>
          <dd className="mt-1 text-sm text-[#0F172A]">
            {integration.lastSyncAt ? formatIntegrationDate(integration.lastSyncAt) : 'Never'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[#475569]">Provider</dt>
          <dd className="mt-1 text-sm text-[#0F172A]">{getProviderName(integration.provider)}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}
