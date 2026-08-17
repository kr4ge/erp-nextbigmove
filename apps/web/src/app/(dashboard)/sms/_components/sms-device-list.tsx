import { HeartPulse, Radio, Smartphone, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/emptystate';
import type { SmsDevice } from '../_types/sms';
import { formatSmsDateTime } from '../_utils/sms-formatters';

type SmsDeviceListProps = {
  devices: SmsDevice[];
  canManageDevices: boolean;
  enrollmentLoading: boolean;
  onGenerateEnrollment: () => void;
  checkingDeviceId: string | null;
  onCheckHeartbeat: (deviceId: string) => void;
};

const deviceStatusClasses: Record<SmsDevice['status'], string> = {
  ACTIVE: 'pill pill-success',
  OFFLINE: 'pill pill-warning',
  PENDING: 'pill pill-info',
  REVOKED: 'pill pill-destructive',
};

export function SmsDeviceList({
  devices,
  canManageDevices,
  enrollmentLoading,
  onGenerateEnrollment,
  checkingDeviceId,
  onCheckHeartbeat,
}: SmsDeviceListProps) {
  return (
    <section className="panel panel-content">
      <div className="panel-header flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Smartphone className="panel-icon" />
          <div>
            <h2 className="panel-title">Registered devices</h2>
            <p className="text-xs text-muted">{devices.length} linked phone{devices.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        {canManageDevices ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={enrollmentLoading}
            iconLeft={<Smartphone className="h-4 w-4" />}
            onClick={onGenerateEnrollment}
          >
            Add device
          </Button>
        ) : null}
      </div>

      <div className="p-4">
        {devices.length === 0 ? (
          <EmptyState
            title="No SMS device connected"
            description="Generate an enrollment key and connect a company Android phone to begin sending through a physical SIM."
            icon={<WifiOff className="h-6 w-6" />}
            actionLabel={canManageDevices ? 'Generate enrollment key' : undefined}
            onAction={canManageDevices ? onGenerateEnrollment : undefined}
          />
        ) : (
          <div className="divide-y divide-border">
            {devices.map((device) => (
              <article key={device.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {device.name}
                        </h3>
                        <span className={deviceStatusClasses[device.status]}>
                          {device.status.toLowerCase()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {device.platform}
                        {device.appVersion ? ` · App ${device.appVersion}` : ''}
                        {` · Last seen ${formatSmsDateTime(device.lastSeenAt)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canManageDevices && device.status !== 'REVOKED' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={checkingDeviceId === device.id}
                        disabled={Boolean(checkingDeviceId && checkingDeviceId !== device.id)}
                        iconLeft={<HeartPulse className="h-4 w-4" />}
                        onClick={() => onCheckHeartbeat(device.id)}
                      >
                        Check connection
                      </Button>
                    ) : null}
                    <p className="text-xs text-muted">
                      Enrolled {formatSmsDateTime(device.enrolledAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 pl-0 sm:pl-12">
                  {device.sims.length === 0 ? (
                    <span className="pill pill-warning">No SIM detected</span>
                  ) : (
                    device.sims.map((sim) => (
                      <div
                        key={sim.id}
                        className="flex items-center gap-2 rounded-lg border border-border bg-background-secondary px-3 py-2"
                      >
                        <Radio className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {sim.alias || `SIM ${sim.slotIndex + 1}`}
                          </p>
                          <p className="text-xs text-muted">
                            {[sim.carrier, sim.phoneNumber || sim.normalizedNumber]
                              .filter(Boolean)
                              .join(' · ') || 'Number unavailable'}
                          </p>
                        </div>
                        <span className={sim.status === 'ACTIVE' ? 'pill pill-success' : 'pill pill-warning'}>
                          {sim.status.toLowerCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
