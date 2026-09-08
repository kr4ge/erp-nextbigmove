'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/feedback';
import type { BenchmarkSettings } from '../_lib/types';

/**
 * The benchmark editor.
 *
 * These seven numbers decide what every verdict on every other screen says, so
 * the form shows what it is measuring in the operator's own words rather than
 * the field name. Money is typed in pesos; the API stores centavos.
 */

interface FieldSpec {
  key: keyof BenchmarkSettings['benchmark'];
  label: string;
  help: string;
  kind: 'peso' | 'percent' | 'multiple';
}

const FIELDS: FieldSpec[] = [
  { key: 'cpp', label: 'CPP ceiling', help: 'Most you will pay for one order', kind: 'peso' },
  { key: 'cpm', label: 'CPM ceiling', help: 'Most you will pay per 1,000 impressions', kind: 'peso' },
  { key: 'ctrPct', label: 'CTR floor', help: 'Link clicks per 100 impressions', kind: 'percent' },
  { key: 'deliveryRate', label: 'Delivery floor', help: 'Orders that must actually arrive', kind: 'percent' },
  { key: 'cancelRate', label: 'Cancel ceiling', help: 'Orders you can afford to lose', kind: 'percent' },
  { key: 'rtsRate', label: 'RTS ceiling', help: 'Shipped orders that come back', kind: 'percent' },
  { key: 'targetMer', label: 'MER floor', help: 'Delivered money per peso of spend', kind: 'multiple' },
];

/** Stored values are centavos or fractions; the form speaks pesos and percents. */
function toInput(value: number, kind: FieldSpec['kind']): string {
  if (kind === 'peso') return String(value / 100);
  if (kind === 'percent') return String(Math.round(value * 1000) / 10);
  return String(value);
}

function fromInput(raw: string, kind: FieldSpec['kind']): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  if (kind === 'percent') return value / 100;
  return value;
}

export function SettingsSection({ canManage }: { canManage: boolean }) {
  const [settings, setSettings] = useState<BenchmarkSettings | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient
      .get<BenchmarkSettings>('/advertising/benchmark')
      .then((response) => {
        setSettings(response.data);
        setLabel(response.data.label);
        const next: Record<string, string> = {};
        FIELDS.forEach((f) => {
          next[f.key] = toInput(response.data.benchmark[f.key], f.kind);
        });
        setValues(next);
      })
      .catch((err) => {
        const e = err as { response?: { data?: { message?: string } } };
        setError(e?.response?.data?.message || 'Could not load the benchmark.');
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const payload: Record<string, unknown> = { label };
      FIELDS.forEach((f) => {
        payload[f.key] = fromInput(values[f.key] ?? '0', f.kind);
      });
      const response = await apiClient.put<BenchmarkSettings>('/advertising/benchmark', payload);
      setSettings(response.data);
      setSaved(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'The benchmark was not saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="panel panel-content">
        <div className="p-6 text-sm text-muted">Loading…</div>
      </section>
    );
  }

  return (
    <section className="panel panel-content">
      <div className="panel-header flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="panel-icon" />
          <h4 className="panel-title">Benchmark</h4>
        </div>
        {settings?.isDefault ? (
          <span className="ml-auto shrink-0 pill pill-neutral">Platform default</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 p-5">
        <p className="max-w-prose text-sm text-muted">
          The floor every ad is measured against. Change these and every verdict on every screen
          changes with them.
        </p>

        {error ? <AlertBanner tone="error" message={error} /> : null}
        {saved ? <AlertBanner tone="success" message="Benchmark saved." /> : null}

        <div className="flex flex-col gap-1">
          <label className="form-label" htmlFor="bm-label">Name</label>
          <input
            id="bm-label"
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={!canManage}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="form-label" htmlFor={`bm-${field.key}`}>
                {field.label}
              </label>
              <div className="flex items-center gap-2">
                {field.kind === 'peso' ? <span className="text-sm text-muted">₱</span> : null}
                <input
                  id={`bm-${field.key}`}
                  type="number"
                  step="any"
                  min="0"
                  className="input"
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  disabled={!canManage}
                />
                {field.kind === 'percent' ? <span className="text-sm text-muted">%</span> : null}
                {field.kind === 'multiple' ? <span className="text-sm text-muted">×</span> : null}
              </div>
              <p className="text-xs text-muted">{field.help}</p>
            </div>
          ))}
        </div>

        {canManage ? (
          <div className="flex items-center gap-3">
            <Button variant="primary" size="md" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save benchmark'}
            </Button>
            {settings?.updatedAt ? (
              <span className="text-xs text-muted">
                Last changed {new Date(settings.updatedAt).toLocaleDateString('en-PH')}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">
            You can see the benchmark but not change it. Moving the floor changes what counts as
            failing, so it sits with whoever owns the numbers.
          </p>
        )}
      </div>
    </section>
  );
}
