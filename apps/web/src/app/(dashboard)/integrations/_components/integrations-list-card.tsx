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
      <DataTableState
        icon={<PlugZap className="h-5 w-5 text-[#2563EB]" />}
        title="No integrations yet"
        description="Connect Meta Ads or Pancake POS to get started."
        action={<Button onClick={onAddIntegration}>Add Integration</Button>}
      />
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
    <div className="space-y-0">
      <div className="flex flex-col gap-3 rounded-t-2xl border border-b-0 border-[#E2E8F0] bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-[#0F172A]">All Integrations</h2>
        <IntegrationsSearchInput value={searchInput} onChange={onSearchInputChange} />
      </div>

      <DataTable
        table={table}
        emptyState={emptyState}
        showPagination={filteredIntegrations.length > pagination.pageSize}
        totalRows={filteredIntegrations.length}
        className="[&>div]:rounded-t-none [&>div]:border-t-0"
      />
    </div>
  );
}
