'use client';

import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/emptystate';
import { Package, Search, ShoppingBag, Tags } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import type { Product } from '../product-columns';

interface StoreProductsTabProps {
  products: Product[];
  filteredProducts: Product[];
  table: Table<Product>;
  selectedCount: number;
  searchInput: string;
  searchTerm: string;
  isSyncingProducts: boolean;
  onSearchInputChange: (value: string) => void;
  onSyncProducts: () => void;
  onOpenBulkMapping: () => void;
}

export function StoreProductsTab({
  products,
  filteredProducts,
  table,
  selectedCount,
  searchInput,
  searchTerm,
  isSyncingProducts,
  onSearchInputChange,
  onSyncProducts,
  onOpenBulkMapping,
}: StoreProductsTabProps) {
  return (
    <section className="panel panel-content">
      <div className="panel-header">
        <Package className="h-3.5 w-3.5 text-primary" />
        <h4 className="panel-title">Products</h4>
        {filteredProducts.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-xs-tight text-slate-500">
            <span>
              {filteredProducts.length} variation{filteredProducts.length !== 1 ? 's' : ''}
            </span>
            {searchTerm && products.length !== filteredProducts.length && (
              <>
                <span className="text-slate-300">|</span>
                <span>{products.length} total</span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="space-y-3 p-3">
        {selectedCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
            <p className="text-xs text-indigo-800">
              <span className="font-semibold">{selectedCount}</span> product
              {selectedCount !== 1 ? 's' : ''} selected
            </p>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Tags className="h-3.5 w-3.5" />}
              onClick={onOpenBulkMapping}
            >
              Update Mapping
            </Button>
          </div>
        )}

        <div className="relative ml-auto w-full max-w-sm">
          <input
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            placeholder="Search products..."
            className='input py-2'
          />
          <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        {isSyncingProducts && (
          <div className="py-6 text-center text-xs text-slate-500">Syncing products...</div>
        )}

        {!isSyncingProducts && products.length === 0 ? (
          <EmptyState
            title="No products synced yet"
            description='Click "Sync Products" to load them from Pancake POS.'
            actionLabel="Sync Products"
            onAction={onSyncProducts}
            icon={<ShoppingBag className="h-8 w-8" />}
          />
        ) : (
          <DataTable table={table} />
        )}
      </div>
    </section>
  );
}

