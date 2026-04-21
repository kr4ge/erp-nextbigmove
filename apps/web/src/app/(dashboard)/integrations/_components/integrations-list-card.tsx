'use client';

import {
  type ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { MoreVertical, PlugZap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DataTable,
  DataTableActionCell,
  DataTableState,
} from '@/components/data-table';
import type { Integration } from '../types';
import {
  formatIntegrationDate,
  getProviderIcon,
  getProviderName,
} from '../utils';
import { IntegrationsSearchInput } from './integrations-search-input';

interface IntegrationsListCardProps {
  allCount: number;
  filteredIntegrations: Integration[];
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onClearSearch: () => void;
  onView: (integration: Integration) => void;
  onEdit: (integration: Integration) => void;
  onDelete: (integration: Integration) => void;
  onAddIntegration: () => void;
}

function IntegrationActionsMenu({
  integration,
  onView,
  onEdit,
  onDelete,
}: {
  integration: Integration;
  onView: (integration: Integration) => void;
  onEdit: (integration: Integration) => void;
  onDelete: (integration: Integration) => void;
}) {
  return (
    <DataTableActionCell>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#0F172A] transition hover:bg-[#F8FAFC] active:bg-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          aria-label="Integration actions"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 rounded-2xl">
          <DropdownMenuItem onSelect={() => onView(integration)}>View</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(integration)}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onDelete(integration)}
            className="text-rose-600 focus:text-rose-700"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </DataTableActionCell>
  );
}

export function IntegrationsListCard({
  allCount,
  filteredIntegrations,
  searchInput,
  onSearchInputChange,
  onClearSearch,
  onView,
  onEdit,
  onDelete,
  onAddIntegration,
}: IntegrationsListCardProps) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [searchInput, filteredIntegrations.length]);

  const columns = useMemo<ColumnDef<Integration>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Integration',
        cell: ({ row }) => {
          const integration = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="text-slate-400">{getProviderIcon(integration.provider)}</div>
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">{integration.name}</div>
                <div className="text-sm text-[#475569]">{getProviderName(integration.provider)}</div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'lastSyncAt',
        header: 'Last Sync',
        cell: ({ row }) => {
          const value = row.original.lastSyncAt;
          return (
            <span className="text-sm text-[#475569]">
              {value ? formatIntegrationDate(value) : 'Never'}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        meta: {
          align: 'right',
        },
        cell: ({ row }) => (
          <IntegrationActionsMenu
            integration={row.original}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ),
      },
    ],
    [onDelete, onEdit, onView],
  );

  const table = useReactTable({
    data: filteredIntegrations,
    columns,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const hasSearch = searchInput.trim().length > 0;

  const emptyState =
    allCount === 0 ? (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 text-orange-500">
          <PlugZap className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold text-slate-700">No integrations yet</p>
        <p className="mt-1 text-[0.95rem] text-slate-500">
          Connect Meta Ads or Pancake POS to get started.
        </p>
        <Button
          onClick={onAddIntegration}
          className="mt-4"
        >
          Add Integration
        </Button>
      </div>
    ) : (
      <DataTableState
        title={`No results for "${searchInput || 'your query'}"`}
        description="Try a different keyword or clear the search to see all integrations."
        action={
          hasSearch ? (
            <Button variant="ghost" onClick={onClearSearch}>
              Clear search
            </Button>
          ) : null
        }
      />
    );

  return (
    <section className="overflow-visible rounded-xl border border-slate-200 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/25 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <PlugZap className="h-3.5 w-3.5 text-orange-500" />
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
          All Integrations
        </h4>
      </div>

      <div className="space-y-3 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.82rem] text-slate-500">
            {filteredIntegrations.length} of {allCount} integration{allCount === 1 ? '' : 's'}
          </p>
          <IntegrationsSearchInput value={searchInput} onChange={onSearchInputChange} />
        </div>

        <DataTable
          table={table}
          emptyState={emptyState}
          showPagination={filteredIntegrations.length > pagination.pageSize}
          totalRows={filteredIntegrations.length}
        />
      </div>
    </section>
  );
}
