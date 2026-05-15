'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { StoreCard } from '../_types/store-list';
import { getStoreInitials } from '../_utils/store-list';

interface StoreListGridProps {
  stores: StoreCard[];
  teamNames: Record<string, string>;
  isFetching: boolean;
  page: number;
  pageCount: number;
  onOpenStore: (storeId: string) => void;
  onFirstPage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
}

export function StoreListGrid({
  stores,
  teamNames,
  isFetching,
  page,
  pageCount,
  onOpenStore,
  onFirstPage,
  onPrevPage,
  onNextPage,
  onLastPage,
}: StoreListGridProps) {
  return (
    <>
      {isFetching ? <div className="text-sm text-[#475569]">Updating results...</div> : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {stores.map((store) => {
          const displayName = store.shopName || store.name;
          return (
            <Card key={store.id} className="flex flex-col bg-surface border-border/10 rounded-2xl">
              <div className="flex items-center gap-2 2xl:justify-between 2xl:gap-0">
                <span className="hidden pill pill-destructive 2xl:inline-flex">
                  Shop
                </span>
                <span className="pill pill-primary">
                  {store.teamId ? `Team: ${teamNames[store.teamId] || store.teamId}` : 'All teams'}
                </span>
              </div>

              <div className="mt-6 flex flex-col items-center text-center">
                {store.shopAvatarUrl ? (
                  <Image
                    src={store.shopAvatarUrl}
                    alt={`Logo of ${displayName}`}
                    width={64}
                    height={64}
                    unoptimized
                    className="h-16 w-16 rounded-full border border-[#E2E8F0] object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F1F5F9] text-xl font-semibold text-[#475569]">
                    {getStoreInitials(displayName)}
                  </div>
                )}
                <h3 className="mt-4 text-lg font-semibold text-[#0F172A]">{displayName}</h3>
                <p className="mt-1 text-sm text-foreground">Pancake POS</p>
                {store.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-secondary/20">{store.description}</p>
                ) : null}
                {store.shopId ? (
                  <p className="mt-2 text-xs text-muted">Shop ID: {store.shopId}</p>
                ) : null}
              </div>

              <div className="mt-6">
                <Button
                  className="w-full"
                  onClick={() => onOpenStore(store.id)}
                >
                  Enter
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {pageCount > 1 ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-surface bg-surface px-4 py-3 text-sm text-foreground shadow-sm sm:flex-row">
          <div className="text-center sm:text-left">
            Showing page {page} of {pageCount}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={onFirstPage}>
              First
            </Button>
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={onPrevPage}>
              Previous
            </Button>
            <span className="px-2 py-1 text-xs text-foreground sm:px-3 sm:text-sm">
              Page {page} of {pageCount}
            </span>
            <Button variant="ghost" size="sm" disabled={page >= pageCount} onClick={onNextPage}>
              Next
            </Button>
            <Button variant="ghost" size="sm" disabled={page >= pageCount} onClick={onLastPage}>
              Last
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
