import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface Order {
  id: string;
  shopId: string;
  posOrderId: string;
  dateLocal: string;
  insertedAt: string;
  statusName?: string;
  totalQuantity: number;
  cogs: string | number;
  mapping?: string | null;
  pUtmCampaign?: string | null;
  pUtmContent?: string | null;
  tracking?: string | null;
  tags?: { id?: string; name?: string }[];
  customerCare?: string | null;
  marketer?: string | null;
}

export function getOrderColumns(): ColumnDef<Order>[] {
  return [
    {
      accessorKey: 'dateLocal',
      header: 'Date',
      cell: ({ row }) => row.original.dateLocal || '—',
      enableSorting: true,
    },
    {
      accessorKey: 'posOrderId',
      header: 'Order ID',
      cell: ({ row }) => row.original.posOrderId || '—',
    },
    {
      accessorKey: 'statusName',
      header: 'Status',
      cell: ({ row }) => row.original.statusName || '—',
    },
    {
      accessorKey: 'totalQuantity',
      header: 'Qty',
      cell: ({ row }) => row.original.totalQuantity ?? 0,
      enableSorting: true,
    },
    {
      accessorKey: 'cogs',
      header: 'COGS',
      cell: ({ row }) => row.original.cogs ?? 0,
      enableSorting: true,
    },
    {
      accessorKey: 'mapping',
      header: 'Mapping',
      cell: ({ row }) => row.original.mapping || '—',
    },
    {
      accessorKey: 'pUtmCampaign',
      header: 'UTM Campaign',
      cell: ({ row }) => row.original.pUtmCampaign || '—',
    },
    {
      accessorKey: 'pUtmContent',
      header: 'UTM Content',
      cell: ({ row }) => row.original.pUtmContent || '—',
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: ({ row }) => {
        const tags = row.original.tags || [];
        if (!Array.isArray(tags) || tags.length === 0) return '—';
        const names = tags
          .map((t) => t?.name)
          .filter(Boolean)
          .join(', ');
        return names || '—';
      },
    },
    {
      accessorKey: 'customerCare',
      header: 'Customer Care',
      cell: ({ row }) => row.original.customerCare || '—',
    },
    {
      accessorKey: 'marketer',
      header: 'Marketer',
      cell: ({ row }) => row.original.marketer || '—',
    },
    {
      accessorKey: 'insertedAt',
      header: 'Inserted At',
      cell: ({ row }) =>
        row.original.insertedAt
          ? format(new Date(row.original.insertedAt), 'yyyy-MM-dd HH:mm')
          : '—',
      enableSorting: true,
    },
    {
      id: 'actions',
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>Actions coming soon</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
