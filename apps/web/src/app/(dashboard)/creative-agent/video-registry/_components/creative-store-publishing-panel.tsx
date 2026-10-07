'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { fetchAllStoreTargets } from '../_services/creative-store-targets.service';
import {
  fetchMetaOptions,
  fetchPublishingProfile,
  savePublishingProfile,
  type MetaOptions,
  type ProductDestination,
  type PublishingProfile,
  type PublishingProfileValues,
} from '../_services/creative-store-publishing.service';

const EMPTY: PublishingProfileValues = {
  metaAdAccountId: null,
  facebookPageId: null,
  facebookPageName: null,
  instagramAccountId: null,
  instagramUsername: null,
  defaultDailyBudget: 1000,
  countries: ['PH'],
  timezone: 'Asia/Manila',
};

const inputClass = 'input h-10 w-full text-sm';
const selectClass = 'input h-10 w-full text-sm';

/**
 * Where this store launches on Meta.
 *
 * The SOP fixes almost every campaign setting, so this asks only for what the
 * store itself decides: the ad account, the brand's page and Instagram, the
 * daily budget a test starts at, and per product the pixel and landing page.
 * Pages and pixels are fetched from Meta with the tenant's own token so nobody
 * copies ids out of Ads Manager. The send dialog refuses while anything here
 * is missing, and names it.
 */
