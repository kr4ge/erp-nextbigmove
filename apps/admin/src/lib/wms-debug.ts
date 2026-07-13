'use client';

const WMS_DEBUG_NAV_STORAGE_KEY = 'wms_debug_nav';

export function isWmsDebugNavEnabled() {
  return (
    typeof window !== 'undefined'
    && window.localStorage.getItem(WMS_DEBUG_NAV_STORAGE_KEY) === '1'
  );
}

export function logWmsDebug(
  scope: string,
  message: string,
  data?: Record<string, unknown>,
) {
  if (!isWmsDebugNavEnabled()) {
    return;
  }

  console.info(`[WMS:${scope}] ${message}`, {
    at: new Date().toISOString(),
    path: window.location.pathname,
    ...data,
  });
}
