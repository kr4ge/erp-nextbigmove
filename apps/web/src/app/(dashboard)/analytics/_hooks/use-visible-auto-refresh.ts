import { useEffect, useRef } from 'react';

export function useVisibleAutoRefresh(
  callback: () => void,
  intervalMs = 60000,
  enabled = true,
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const interval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        callbackRef.current();
      }
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [intervalMs, enabled]);
}
