import { useCallback, useEffect, useRef } from 'react';

export const ANALYTICS_FILTER_DEBOUNCE_MS = 180;

type AnalyticsQueryPart = string | number | boolean | null | undefined;

export function buildAnalyticsQueryKey(...parts: AnalyticsQueryPart[]) {
  return JSON.stringify(parts);
}

type AnalyticsRequestHandle = {
  signal: AbortSignal;
  isLatest: () => boolean;
  finish: () => void;
};

export function useLatestAnalyticsRequest() {
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const cancelRequest = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const beginRequest = useCallback((): AnalyticsRequestHandle => {
    controllerRef.current?.abort();

    const requestId = requestIdRef.current + 1;
    const controller = new AbortController();
    requestIdRef.current = requestId;
    controllerRef.current = controller;

    return {
      signal: controller.signal,
      isLatest: () =>
        requestIdRef.current === requestId && !controller.signal.aborted,
      finish: () => {
        if (requestIdRef.current === requestId) {
          controllerRef.current = null;
        }
      },
    };
  }, []);

  useEffect(() => cancelRequest, [cancelRequest]);

  return { beginRequest, cancelRequest };
}
