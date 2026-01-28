"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, DollarSign } from "lucide-react";
import { CogsModal } from "@/components/cogs/cogs-modal";

export interface Product {
  id: string;
  customId?: string;
  name: string;
  productId?: string;
  mapping?: string;
}

export function getProductColumns(
  storeId: string,
  onManageCogs: (product: Product) => void
): ColumnDef<Product>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value: boolean) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value: boolean) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "productId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Product ID" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-xs text-[#475569]">
          {row.getValue("productId")}
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "customId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Custom ID" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-xs text-[#475569]">
          {row.getValue("customId") || "—"}
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Name" />
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name") || "Unnamed product"}</div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "mapping",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Mapping" />
      ),
      cell: ({ row }) => (
        <div className="text-sm text-[#475569]">
          {row.getValue("mapping") || <span className="text-[#94A3B8]">—</span>}
        </div>
      ),
      enableSorting: true,
    },
    {
      id: "actions",
      header: () => <div className="text-right hidden">Actions</div>,
      cell: ({ row }) => {
        const product = row.original;

        return (
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-xl text-[#0F172A] hover:bg-[#F8FAFC] active:bg-[#E2E8F0] transition focus:outline-none focus:ring-2 focus:ring-[#2563EB]">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onManageCogs(product)}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Manage COGS
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    // TODO: Implement delete product functionality
                    if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
                      console.log("Delete product:", product);
                      alert(`Delete functionality will be implemented for: ${product.name}`);
                    }
                  }}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
                {/* <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDuplicate(product)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport(product)}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </DropdownMenuItem> */}
                
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
