'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { getImpersonation, stopImpersonation, type ImpersonationBanner as Banner } from '@/lib/impersonation';

/**
 * Always-visible reminder that this session is not your own.
 *
 * Without it an admin forgets and acts as someone else — every write lands
 * under the target's name, and the confusion surfaces much later.
 */
export function ImpersonationBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read after mount: touching localStorage during render desyncs the
  // server-rendered markup.
  useEffect(() => setBanner(getImpersonation()), []);

  if (!banner) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-warning px-4 py-2 text-center text-sm font-medium text-white">
      <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Viewing as <strong>{banner.name}</strong>
        {banner.email ? <span className="font-normal opacity-80"> · {banner.email}</span> : null}
      </span>
      <button
        type="button"
        disabled={isExiting}
        onClick={() => {
          setIsExiting(true);
          setError(null);
          void stopImpersonation().catch((exitError) => {
            setIsExiting(false);
            setError(exitError?.response?.data?.message ?? 'Could not exit. Try again.');
          });
        }}
        className="rounded-md bg-surface px-2.5 py-1 text-xs font-semibold text-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {isExiting ? 'Exiting…' : 'Exit'}
      </button>
      {error ? <span className="text-xs font-normal">{error}</span> : null}
    </div>
  );
}
