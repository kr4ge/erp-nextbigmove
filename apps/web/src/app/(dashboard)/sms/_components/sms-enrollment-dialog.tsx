'use client';

import { Check, Copy, KeyRound, QrCode, ShieldCheck, Smartphone } from 'lucide-react';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SmsEnrollmentResponse } from '../_types/sms';
import { formatEnrollmentExpiry } from '../_utils/sms-formatters';

type SmsEnrollmentDialogProps = {
  enrollment: SmsEnrollmentResponse | null;
  open: boolean;
  copied: boolean;
  onCopy: () => void;
  onOpenChange: (open: boolean) => void;
};

export function SmsEnrollmentDialog({
  enrollment,
  open,
  copied,
  onCopy,
  onOpenChange,
}: SmsEnrollmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <QrCode className="h-5 w-5" />
          </div>
          <DialogTitle className="mb-1">Scan the device API key</DialogTitle>
          <DialogDescription>
            Open NBM SMS Gateway on the Android phone and scan this QR code. The
            key is scoped to the current partner, expires automatically, and can
            only be used once.
          </DialogDescription>
        </DialogHeader>

        {enrollment ? (
          <div className="space-y-5">
            <div className="flex justify-center rounded-xl border border-border bg-white p-5">
              <QRCode
                aria-label="Device enrollment QR code"
                bgColor="#ffffff"
                fgColor="#0f172a"
                size={196}
                value={enrollment.enrollmentToken}
              />
            </div>
            <div className="rounded-xl border border-border bg-background-secondary p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Device API key
                </p>
                <span className="pill pill-warning">One-time use</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-3 text-sm font-semibold text-foreground">
                  {enrollment.enrollmentToken}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  iconLeft={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  onClick={onCopy}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted">
                Expires {formatEnrollmentExpiry(enrollment.expiresAt)}
              </p>
            </div>

            <ol className="space-y-3">
              {[
                {
                  icon: Smartphone,
                  text: 'Open NBM SMS Gateway on the Android phone.',
                },
                {
                  icon: KeyRound,
                  text: 'Choose new device setup and scan the QR code.',
                },
                {
                  icon: ShieldCheck,
                  text: 'Approve SMS, phone, notification, and background permissions.',
                },
                {
                  icon: Check,
                  text: 'Finish setup. The phone and its SIM will appear on this dashboard automatically.',
                },
              ].map((step, index) => (
                <li key={step.text} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <step.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Step {index + 1}
                    </p>
                    <p className="text-sm text-muted">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
