'use client';

import { AlertBanner } from '@/components/ui/feedback';

interface IntegrationDetailAlertsProps {
  error: string;
  successMessage: string;
}

export function IntegrationDetailAlerts({
  error,
  successMessage,
}: IntegrationDetailAlertsProps) {
  return (
    <>
      {error ? <AlertBanner tone="error" message={error} className="text-base" /> : null}
      {successMessage ? <AlertBanner tone="success" message={successMessage} className="text-base" /> : null}
    </>
  );
}
