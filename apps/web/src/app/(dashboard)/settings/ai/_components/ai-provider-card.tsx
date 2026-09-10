'use client';

import { AlertCircle, Bot, CheckCircle2, LogOut, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CreativeAiProvider, CreativeAiProviderStatus } from '@/app/(dashboard)/creative-agent/video-registry/_types/creative-ai';

type Props = {
  status: CreativeAiProviderStatus;
  canManageConnections: boolean;
  busy: boolean;
  onConnect: (provider: CreativeAiProvider) => void;
  onTest: (provider: CreativeAiProvider) => void;
  onDisconnect: (provider: CreativeAiProvider) => void;
};

export function AiProviderCard({ status, canManageConnections, busy, onConnect, onTest, onDisconnect }: Props) {
  const claude = status.provider === 'CLAUDE';
  const label = claude ? 'Claude' : 'Codex';
  const Icon = claude ? Sparkles : Bot;

  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-foreground">{label}</h2>
            <span className={`pill inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold ${status.connected ? 'border-success/30 bg-success-soft/30 text-success' : 'border-warning/30 bg-warning-soft/40 text-warning'}`}>
              {status.connected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {status.connected ? 'Connected' : status.available ? 'Not connected' : 'Unavailable'}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{status.message}</p>
          {status.accountLabel || status.planType ? (
            <p className="mt-2 text-xs text-muted">
              {[status.accountLabel, status.planType].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {canManageConnections ? (
            status.connected ? (
              <>
                <Button type="button" size="sm" variant="outline" loading={busy} iconLeft={<RefreshCw className="h-4 w-4" />} onClick={() => onTest(status.provider)}>Test</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} iconLeft={<LogOut className="h-4 w-4" />} onClick={() => onDisconnect(status.provider)}>Disconnect</Button>
              </>
            ) : (
              <Button type="button" size="sm" loading={busy} disabled={!status.available} onClick={() => onConnect(status.provider)}>Connect {label}</Button>
            )
          ) : (
            <span className="text-xs text-muted">Managed by tenant admin</span>
          )}
        </div>
      </div>
    </article>
  );
}
