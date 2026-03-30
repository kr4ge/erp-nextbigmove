'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Integration } from '../types';
import { getProviderName } from '../utils';

interface IntegrationDetailHeaderProps {
  integration: Integration;
}

export function IntegrationDetailHeader({ integration }: IntegrationDetailHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <Link
        href="/integrations"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="flex-1">
        <PageHeader
          title={integration.name}
          description={`${getProviderName(integration.provider)} Integration`}
        />
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={integration.status} />
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            integration.enabled
              ? 'bg-[#ECFDF3] text-[#10B981]'
              : 'bg-[#F1F5F9] text-[#64748B]'
          }`}
        >
          {integration.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
    </div>
  );
}
