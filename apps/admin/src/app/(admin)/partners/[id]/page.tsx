'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, PauseCircle, PlayCircle, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsStatCard } from '../../_components/wms-stat-card';
import { PartnerStatusBadge } from '../_components/partner-status-badge';
import { fetchPartnerById, fetchPartnerTypes, updatePartner, updatePartnerStatus } from '../_services/partners.service';
import type { Partner } from '../_types/partners';

const updatePartnerSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2, 'Partner slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters').max(160),
  partnerTypeId: z.string().uuid('Select a partner type'),
  billingAddress: z.object({
    line1: z.string().min(2, 'Address line is required').max(160),
    line2: z.string().max(160).optional().or(z.literal('')),
    city: z.string().min(2, 'City is required').max(120),
    province: z.string().max(120).optional().or(z.literal('')),
    postalCode: z.string().max(40).optional().or(z.literal('')),
    country: z.string().min(2, 'Country is required').max(120),
  }),
  planType: z.enum(['trial', 'starter', 'professional', 'enterprise']),
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']),
  maxUsers: z.coerce.number().min(1).max(10000),
  maxIntegrations: z.coerce.number().min(1).max(100),
});

type UpdatePartnerForm = z.infer<typeof updatePartnerSchema>;

const inputClassName =
  'mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100';

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (typeof response?.data?.message === 'string') {
      return response.data.message;
    }
  }
  return fallback;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PartnerDetailsPage() {
  const params = useParams();
  const partnerId = params.id as string;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const partnerTypesQuery = useQuery({
    queryKey: ['wms-partner-types'],
    queryFn: fetchPartnerTypes,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdatePartnerForm>({
    resolver: zodResolver(updatePartnerSchema),
  });

  useEffect(() => {
    const loadPartner = async () => {
      try {
        const data = await fetchPartnerById(partnerId);
        setPartner(data);
        reset({
          name: data.name,
          slug: data.slug,
          companyName: data.companyName || data.name,
          partnerTypeId: data.partnerTypeId || '',
          billingAddress: {
            line1: data.billingAddress?.line1 || '',
            line2: data.billingAddress?.line2 || '',
            city: data.billingAddress?.city || '',
            province: data.billingAddress?.province || '',
            postalCode: data.billingAddress?.postalCode || '',
            country: data.billingAddress?.country || 'Philippines',
          },
          planType: data.planType as UpdatePartnerForm['planType'],
          status: data.status as UpdatePartnerForm['status'],
          maxUsers: data.maxUsers,
          maxIntegrations: data.maxIntegrations,
        });
      } catch (error: unknown) {
        setError(getErrorMessage(error, 'Failed to load partner'));
      } finally {
        setIsLoading(false);
      }
    };

    loadPartner();
  }, [partnerId, reset]);

  const onSubmit = async (data: UpdatePartnerForm) => {
    setError('');
    setSuccessMessage('');
    setIsSaving(true);
    try {
      await updatePartner(partnerId, data);
      const latest = await fetchPartnerById(partnerId);
      setPartner(latest);
      setSuccessMessage('Partner updated successfully.');
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to update partner'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (status: UpdatePartnerForm['status']) => {
    setError('');
    setSuccessMessage('');
    try {
      await updatePartnerStatus(partnerId, status);
      const latest = await fetchPartnerById(partnerId);
      setPartner(latest);
      reset({
        name: latest.name,
        slug: latest.slug,
        companyName: latest.companyName || latest.name,
        partnerTypeId: latest.partnerTypeId || '',
        billingAddress: {
          line1: latest.billingAddress?.line1 || '',
          line2: latest.billingAddress?.line2 || '',
          city: latest.billingAddress?.city || '',
          province: latest.billingAddress?.province || '',
          postalCode: latest.billingAddress?.postalCode || '',
          country: latest.billingAddress?.country || 'Philippines',
        },
        planType: latest.planType as UpdatePartnerForm['planType'],
        status: latest.status as UpdatePartnerForm['status'],
        maxUsers: latest.maxUsers,
        maxIntegrations: latest.maxIntegrations,
      });
      setSuccessMessage(`Partner ${status === 'ACTIVE' ? 'activated' : 'suspended'} successfully.`);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to update partner status'));
    }
  };

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading partner workspace...</div>;
  }

  if (!partner) {
    return <div className="py-16 text-center text-sm text-rose-600">Partner not found.</div>;
  }

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title={partner.name}
        description="Manage partner identity, activation state, and capacity limits before enabling downstream warehouse workflows."
        eyebrow="Partner Profile"
        actions={
          <Link
            href="/partners"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-orange-200 hover:text-orange-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Partners
          </Link>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <WmsStatCard
          label="Status"
          value={partner.status}
          description="Current operating state"
          icon={Building2}
          accent={partner.status === 'ACTIVE' ? 'emerald' : partner.status === 'SUSPENDED' ? 'rose' : 'orange'}
        />
        <WmsStatCard
          label="Users"
          value={partner.maxUsers}
          description="Allowed workspace users"
          icon={Building2}
        />
        <WmsStatCard
          label="Integrations"
          value={partner.maxIntegrations}
          description="Allowed system connections"
          icon={Building2}
          accent="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <WmsSectionCard title="Partner Settings" icon={<Building2 className="h-3.5 w-3.5" />}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Organization Name</label>
                <input {...register('name')} type="text" className={inputClassName} />
                {errors.name ? <p className="mt-2 text-sm text-rose-600">{errors.name.message}</p> : null}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Legal Company Name</label>
                <input {...register('companyName')} type="text" className={inputClassName} />
                {errors.companyName ? <p className="mt-2 text-sm text-rose-600">{errors.companyName.message}</p> : null}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Partner Type</label>
                <select {...register('partnerTypeId')} className={inputClassName}>
                  <option value="">Select partner type</option>
                  {(partnerTypesQuery.data || []).map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {errors.partnerTypeId ? <p className="mt-2 text-sm text-rose-600">{errors.partnerTypeId.message}</p> : null}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Partner Slug</label>
                <input {...register('slug')} type="text" className={inputClassName} />
                {errors.slug ? <p className="mt-2 text-sm text-rose-600">{errors.slug.message}</p> : null}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Plan Type</label>
                <select {...register('planType')} className={inputClassName}>
                  <option value="trial">Trial</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select {...register('status')} className={inputClassName}>
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Max Users</label>
                <input {...register('maxUsers')} type="number" className={inputClassName} />
                {errors.maxUsers ? <p className="mt-2 text-sm text-rose-600">{errors.maxUsers.message}</p> : null}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Max Integrations</label>
                <input {...register('maxIntegrations')} type="number" className={inputClassName} />
                {errors.maxIntegrations ? <p className="mt-2 text-sm text-rose-600">{errors.maxIntegrations.message}</p> : null}
              </div>
            </div>
          </WmsSectionCard>

          <WmsSectionCard title="Billing Address" icon={<Building2 className="h-3.5 w-3.5" />}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Address Line 1</label>
                <input {...register('billingAddress.line1')} type="text" className={inputClassName} />
                {errors.billingAddress?.line1 ? <p className="mt-2 text-sm text-rose-600">{errors.billingAddress.line1.message}</p> : null}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Address Line 2</label>
                <input {...register('billingAddress.line2')} type="text" className={inputClassName} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">City</label>
                <input {...register('billingAddress.city')} type="text" className={inputClassName} />
                {errors.billingAddress?.city ? <p className="mt-2 text-sm text-rose-600">{errors.billingAddress.city.message}</p> : null}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Province / State</label>
                <input {...register('billingAddress.province')} type="text" className={inputClassName} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Postal Code</label>
                <input {...register('billingAddress.postalCode')} type="text" className={inputClassName} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Country</label>
                <input {...register('billingAddress.country')} type="text" className={inputClassName} />
                {errors.billingAddress?.country ? <p className="mt-2 text-sm text-rose-600">{errors.billingAddress.country.message}</p> : null}
              </div>
            </div>
          </WmsSectionCard>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Partner'}
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <WmsSectionCard title="Partner Snapshot" metadata={<PartnerStatusBadge status={partner.status} />}>
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Legal Company Name</dt>
                <dd className="mt-1 text-slate-900">{partner.companyName || partner.name}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Partner Type</dt>
                <dd className="mt-1 text-slate-900">{partner.partnerType?.name || 'Not set'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Billing Address</dt>
                <dd className="mt-1 text-slate-900">
                  {partner.billingAddress
                    ? [
                        partner.billingAddress.line1,
                        partner.billingAddress.line2,
                        partner.billingAddress.city,
                        partner.billingAddress.province,
                        partner.billingAddress.postalCode,
                        partner.billingAddress.country,
                      ]
                        .filter(Boolean)
                        .join(', ')
                    : 'Not configured'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Created</dt>
                <dd className="mt-1 text-slate-900">{formatDate(partner.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Updated</dt>
                <dd className="mt-1 text-slate-900">{partner.updatedAt ? formatDate(partner.updatedAt) : 'Not available'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Trial Ends</dt>
                <dd className="mt-1 text-slate-900">{partner.trialEndsAt ? formatDate(partner.trialEndsAt) : 'Open ended'}</dd>
              </div>
            </dl>
          </WmsSectionCard>

          <WmsSectionCard title="Activation Controls" metadata="Operational state">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleStatusChange('ACTIVE')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:border-emerald-300"
              >
                <PlayCircle className="h-4 w-4" />
                Activate Partner
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('SUSPENDED')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition-colors hover:border-amber-300"
              >
                <PauseCircle className="h-4 w-4" />
                Suspend Partner
              </button>
            </div>
          </WmsSectionCard>
        </div>
      </div>
    </div>
  );
}
