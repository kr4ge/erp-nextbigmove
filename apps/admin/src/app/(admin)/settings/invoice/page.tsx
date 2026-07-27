'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Building2, FileText, ImagePlus, Landmark, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { readStoredAdminUser, readStoredPermissions, type StoredAdminUser } from '@/lib/admin-session';
import {
  hasAnyAdminPermission,
  WMS_INVOICE_SETTINGS_READ_PERMISSIONS,
  WMS_INVOICE_SETTINGS_WRITE_PERMISSIONS,
} from '@/lib/wms-permissions';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import { WmsFormField } from '../../_components/wms-form-field';
import {
  SettingsNotice,
  SettingsPageFrame,
  SettingsStatCard,
} from '../_components/settings-panels';
import {
  fetchWmsInvoiceSettings,
  updateWmsInvoiceSettings,
  uploadWmsInvoiceLogo,
} from '../_services/settings.service';
import type {
  UpdateWmsInvoiceSettingsInput,
  WmsInvoiceSettingsRecord,
  WmsInvoiceSettingsResponse,
} from '../_types/settings';

type InvoiceSettingsForm = {
  companyName: string;
  companyAddress: string;
  logoAssetId: string | null;
  invoicePrefix: string;
  paymentProfiles: PaymentProfileForm[];
  footerNotes: string;
};

type PaymentProfileForm = {
  key: string;
  id: string | null;
  name: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankAccountType: string;
  bankBranch: string;
  paymentInstructions: string;
  isDefault: boolean;
};

const EMPTY_FORM: InvoiceSettingsForm = {
  companyName: '',
  companyAddress: '',
  logoAssetId: null,
  invoicePrefix: 'INV',
  paymentProfiles: [],
  footerNotes: '',
};

