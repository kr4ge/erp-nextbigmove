'use client';

import { StatusBadge } from '@/components/ui/status-badge';
import { Copy, Eye, EyeOff, Key, Store } from 'lucide-react';
import type { PosStore } from '../../../_types/store-detail';

interface StoreDetailOverviewProps {
  store: PosStore;
  storeName: string;
  avatarUrl?: string;
  createdAtLabel: string;
  showApiKey: boolean;
  apiKeyCopied: boolean;
  onToggleApiKey: () => void;
  onCopyApiKey: () => void;
}

function getStoreInitials(name: string) {
  return name
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function normalizeStatus(status?: string): 'ACTIVE' | 'PENDING' | 'ERROR' | 'DISABLED' | 'INFO' {
  if (!status) return 'ACTIVE';
  const upper = status.toUpperCase();
  if (upper === 'PENDING') return 'PENDING';
  if (upper === 'ERROR') return 'ERROR';
  if (upper === 'DISABLED') return 'DISABLED';
  if (upper === 'INFO') return 'INFO';
  return 'ACTIVE';
}

export function StoreDetailOverview({
  store,
  storeName,
  avatarUrl,
  createdAtLabel,
  showApiKey,
  apiKeyCopied,
  onToggleApiKey,
  onCopyApiKey,
}: StoreDetailOverviewProps) {
  const apiKey = store.apiKey || '';
  const maskedApiKey = '•'.repeat(apiKey.length || 8);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <Store className="h-3.5 w-3.5 text-indigo-500" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Store Details</h4>
          <div className="ml-auto">
            <StatusBadge status={normalizeStatus(store.status)} />
          </div>
        </div>
          <div className="flex items-start gap-3 p-3">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={storeName}
              className="h-12 w-12 rounded-full border border-slate-200 object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-500">
              {getStoreInitials(storeName)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-slate-900">{storeName}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Shop ID: {store.shopId}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">Created: {createdAtLabel}</p>
          </div>
        </div>
      </section>

      <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <Key className="h-3.5 w-3.5 text-amber-500" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">API Key</h4>
        </div>
        <div className="p-3">
          <div className="relative">
            <input
              readOnly
              value={showApiKey ? apiKey : maskedApiKey}
              onClick={apiKey ? onCopyApiKey : undefined}
              className="w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-16 font-mono text-xs text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100/30"
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
              {apiKey && (
                <button
                  type="button"
                  onClick={onToggleApiKey}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              )}
              {apiKey && (
                <button
                  type="button"
                  onClick={onCopyApiKey}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            {apiKeyCopied ? <span className="text-emerald-600">Copied!</span> : 'Click to copy'}
          </p>
        </div>
      </section>
    </div>
  );
}
