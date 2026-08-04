'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MessageSquare, Radio, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SendSmsMessageInput, SmsDevice } from '../_types/sms';

type SmsSendDialogProps = {
  devices: SmsDevice[];
  loading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (payload: SendSmsMessageInput) => void;
};

export function SmsSendDialog({
  devices,
  loading,
  open,
  onOpenChange,
  onSend,
}: SmsSendDialogProps) {
  const activeSims = useMemo(
    () => devices.flatMap((device) => (
      device.status === 'ACTIVE'
        ? device.sims
          .filter((sim) => sim.status === 'ACTIVE')
          .map((sim) => ({ ...sim, deviceName: device.name }))
        : []
    )),
    [devices],
  );
  const defaultSimId = activeSims[0]?.id ?? '';
  const [simId, setSimId] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!open) return;
    setSimId(defaultSimId);
    setRecipientPhone('');
    setBody('');
  }, [defaultSimId, open]);

  const normalizedPhone = recipientPhone.trim();
  const normalizedBody = body.trim();
  const canSubmit = Boolean(simId && normalizedPhone && normalizedBody);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || loading) return;

    onSend({
      simId,
      recipientPhone: normalizedPhone,
      body: normalizedBody,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <DialogTitle className="mb-1">Send test SMS</DialogTitle>
          <DialogDescription>
            Send a message through an active SIM connected to the current partner.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={submit}>
          {activeSims.length === 0 ? (
            <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
              Connect an active Android device and SIM before sending a message.
            </div>
          ) : (
            <div>
              <label className="form-label" htmlFor="sms-sim">Sending SIM</label>
              <div className="relative mt-2">
                <Radio className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <select
                  id="sms-sim"
                  className="input w-full pl-10"
                  value={simId}
                  onChange={(event) => setSimId(event.target.value)}
                >
                  {activeSims.map((sim) => (
                    <option key={sim.id} value={sim.id}>
                      {sim.deviceName} · {sim.alias || `SIM ${sim.slotIndex + 1}`} · {sim.carrier || sim.phoneNumber || 'Active SIM'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="form-label" htmlFor="sms-recipient">Recipient phone number</label>
            <input
              id="sms-recipient"
              className="input mt-2 w-full"
              inputMode="tel"
              maxLength={32}
              placeholder="+639171234567"
              required
              value={recipientPhone}
              onChange={(event) => setRecipientPhone(event.target.value)}
            />
            <p className="mt-2 text-xs text-muted">
              Use international format and send to a phone other than the gateway SIM.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="form-label" htmlFor="sms-body">Message</label>
              <span className="text-xs text-muted">{body.length}/160</span>
            </div>
            <textarea
              id="sms-body"
              className="input mt-2 min-h-28 w-full resize-y py-3"
              maxLength={160}
              placeholder="Enter a short test message"
              required
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              loading={loading}
              iconLeft={<Send className="h-4 w-4" />}
            >
              Send SMS
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
