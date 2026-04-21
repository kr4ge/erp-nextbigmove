'use client';

import { Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
        <div className="text-lg font-semibold text-foreground">No results for "{searchLabel}"</div>
        <p className="text-sm text-secondary">
          Try a different keyword or clear the search to see all stores.
        </p>
        <Button variant="ghost" size="md" onClick={onClearSearch}>
          Clear search
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-center justify-center px-8 py-12 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-orange-500">
        <Store className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">No POS stores connected</h3>
      <p className="mt-2 text-sm text-secondary">
        Connect your first store to see it listed here.
      </p>
      <Button
        onClick={onConnectStore}
        className="mt-6"
        variant="primary"
        size="lg"
      >
        Connect Store
      </Button>
    </Card>
  );
}
