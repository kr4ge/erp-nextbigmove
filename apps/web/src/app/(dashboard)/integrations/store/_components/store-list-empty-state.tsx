'use client';

import { Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/emptystate';

interface StoreListEmptyStateProps {
  hasSearch: boolean;
  searchLabel: string;
  onClearSearch: () => void;
  onConnectStore: () => void;
}

export function StoreListEmptyState({
  hasSearch,
  searchLabel,
  onClearSearch,
  onConnectStore,
}: StoreListEmptyStateProps) {
  if (hasSearch) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 px-8 py-12 text-center">
        <div className="text-lg font-semibold text-[#0F172A]">
          No results for “{searchLabel}”
        </div>
        <p className="text-sm text-[#475569]">
          Try a different keyword or clear the search to see all stores.
        </p>
        <Button variant="ghost" onClick={onClearSearch}>
          Clear search
        </Button>
      </Card>
    );
  }

  return (
    <EmptyState
      title="No POS stores connected"
      description="Connect your first store to see it listed here."
      actionLabel="Connect Store"
      onAction={onConnectStore}
      icon={<Store className="h-8 w-8" />}
    />
  );
}
