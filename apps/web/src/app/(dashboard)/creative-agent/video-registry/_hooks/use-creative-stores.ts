'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCreativeStores } from '../_services/video-registry.service';
import type { CreativeStoreOption } from '../_types/video-registry';

/**
 * Enrollment store options are tenant POS stores, not stores already present
 * in the current creative result set. Keep this source separate from library
 * filter options so a store can enroll its very first creative.
 */
export function useCreativeStores(enabled = true) {
  const [stores, setStores] = useState<CreativeStoreOption[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchCreativeStores();
      if (sequence === requestSequence.current) setStores(result);
    } catch (loadError) {
      if (sequence === requestSequence.current) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load POS stores.');
      }
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { stores, isLoading, error, reload };
}
