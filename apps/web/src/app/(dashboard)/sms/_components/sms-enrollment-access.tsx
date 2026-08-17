import { KeyRound, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/emptystate';
import type { SmsEnrollmentResponse } from '../_types/sms';
import { formatEnrollmentExpiry } from '../_utils/sms-formatters';

type SmsEnrollmentAccessProps = {
  enrollment: SmsEnrollmentResponse | null;
  hasRegisteredDevice: boolean;
  hasConnectedDevice: boolean;
  canManageDevices: boolean;
  enrollmentLoading: boolean;
  onGenerateEnrollment: () => void;
  onOpenEnrollment: () => void;
};

function maskEnrollmentKey(value: string) {
  if (value.length <= 12) return '••••••••••••';
  return `${value.slice(0, 8)}-${'•'.repeat(12)}`;
}

export function SmsEnrollmentAccess({
  enrollment,
  hasRegisteredDevice,
  hasConnectedDevice,
  canManageDevices,
  enrollmentLoading,
  onGenerateEnrollment,
  onOpenEnrollment,
}: SmsEnrollmentAccessProps) {
  return (
    <section className="panel panel-content">
      <div className="panel-header flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <KeyRound className="panel-icon" />
          <div>
            <h2 className="panel-title">Device enrollment</h2>
            <p className="text-xs text-muted">Secure Android connection</p>
          </div>
        </div>
        {canManageDevices ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={enrollmentLoading}
            iconLeft={<QrCode className="h-4 w-4" />}
            onClick={onGenerateEnrollment}
          >
            New enrollment key
          </Button>
        ) : null}
      </div>

      <div className="p-4">
        {enrollment ? (
          <div className="rounded-xl border border-border bg-background-secondary p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Enrollment key</p>
                <code className="mt-2 block truncate rounded-lg bg-surface px-3 py-2 text-sm text-muted">
                  {maskEnrollmentKey(enrollment.enrollmentToken)}
                </code>
                <p className="mt-2 text-xs text-muted">
                  Expires {formatEnrollmentExpiry(enrollment.expiresAt)}
                </p>
              </div>
              <span className="pill pill-warning shrink-0">One-time</span>
            </div>
            <Button
              type="button"
              className="mt-4 w-full"
              iconLeft={<QrCode className="h-4 w-4" />}
              onClick={onOpenEnrollment}
            >
              Show QR code
            </Button>
          </div>
        ) : hasRegisteredDevice ? (
          <div className="rounded-xl border border-success/25 bg-success-soft p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {hasConnectedDevice ? 'Device connected' : 'Device enrolled'}
                </p>
                <p className="mt-1 text-sm leading-5 text-muted">
                  The one-time enrollment key is no longer displayed. The phone
                  keeps its device credential, and ERP keeps the tenant-linked
                  device record.
                </p>
              </div>
              <span className={`pill shrink-0 ${hasConnectedDevice ? 'pill-success' : 'pill-warning'}`}>
                {hasConnectedDevice ? 'Connected' : 'Offline'}
              </span>
            </div>
            {canManageDevices ? (
              <p className="mt-3 text-xs text-muted">
                Generate another enrollment key only when connecting a new phone.
              </p>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="No active enrollment key"
            description="Generate a one-time enrollment key and scan it with the NBM SMS Gateway Android app."
            icon={<KeyRound className="h-6 w-6" />}
            actionLabel={canManageDevices ? 'Generate enrollment key' : undefined}
            onAction={canManageDevices ? onGenerateEnrollment : undefined}
          />
        )}
      </div>
    </section>
  );
}
