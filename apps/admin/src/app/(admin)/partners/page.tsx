'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { WmsPageHeader } from '../_components/wms-page-header';
import { WmsSectionCard } from '../_components/wms-section-card';
import { WmsStatCard } from '../_components/wms-stat-card';
import { WmsTablePagination } from '../_components/wms-table-pagination';
import { PartnerStatusBadge } from './_components/partner-status-badge';
import { fetchPartners } from './_services/partners.service';

const STATUS_OPTIONS = ['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED'] as const;

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getPartnerSecondaryLabel(partner: {
  name: string;
  slug: string;
  companyName: string | null;
}) {
  const normalizedName = partner.name.trim().toLowerCase();
  const normalizedCompany = (partner.companyName || '').trim().toLowerCase();

  if (partner.companyName && normalizedCompany !== normalizedName) {
    return partner.companyName;
  }

  return partner.slug;
}

export default function PartnersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const partnersQuery = useQuery({
    queryKey: ['wms-partners'],
    queryFn: fetchPartners,
  });

  const partners = partnersQuery.data || [];
  const activePartners = partners.filter((partner) => partner.status === 'ACTIVE').length;
  const trialPartners = partners.filter((partner) => partner.status === 'TRIAL').length;
  const suspendedPartners = partners.filter((partner) => partner.status === 'SUSPENDED').length;
  const partnerTypeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          partners
            .filter((partner) => partner.partnerType)
            .map((partner) => [partner.partnerType!.id, partner.partnerType!.name]),
        ).values(),
      ),
    [partners],
  );

  const filteredPartners = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return partners.filter((partner) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        partner.name.toLowerCase().includes(normalizedSearch) ||
        (partner.companyName || '').toLowerCase().includes(normalizedSearch) ||
        partner.slug.toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === 'ALL' || partner.status === statusFilter;
      const matchesType =
        typeFilter === 'ALL' || partner.partnerType?.name === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [partners, searchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    setPageIndex(0);
  }, [searchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    const pageCount = Math.max(Math.ceil(filteredPartners.length / pageSize), 1);
    if (pageIndex > pageCount - 1) {
      setPageIndex(pageCount - 1);
    }
  }, [filteredPartners.length, pageIndex, pageSize]);

  const paginatedPartners = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredPartners.slice(start, start + pageSize);
  }, [filteredPartners, pageIndex, pageSize]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || statusFilter !== 'ALL' || typeFilter !== 'ALL';

  function resetFilters() {
    setSearchTerm('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setPageIndex(0);
  }

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Partners"
        description="Partner directory for WMS operations."
        eyebrow="Registry"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard
          label="Total Partners"
          value={partners.length}
          description="Operational accounts onboarded into WMS"
          icon={Building2}
        />
        <WmsStatCard
          label="Active"
          value={activePartners}
          description="Ready for live warehouse operations"
          icon={CheckCircle2}
          accent="emerald"
        />
        <WmsStatCard
          label="Trial"
          value={trialPartners}
          description="Still in onboarding or launch setup"
          icon={Clock3}
          accent="amber"
        />
        <WmsStatCard
          label="Suspended"
          value={suspendedPartners}
          description="Requires follow-up before execution"
          icon={ShieldAlert}
          accent="rose"
        />
      </div>

      <WmsSectionCard
        title="Partner Directory"
        icon={<Building2 className="h-3.5 w-3.5" />}
        metadata={
          <div className="flex items-center gap-3">
            <span>{filteredPartners.length} partners</span>
            <Link
              href="/partners/create"
              className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition-colors hover:border-orange-300 hover:bg-orange-100"
            >
              Create
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="border-b border-slate-100 px-3 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 lg:flex-[1.4]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search partner or company"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-center">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as (typeof STATUS_OPTIONS)[number])
                }
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 lg:w-[164px]"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === 'ALL' ? 'All Statuses' : status}
                  </option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 lg:w-[210px]"
              >
                <option value="ALL">All Types</option>
                {partnerTypeOptions.map((typeName) => (
                  <option key={typeName} value={typeName}>
                    {typeName}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {partnersQuery.isLoading ? (
          <div className="px-4 py-14 text-center text-sm text-slate-500">
            Loading partners...
          </div>
        ) : partnersQuery.isError ? (
          <div className="px-4 py-14 text-center text-sm text-rose-600">
            Failed to load partners. Refresh and try again.
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-base font-semibold text-slate-900">
              {partners.length === 0 ? 'No partners yet' : 'No partners match the current filters'}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {partners.length === 0
                ? 'Create the first partner to start the WMS roster.'
                : 'Adjust the search or filters to see more partners.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
              >
                <RotateCcw className="h-4 w-4" />
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="border-y border-slate-200 bg-slate-50/70">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-3.5">Partner</th>
                    <th className="px-4 py-3.5 text-center">Type</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-center">Users</th>
                    <th className="px-4 py-3.5 text-center">Integrations</th>
                    <th className="px-4 py-3.5 text-center">Since</th>
                    <th className="px-4 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedPartners.map((partner) => (
                    <tr key={partner.id} className="align-middle">
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {partner.name}
                          </p>
                          <p className="mt-1.5 truncate text-sm text-slate-500">
                            {getPartnerSecondaryLabel(partner)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                          {partner.partnerType?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <PartnerStatusBadge status={partner.status} />
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-medium tabular-nums text-slate-700">
                        {partner.maxUsers}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-medium tabular-nums text-slate-700">
                        {partner.maxIntegrations}
                      </td>
                      <td className="px-4 py-4 text-center text-sm tabular-nums text-slate-500">
                        {formatDate(partner.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Link
                          href={`/partners/${partner.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-orange-200 hover:text-orange-700"
                        >
                          Open
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <WmsTablePagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              pageSizeOptions={[10, 25, 50]}
              totalItems={filteredPartners.length}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPageIndex(0);
              }}
            />
          </div>
        )}
      </WmsSectionCard>
    </div>
  );
}
