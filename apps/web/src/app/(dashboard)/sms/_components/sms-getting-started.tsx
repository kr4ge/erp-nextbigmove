import {
  ChevronUp,
  Check,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SmsOverviewResponse } from '../_types/sms';

type SmsGettingStartedProps = {
  overview: SmsOverviewResponse;
  enrollmentGenerated: boolean;
  canManageDevices: boolean;
  enrollmentLoading: boolean;
  onGenerateEnrollment: () => void;
};

export function SmsGettingStarted({
  overview,
  enrollmentGenerated,
  canManageDevices,
  enrollmentLoading,
  onGenerateEnrollment,
}: SmsGettingStartedProps) {
  const steps = [
    {
      label: 'Download the Android app',
      description: 'Install NBM SMS Gateway on a company-controlled Android phone.',
      done: overview.setup.hasDevice,
      icon: Smartphone,
    },
    {
      label: 'Generate a device API key',
      description: 'Create a secure one-time enrollment key for the selected partner.',
      done: enrollmentGenerated || overview.setup.hasDevice,
      icon: KeyRound,
      action: canManageDevices ? (
        <Button
          type="button"
          size="sm"
          loading={enrollmentLoading}
          iconLeft={<KeyRound className="h-4 w-4" />}
          onClick={onGenerateEnrollment}
        >
          Generate API key
        </Button>
      ) : null,
    },
    {
      label: 'Register your device',
      description: 'Scan the QR code in the app and approve the required permissions.',
      done: overview.setup.hasDevice,
      icon: ShieldCheck,
    },
    {
      label: 'Connect an active SIM',
      description: 'Keep the phone online so ERP can detect its physical SIM.',
      done: overview.setup.hasActiveDevice && overview.setup.hasActiveSim,
      icon: Smartphone,
    },
    {
      label: 'Send the first message',
      description: 'Confirm the physical SIM can send and report message status.',
      done: overview.setup.hasSentMessage,
      icon: MessageSquare,
    },
  ];
  const completed = steps.filter((step) => step.done).length;

  return (
    <section
      id="sms-get-started"
      className="overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface shadow-sm"
    >
      <div className="px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Get started</h2>
            <p className="mt-1 text-sm text-muted">
              {completed === steps.length
                ? 'Gateway setup is complete.'
                : 'Connect an Android phone and send your first message.'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span>{completed} of {steps.length}</span>
            <ChevronUp className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/15">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-5 pb-6">
        {steps.map((step, index) => (
          <div key={step.label} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="relative flex w-9 shrink-0 flex-col items-center">
              <div
                className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done
                    ? 'bg-primary text-white'
                    : 'border border-border bg-background-secondary text-muted'
                }`}
              >
                {step.done ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < steps.length - 1 ? (
                <div className="absolute left-1/2 top-9 h-full w-px -translate-x-1/2 bg-border" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{step.label}</h3>
                {step.action}
              </div>
              <p className="mt-1 max-w-3xl text-sm text-muted">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-primary/20 px-5 py-4 text-right">
        <span className="text-sm font-semibold text-foreground">
          {completed === steps.length ? 'Setup complete' : 'Finish setup'}
        </span>
      </div>
    </section>
  );
}