export default function SettingsInvoicePage() {
  const [user, setUser] = useState<StoredAdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [data, setData] = useState<WmsInvoiceSettingsResponse | null>(null);
  const [form, setForm] = useState<InvoiceSettingsForm>(EMPTY_FORM);
  const [logoPreview, setLogoPreview] = useState<WmsInvoiceSettingsRecord['logoAsset'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const syncSession = () => {
      const storedUser = readStoredAdminUser();
      setUser(storedUser);
      setPermissions(readStoredPermissions());
      setHasHydrated(true);
    };

    syncSession();
    window.addEventListener('wmsTenantScopeChanged', syncSession);
    window.addEventListener('storage', syncSession);

    return () => {
      window.removeEventListener('wmsTenantScopeChanged', syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, []);

  const canRead = useMemo(
    () => hasAnyAdminPermission(user?.role, permissions, WMS_INVOICE_SETTINGS_READ_PERMISSIONS),
    [permissions, user?.role],
  );
  const canWrite = useMemo(
    () => hasAnyAdminPermission(user?.role, permissions, WMS_INVOICE_SETTINGS_WRITE_PERMISSIONS),
    [permissions, user?.role],
  );

  const loadSettings = useCallback(async () => {
    const response = await fetchWmsInvoiceSettings();
    setData(response);
    setForm(mapSettingsToForm(response.settings));
    setLogoPreview(response.settings.logoAsset);
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!canRead) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    loadSettings()
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(getErrorMessage(loadError, 'Unable to load invoice settings.'));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canRead, hasHydrated, loadSettings]);

  const setField = (key: keyof InvoiceSettingsForm, value: string | null) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updatePaymentProfile = (
    profileKey: string,
    patch: Partial<Omit<PaymentProfileForm, 'key'>>,
  ) => {
    setForm((current) => ({
      ...current,
      paymentProfiles: current.paymentProfiles.map((profile) => (
        profile.key === profileKey ? { ...profile, ...patch } : profile
      )),
    }));
  };

  const addPaymentProfile = () => {
    setForm((current) => ({
      ...current,
      paymentProfiles: [
        ...current.paymentProfiles,
        {
          key: `new-${Date.now()}-${current.paymentProfiles.length}`,
          id: null,
          name: '',
          bankName: '',
          bankAccountName: '',
          bankAccountNumber: '',
          bankAccountType: '',
          bankBranch: '',
          paymentInstructions: '',
          isDefault: current.paymentProfiles.length === 0,
        },
      ],
    }));
  };

  const removePaymentProfile = (profileKey: string) => {
    setForm((current) => {
      const removedProfile = current.paymentProfiles.find((profile) => profile.key === profileKey);
      const paymentProfiles = current.paymentProfiles.filter((profile) => profile.key !== profileKey);
      if (removedProfile?.isDefault && paymentProfiles.length) {
        paymentProfiles[0] = { ...paymentProfiles[0], isDefault: true };
      }
      return {
        ...current,
        paymentProfiles,
      };
    });
  };

  const setDefaultPaymentProfile = (profileKey: string) => {
    setForm((current) => ({
      ...current,
      paymentProfiles: current.paymentProfiles.map((profile) => ({
        ...profile,
        isDefault: profile.key === profileKey,
      })),
    }));
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingLogo(true);
    setMessage(null);
    setError(null);

    try {
      const asset = await uploadWmsInvoiceLogo(file);
      setLogoPreview(asset);
      setForm((current) => ({
        ...current,
        logoAssetId: asset.id,
      }));
      setMessage({ tone: 'success', text: 'Invoice logo uploaded. Save settings to keep it.' });
    } catch (uploadError: unknown) {
      setMessage({
        tone: 'danger',
        text: getErrorMessage(uploadError, 'Unable to upload invoice logo.'),
      });
    } finally {
      setIsUploadingLogo(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || !canWrite) {
      return;
    }

    if (form.paymentProfiles.some((profile) => !profile.name.trim())) {
      setMessage({ tone: 'danger', text: 'Every payment option needs a name.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    const payload: UpdateWmsInvoiceSettingsInput = {
      companyName: form.companyName.trim() || null,
      companyAddress: form.companyAddress.trim() || null,
      logoAssetId: form.logoAssetId,
      invoicePrefix: form.invoicePrefix.trim() || null,
      paymentProfiles: form.paymentProfiles.map((profile, index) => ({
        ...(profile.id ? { id: profile.id } : {}),
        name: profile.name.trim(),
        bankName: profile.bankName.trim() || null,
        bankAccountName: profile.bankAccountName.trim() || null,
        bankAccountNumber: profile.bankAccountNumber.trim() || null,
        bankAccountType: profile.bankAccountType.trim() || null,
        bankBranch: profile.bankBranch.trim() || null,
        paymentInstructions: profile.paymentInstructions.trim() || null,
        isDefault: profile.isDefault,
        sortOrder: index,
      })),
      footerNotes: form.footerNotes.trim() || null,
    };

    try {
      const response = await updateWmsInvoiceSettings(payload);
      setData(response);
      setForm(mapSettingsToForm(response.settings));
      setLogoPreview(response.settings.logoAsset);
      setMessage({ tone: 'success', text: 'Invoice settings updated.' });
    } catch (saveError: unknown) {
      setMessage({
        tone: 'danger',
        text: getErrorMessage(saveError, 'Unable to update invoice settings.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!data) {
      return;
    }

    setForm(mapSettingsToForm(data.settings));
    setLogoPreview(data.settings.logoAsset);
    setMessage(null);
    setError(null);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setForm((current) => ({
      ...current,
      logoAssetId: null,
    }));
  };

  return (
    <SettingsPageFrame
      eyebrow="WMS Settings"
      title="Invoice"
      description="Configure the invoice identity, billing details, payment details, and logo used by WMS purchasing invoices."
      actions={
        canRead ? (
          <button
            type="button"
            onClick={() => void loadSettings()}
            className="btn btn-md btn-outline btn-icon"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        ) : null
      }
    >
      {!hasHydrated ? (
        <SettingsNotice title="Loading invoice settings" message="Checking your WMS permissions." />
      ) : !canRead ? (
        <SettingsNotice
          tone="danger"
          title="Access blocked"
          message="Your WMS role does not include invoice settings access."
        />
      ) : error ? (
        <SettingsNotice tone="danger" title="Unable to load invoice settings" message={error} />
      ) : isLoading ? (
        <SettingsNotice
          title="Loading invoice settings"
          message="Fetching global WMS invoice identity, payment details, and invoice logo."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <SettingsStatCard label="Scope" value="Global WMS" tone="blue" />
            <SettingsStatCard label="Invoice Prefix" value={form.invoicePrefix || 'INV'} tone="gold" />
            <SettingsStatCard label="Logo" value={logoPreview ? 'Uploaded' : 'Not set'} />
            <SettingsStatCard label="Editable" value={canWrite ? 'Yes' : 'Read only'} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {message ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  message.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-12">
              <div className="space-y-4 xl:col-span-8">
                <WmsCompactPanel title="Invoice Identity" icon={<FileText className="panel-icon" />}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <WmsFormField label="Company name">
                      <input
                        value={form.companyName}
                        onChange={(event) => setField('companyName', event.target.value)}
                        className="input"
                        disabled={!canWrite}
                      />
                    </WmsFormField>

                    <WmsFormField label="Invoice prefix">
                      <input
                        value={form.invoicePrefix}
                        onChange={(event) => setField('invoicePrefix', event.target.value.toUpperCase())}
                        className="input"
                        disabled={!canWrite}
                        maxLength={40}
                      />
                    </WmsFormField>

                    <div className="md:col-span-2">
                      <WmsFormField label="Company address">
                        <textarea
                          value={form.companyAddress}
                          onChange={(event) => setField('companyAddress', event.target.value)}
                          className="input min-h-28 resize-y py-3"
                          disabled={!canWrite}
                        />
                      </WmsFormField>
                    </div>
                  </div>
                </WmsCompactPanel>

                <WmsCompactPanel
                  title="Payment Information"
                  icon={<Landmark className="panel-icon" />}
                  meta={`${form.paymentProfiles.length} option${form.paymentProfiles.length === 1 ? '' : 's'}`}
                >
                  <div className="space-y-3">
                    {form.paymentProfiles.length ? form.paymentProfiles.map((profile, index) => (
                      <div
                        key={profile.key}
                        className="rounded-2xl border border-[#dce5eb] bg-[#fbfcfc] p-4"
                      >
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e9f1f5] text-xs font-semibold text-primary">
                              {index + 1}
                            </span>
                            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#29495a]">
                              <input
                                type="radio"
                                name="defaultPaymentProfile"
                                checked={profile.isDefault}
                                onChange={() => setDefaultPaymentProfile(profile.key)}
                                disabled={!canWrite}
                              />
                              Default payment option
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePaymentProfile(profile.key)}
                            disabled={!canWrite}
                            className="btn btn-sm btn-ghost btn-icon text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <WmsFormField label="Payment option name" hint="Shown in the manual invoice dropdown.">
                              <input
                                value={profile.name}
                                onChange={(event) => updatePaymentProfile(profile.key, { name: event.target.value })}
                                className="input"
                                placeholder="UnionBank - Main account"
                                disabled={!canWrite}
                              />
                            </WmsFormField>
                          </div>

                          <WmsFormField label="Bank name">
                            <input
                              value={profile.bankName}
                              onChange={(event) => updatePaymentProfile(profile.key, { bankName: event.target.value })}
                              className="input"
                              disabled={!canWrite}
                            />
                          </WmsFormField>

                          <WmsFormField label="Account name">
                            <input
                              value={profile.bankAccountName}
                              onChange={(event) => updatePaymentProfile(profile.key, { bankAccountName: event.target.value })}
                              className="input"
                              disabled={!canWrite}
                            />
                          </WmsFormField>

                          <WmsFormField label="Account number">
                            <input
                              value={profile.bankAccountNumber}
                              onChange={(event) => updatePaymentProfile(profile.key, { bankAccountNumber: event.target.value })}
                              className="input"
                              disabled={!canWrite}
                            />
                          </WmsFormField>

                          <WmsFormField label="Account type">
                            <input
                              value={profile.bankAccountType}
                              onChange={(event) => updatePaymentProfile(profile.key, { bankAccountType: event.target.value })}
                              className="input"
                              disabled={!canWrite}
                            />
                          </WmsFormField>

                          <WmsFormField label="Bank branch">
                            <input
                              value={profile.bankBranch}
                              onChange={(event) => updatePaymentProfile(profile.key, { bankBranch: event.target.value })}
                              className="input"
                              disabled={!canWrite}
                            />
                          </WmsFormField>

                          <div className="md:col-span-2">
                            <WmsFormField label="Payment instructions">
                              <textarea
                                value={profile.paymentInstructions}
                                onChange={(event) => updatePaymentProfile(profile.key, { paymentInstructions: event.target.value })}
                                className="input min-h-24 resize-y py-3"
                                disabled={!canWrite}
                              />
                            </WmsFormField>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-[#cfdce4] bg-[#fbfcfc] px-5 py-8 text-center">
                        <p className="text-sm font-medium text-foreground">No payment options configured</p>
                        <p className="mt-1 text-sm text-muted">Add a bank account or payment method for invoice selection.</p>
                      </div>
                    )}

                    {canWrite ? (
                      <button
                        type="button"
                        onClick={addPaymentProfile}
                        className="btn btn-md btn-outline"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add payment option
                      </button>
                    ) : null}
                  </div>
                </WmsCompactPanel>

                <WmsCompactPanel title="Footer Notes" icon={<Building2 className="panel-icon" />}>
                  <div className="grid gap-4">
                    <WmsFormField label="Footer notes" hint="Shown under payment details or at the bottom of invoice exports later.">
                      <textarea
                        value={form.footerNotes}
                        onChange={(event) => setField('footerNotes', event.target.value)}
                        className="input min-h-28 resize-y py-3"
                        disabled={!canWrite}
                      />
                    </WmsFormField>
                  </div>
                </WmsCompactPanel>
              </div>

              <div className="space-y-4 xl:col-span-4">
                <WmsCompactPanel
                  title="Invoice Logo"
                  icon={<ImagePlus className="panel-icon" />}
                  meta={logoPreview?.originalFileName ?? undefined}
                >
                  <div className="space-y-4">
                    <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-border bg-background-secondary/60 p-4">
                      {logoPreview?.imageUrl ? (
                        <img
                          src={logoPreview.imageUrl}
                          alt="Invoice logo"
                          className="max-h-48 w-auto max-w-full rounded-xl object-contain"
                        />
                        ) : (
                        <div className="text-center text-sm text-muted">
                          <p className="font-medium text-foreground">No invoice logo uploaded</p>
                          <p className="mt-1">Upload a logo once and reuse it across WMS invoices for all staff.</p>
                        </div>
                      )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!canWrite || isUploadingLogo}
                        className="btn btn-md btn-outline btn-icon"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {isUploadingLogo ? 'Uploading...' : logoPreview ? 'Replace logo' : 'Upload logo'}
                      </button>

                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        disabled={!canWrite || (!logoPreview && !form.logoAssetId)}
                        className="btn btn-md btn-ghost btn-icon"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                </WmsCompactPanel>
              </div>
            </div>

            {canWrite ? (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSaving}
                  className="btn btn-md btn-ghost"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-md btn-primary"
                >
                  {isSaving ? 'Saving...' : 'Save invoice settings'}
                </button>
              </div>
            ) : null}
          </form>
        </div>
      )}
    </SettingsPageFrame>
  );
}

function mapSettingsToForm(settings: WmsInvoiceSettingsRecord): InvoiceSettingsForm {
  return {
    companyName: settings.companyName ?? '',
    companyAddress: settings.companyAddress ?? '',
    logoAssetId: settings.logoAsset?.id ?? null,
    invoicePrefix: settings.invoicePrefix ?? 'INV',
    paymentProfiles: settings.paymentProfiles.map((profile, index) => ({
      key: profile.id ?? `legacy-${index}`,
      id: profile.id,
      name: profile.name,
      bankName: profile.bankName ?? '',
      bankAccountName: profile.bankAccountName ?? '',
      bankAccountNumber: profile.bankAccountNumber ?? '',
      bankAccountType: profile.bankAccountType ?? '',
      bankBranch: profile.bankBranch ?? '',
      paymentInstructions: profile.paymentInstructions ?? '',
      isDefault: profile.isDefault,
    })),
    footerNotes: settings.footerNotes ?? '',
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof (error as { response?: unknown }).response === 'object'
    && typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
  }

  return fallback;
}
