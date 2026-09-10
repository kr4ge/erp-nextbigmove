'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CreativeAiProvider, CreativeAiProviderLogin } from '@/app/(dashboard)/creative-agent/video-registry/_types/creative-ai';

type Props = {
  provider: CreativeAiProvider | null;
  login: CreativeAiProviderLogin | null;
  submittingCode: boolean;
  onSubmitCode: (code: string) => void;
  onClose: () => void;
};

export function AiSignInDialog({ provider, login, submittingCode, onSubmitCode, onClose }: Props) {
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const open = Boolean(provider && login);
  const label = provider === 'CLAUDE' ? 'Claude' : 'Codex';
  const waiting = login?.status === 'WAITING';
  const connected = login?.status === 'CONNECTED';
  const expiresAt = login?.expiresAt ? Date.parse(login.expiresAt) : Number.NaN;
  const remainingSeconds = Number.isFinite(expiresAt) ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : null;
  const remainingLabel = remainingSeconds === null
    ? null
    : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  useEffect(() => {
    setAuthorizationCode('');
    setCopied(null);
    setNow(Date.now());
  }, [login?.loginId]);

  useEffect(() => {
    if (!waiting || !Number.isFinite(expiresAt)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, waiting]);

  const copyValue = async (value: string, target: 'link' | 'code') => {
    await navigator.clipboard.writeText(value);
    setCopied(target);
    window.setTimeout(() => setCopied((current) => current === target ? null : current), 2000);
  };

  const copyCode = async () => {
    if (login?.userCode) await copyValue(login.userCode, 'code');
  };

  const copyLink = async () => {
    if (login?.verificationUrl) await copyValue(login.verificationUrl, 'link');
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {label}</DialogTitle>
          <DialogDescription>Sign in with the account this tenant will use. ERP never asks for or stores your password.</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className={`flex gap-3 rounded-xl border p-4 ${connected ? 'border-success/30 bg-success-soft/30' : login?.status === 'FAILED' ? 'border-destructive/30 bg-destructive-soft' : 'border-info/30 bg-info-soft/40'}`}>
            {connected ? <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <Loader2 className={`mt-0.5 h-5 w-5 shrink-0 text-info ${waiting ? 'animate-spin' : ''}`} />}
            <div>
              <p className="text-sm font-semibold text-foreground">{connected ? 'Connected successfully' : waiting ? provider === 'CLAUDE' ? 'Waiting for authorization code' : 'Waiting for account approval' : 'Sign-in was not completed'}</p>
              <p className="mt-1 text-sm text-muted">{login?.message}</p>
              {waiting && remainingLabel ? <p className="mt-2 text-xs font-semibold text-info">Sign-in expires in {remainingLabel}</p> : null}
            </div>
          </div>

          {waiting && login?.userCode ? (
            <div>
              <p className="form-label">One-time code</p>
              <button type="button" className="mt-2 flex w-full items-center justify-between rounded-xl border border-border bg-background-secondary/40 px-4 py-3 text-left" onClick={() => void copyCode()}>
                <code className="text-lg font-semibold tracking-wider text-foreground">{login.userCode}</code>
                <span className="flex items-center gap-2 text-sm font-semibold text-primary">{copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === 'code' ? 'Copied' : 'Copy code'}</span>
              </button>
            </div>
          ) : null}

          {waiting && login?.verificationUrl ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <a href={login.verificationUrl} target="_blank" rel="noreferrer" className="btn btn-primary-soft btn-md btn-icon flex flex-1 justify-center">
                <ExternalLink className="h-4 w-4" />
                <span>Open {label} sign-in</span>
              </a>
              <Button type="button" variant="outline" className="w-full sm:w-auto" iconLeft={copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} onClick={() => void copyLink()}>
                {copied === 'link' ? 'Link copied' : 'Copy link'}
              </Button>
            </div>
          ) : null}

          {waiting && provider === 'CLAUDE' && login?.verificationUrl ? (
            <div>
              <label className="form-label" htmlFor="claude-authorization-code">Authorization code</label>
              <p className="mt-1 text-xs text-muted">The spinner means Claudebox is keeping this secure sign-in session open. Paste the code from Claude below to finish it.</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input id="claude-authorization-code" className="input min-w-0 flex-1" value={authorizationCode} placeholder="Paste code" onChange={(event) => setAuthorizationCode(event.target.value)} />
                <Button type="button" loading={submittingCode} disabled={!authorizationCode.trim()} onClick={() => onSubmitCode(authorizationCode.trim())}>Continue</Button>
              </div>
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-muted">Complete sign-in in the new tab, then return here. The credentials stay isolated to this tenant inside the AI gateway.</p>
          <div className="flex justify-end"><Button type="button" variant="outline" onClick={onClose}>{connected ? 'Done' : 'Close'}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