export function CreativeStorePublishingPanel({ posStoreId, storeConfigId, canEdit, onClose }: {
  posStoreId?: string | null;
  storeConfigId?: string | null;
  canEdit: boolean;
  onClose?: () => void;
}) {
  const [resolvedId, setResolvedId] = useState<string | null | undefined>(storeConfigId ?? undefined);
  const [data, setData] = useState<PublishingProfile | null>(null);
  const [draft, setDraft] = useState<PublishingProfileValues>(EMPTY);
  const [products, setProducts] = useState<ProductDestination[]>([]);
  const [options, setOptions] = useState<MetaOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A store page knows the POS store; the registry knows the config. Resolve either.
  useEffect(() => {
    if (storeConfigId) { setResolvedId(storeConfigId); return; }
    if (!posStoreId) { setResolvedId(null); return; }
    fetchAllStoreTargets()
      .then((all) => setResolvedId(all.find((entry) => entry.posStoreId === posStoreId)?.storeConfigId ?? null))
      .catch(() => setResolvedId(null));
  }, [posStoreId, storeConfigId]);

  const load = useCallback(async () => {
    if (!resolvedId) return;
    setError(null);
    try {
      const result = await fetchPublishingProfile(resolvedId);
      setData(result);
      setDraft(result.profile ? strip(result.profile) : { ...EMPTY, metaAdAccountId: result.adAccounts[0]?.accountId ?? null });
      setProducts(result.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the Meta publishing profile.');
    }
  }, [resolvedId]);

  useEffect(() => { void load(); }, [load]);

  const loadOptions = useCallback(async () => {
    if (!resolvedId) return;
    setLoadingOptions(true);
    try {
      setOptions(await fetchMetaOptions(resolvedId, draft.metaAdAccountId));
    } finally {
      setLoadingOptions(false);
    }
  }, [resolvedId, draft.metaAdAccountId]);

  // Pages and pixels follow the chosen ad account.
  useEffect(() => { if (data) void loadOptions(); }, [data, loadOptions]);

  const stored = useMemo(() => (data?.profile ? strip(data.profile) : null), [data]);
  const dirty = JSON.stringify({ draft, products }) !== JSON.stringify({ draft: stored ?? draft, products: data?.products ?? products });
  const productErrors = useMemo(() => products.flatMap((product, index) => {
    const errors: string[] = [];
    if (!product.posCustomId.trim()) errors.push(`Row ${index + 1}: pick a product.`);
    if (!/^\d{6,32}$/.test(product.pixelId.trim())) errors.push(`${product.posProductName || product.posCustomId || `Row ${index + 1}`}: pixel id must be numeric.`);
    if (!/^https:\/\/\S+$/.test(product.landingPageUrl.trim())) errors.push(`${product.posProductName || product.posCustomId || `Row ${index + 1}`}: landing page must be an https URL.`);
    return errors;
  }), [products]);
  const duplicateProducts = products.map((p) => p.posCustomId).filter((id, i, all) => id && all.indexOf(id) !== i);

  const save = async () => {
    if (!resolvedId || productErrors.length || duplicateProducts.length) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await savePublishingProfile(resolvedId, { ...draft, products });
      setData(result);
      setDraft(result.profile ? strip(result.profile) : EMPTY);
      setProducts(result.products);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the Meta publishing profile.');
    } finally {
      setSaving(false);
    }
  };

  if (resolvedId === undefined || (resolvedId && !data && !error)) {
    return <div className="flex items-center gap-2 py-6 text-sm text-muted"><Spinner /> Loading…</div>;
  }
  if (resolvedId === null) {
    return <p className="py-4 text-sm text-muted">No creatives are enrolled for this store yet, so there is nothing to publish.</p>;
  }
  if (!data) {
    return <p className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>;
  }

  const pageOptions = options?.pages ?? [];
  const pixelOptions = options?.pixels ?? [];
  const pickPage = (id: string) => {
    const page = pageOptions.find((entry) => entry.id === id);
    setDraft((current) => ({
      ...current,
      facebookPageId: id || null,
      facebookPageName: page?.name ?? current.facebookPageName,
      instagramAccountId: page?.instagramAccountId ?? current.instagramAccountId,
      instagramUsername: page?.instagramUsername ?? current.instagramUsername,
    }));
  };
  const unmappedProducts = data.storeProducts.filter((product) => !products.some((entry) => entry.posCustomId === product.customId));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        <span className="font-medium text-foreground">{data.storeName}</span>
        <span className="mx-2 text-border">·</span>
        {data.missing.length
          ? <span className="text-warning">Missing: {data.missing.join(', ')}</span>
          : <span>Ready{data.profile?.updatedBy ? ` · set by ${data.profile.updatedBy}` : ''}{data.profile?.updatedAt ? ` · ${new Date(data.profile.updatedAt).toLocaleDateString()}` : ''}</span>}
      </p>

      <fieldset className="space-y-2.5">
        <legend className="text-[11px] font-medium uppercase tracking-wider text-muted">Account &amp; identity</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="form-label">Ad account</span>
            <select id="publishing-ad-account" className={selectClass} value={draft.metaAdAccountId ?? ''} disabled={!canEdit} onChange={(event) => setDraft((current) => ({ ...current, metaAdAccountId: event.target.value || null }))}>
              <option value="">Choose a connected ad account</option>
              {data.adAccounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.name} · {account.accountId}{account.currency ? ` · ${account.currency}` : ''}</option>)}
            </select>
            {data.adAccounts.length === 0 ? <span className="mt-1 block text-xs text-warning">No Meta ad account is connected. Connect one under Integrations first.</span> : null}
          </label>
          <label className="block">
            <span className="form-label">Daily budget to start a test</span>
            <input id="publishing-budget" type="number" min={1} step="1" className={inputClass} value={draft.defaultDailyBudget ?? ''} disabled={!canEdit} onChange={(event) => setDraft((current) => ({ ...current, defaultDailyBudget: event.target.value === '' ? null : Number(event.target.value) }))} />
          </label>
          <label className="block">
            <span className="form-label flex items-center justify-between">Facebook Page
              <button type="button" className="inline-flex items-center gap-1 text-[11px] font-normal text-primary hover:underline" onClick={() => void loadOptions()} disabled={loadingOptions}><RefreshCcw className={`h-3 w-3 ${loadingOptions ? 'animate-spin' : ''}`} /> from Meta</button>
            </span>
            {pageOptions.length ? (
              <select id="publishing-page" className={selectClass} value={draft.facebookPageId ?? ''} disabled={!canEdit} onChange={(event) => pickPage(event.target.value)}>
                <option value="">Choose the brand's page</option>
                {pageOptions.map((page) => <option key={page.id} value={page.id}>{page.name}{page.instagramUsername ? ` · @${page.instagramUsername}` : ''}</option>)}
              </select>
            ) : (
              <input id="publishing-page-id" className={inputClass} placeholder="Numeric page id" value={draft.facebookPageId ?? ''} disabled={!canEdit} onChange={(event) => setDraft((current) => ({ ...current, facebookPageId: event.target.value.trim() || null }))} />
            )}
            {draft.facebookPageName && !pageOptions.length ? <span className="mt-1 block text-xs text-muted">{draft.facebookPageName}</span> : null}
          </label>
          <label className="block">
            <span className="form-label">Instagram account</span>
            <input id="publishing-ig" className={inputClass} placeholder="Numeric Instagram account id (optional)" value={draft.instagramAccountId ?? ''} disabled={!canEdit} onChange={(event) => setDraft((current) => ({ ...current, instagramAccountId: event.target.value.trim() || null }))} />
            {draft.instagramUsername ? <span className="mt-1 block text-xs text-muted">@{draft.instagramUsername}</span> : null}
          </label>
        </div>
        {options?.error ? <p className="text-xs text-muted">Could not list pages and pixels from Meta: {options.error} You can type the ids instead.</p> : null}
        <p className="text-[11px] text-muted">Fixed by the SOP and not asked here: Sales objective, campaign budget, highest volume, broad targeting in {draft.countries.join(', ')} aged 18+, Advantage+ placements, multi-advertiser ads off, everything created paused.</p>
      </fieldset>

      <fieldset className="space-y-2.5">
        <legend className="text-[11px] font-medium uppercase tracking-wider text-muted">Per product: pixel &amp; landing page</legend>
        <p className="text-xs text-muted">Each product optimises on its own pixel and sends to its own page. A creative with no row here cannot be sent.</p>
        <div className="space-y-2">
          {products.map((product, index) => (
            <div key={`${product.posCustomId}-${index}`} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1.2fr_1fr_1.4fr_auto]">
              <select
                id={`publishing-product-${index}`}
                className={selectClass}
                value={product.posCustomId}
                disabled={!canEdit}
                onChange={(event) => {
                  const chosen = data.storeProducts.find((entry) => entry.customId === event.target.value);
                  setProducts((current) => current.map((row, i) => (i === index ? { ...row, posCustomId: event.target.value, posProductName: chosen?.name ?? row.posProductName } : row)));
                }}
              >
                <option value="">Product</option>
                {product.posCustomId && !data.storeProducts.some((entry) => entry.customId === product.posCustomId) ? <option value={product.posCustomId}>{product.posProductName ?? product.posCustomId}</option> : null}
                {data.storeProducts.map((entry) => <option key={entry.customId} value={entry.customId}>{entry.name} · {entry.customId}{entry.enrolledCreatives ? ` · ${entry.enrolledCreatives} creative${entry.enrolledCreatives === 1 ? '' : 's'}` : ''}</option>)}
              </select>
              {pixelOptions.length ? (
                <select id={`publishing-pixel-${index}`} className={selectClass} value={product.pixelId} disabled={!canEdit} onChange={(event) => setProducts((current) => current.map((row, i) => (i === index ? { ...row, pixelId: event.target.value } : row)))}>
                  <option value="">Pixel</option>
                  {product.pixelId && !pixelOptions.some((pixel) => pixel.id === product.pixelId) ? <option value={product.pixelId}>{product.pixelId}</option> : null}
                  {pixelOptions.map((pixel) => <option key={pixel.id} value={pixel.id}>{pixel.name} · {pixel.id}</option>)}
                </select>
              ) : (
                <input id={`publishing-pixel-${index}`} className={inputClass} placeholder="Pixel id" value={product.pixelId} disabled={!canEdit} onChange={(event) => setProducts((current) => current.map((row, i) => (i === index ? { ...row, pixelId: event.target.value.trim() } : row)))} />
              )}
              <input id={`publishing-landing-${index}`} className={inputClass} placeholder="https://landing page" value={product.landingPageUrl} disabled={!canEdit} onChange={(event) => setProducts((current) => current.map((row, i) => (i === index ? { ...row, landingPageUrl: event.target.value.trim() } : row)))} />
              {canEdit ? (
                <button type="button" aria-label="Remove product" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition hover:bg-destructive-soft hover:text-destructive" onClick={() => setProducts((current) => current.filter((_, i) => i !== index))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : <span />}
            </div>
          ))}
        </div>
        {canEdit ? (
          <Button type="button" size="sm" variant="outline" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => {
            const next = unmappedProducts[0];
            setProducts((current) => [...current, { posCustomId: next?.customId ?? '', posProductName: next?.name ?? null, pixelId: '', landingPageUrl: '', displayLink: null }]);
          }}>
            Add product
          </Button>
        ) : null}
        {unmappedProducts.length && products.length ? <p className="text-[11px] text-muted">{unmappedProducts.length} product{unmappedProducts.length === 1 ? '' : 's'} with enrolled creatives {unmappedProducts.length === 1 ? 'has' : 'have'} no pixel yet: {unmappedProducts.slice(0, 4).map((p) => p.name).join(', ')}{unmappedProducts.length > 4 ? '…' : ''}.</p> : null}
      </fieldset>

      {productErrors.length || duplicateProducts.length ? (
        <ul className="space-y-1 text-xs text-warning">
          {duplicateProducts.map((id) => <li key={`dup-${id}`}>Product {id} is listed twice.</li>)}
          {productErrors.map((message) => <li key={message}>{message}</li>)}
        </ul>
      ) : null}
      {error ? <p className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {saved && !dirty ? <span className="mr-auto flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" /> Saved</span> : null}
        {!canEdit ? <span className="mr-auto text-xs text-muted">Set by whoever manages the store or its performance.</span> : null}
        {onClose ? <Button type="button" variant="ghost" onClick={onClose}>{canEdit ? 'Cancel' : 'Close'}</Button> : null}
        {canEdit ? <Button type="button" size="sm" loading={saving} disabled={!dirty || productErrors.length > 0 || duplicateProducts.length > 0} onClick={() => void save()}>Save</Button> : null}
      </div>
    </div>
  );
}

function strip(values: PublishingProfileValues & Record<string, unknown>): PublishingProfileValues {
  return {
    metaAdAccountId: values.metaAdAccountId,
    facebookPageId: values.facebookPageId,
    facebookPageName: values.facebookPageName,
    instagramAccountId: values.instagramAccountId,
    instagramUsername: values.instagramUsername,
    defaultDailyBudget: values.defaultDailyBudget,
    countries: values.countries?.length ? values.countries : ['PH'],
    timezone: values.timezone || 'Asia/Manila',
  };
}
