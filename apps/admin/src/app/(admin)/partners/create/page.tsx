'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Building2, Layers3, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { createPartner, fetchPartnerTypes } from '../_services/partners.service';

const createPartnerSchema = z.object({
  tenantName: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  tenantSlug: z
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
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, 'Password must contain uppercase, lowercase, and number/special character'),
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
  planType: z.enum(['trial', 'starter', 'professional', 'enterprise']),
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']),
  maxUsers: z.coerce.number().min(1).max(10000),
  maxIntegrations: z.coerce.number().min(1).max(100),
  trialDays: z.coerce.number().min(0).max(365).optional(),
});

type CreatePartnerForm = z.infer<typeof createPartnerSchema>;

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

export default function CreatePartnerPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const partnerTypesQuery = useQuery({
    queryKey: ['wms-partner-types'],
    queryFn: fetchPartnerTypes,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatePartnerForm>({
    resolver: zodResolver(createPartnerSchema),
    defaultValues: {
      planType: 'trial',
      status: 'TRIAL',
      maxUsers: 10,
      maxIntegrations: 5,
      trialDays: 14,
      companyName: '',
      partnerTypeId: '',
      billingAddress: {
        line1: '',
        line2: '',
        city: '',
        province: '',
        postalCode: '',
        country: 'Philippines',
      },
    },
  });

  const handleTenantNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setValue('tenantSlug', slug);
  };

  const planType = watch('planType');

  const onSubmit = async (data: CreatePartnerForm) => {
    setError('');
    setIsLoading(true);
    try {
      await createPartner(data);
      router.push('/partners');
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to create partner. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Create Partner"
        description="Set up a new partner workspace, assign its primary admin, and define operating limits before WMS workflows go live."
        eyebrow="Partner Onboarding"
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <WmsSectionCard title="Partner Identity" icon={<Building2 className="h-3.5 w-3.5" />}>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Organization Name</label>
              <input
                {...register('tenantName')}
                type="text"
                onChange={(event) => {
                  register('tenantName').onChange(event);
                  handleTenantNameChange(event.target.value);
                }}
                className={inputClassName}
                placeholder="Next Big Move Fulfillment"
              />
              {errors.tenantName ? <p className="mt-2 text-sm text-rose-600">{errors.tenantName.message}</p> : null}
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Legal Company Name</label>
              <input
                {...register('companyName')}
                type="text"
                className={inputClassName}
                placeholder="Zenith Digital Trading Inc."
              />
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
              <input {...register('tenantSlug')} type="text" className={inputClassName} placeholder="next-big-move" />
              {errors.tenantSlug ? <p className="mt-2 text-sm text-rose-600">{errors.tenantSlug.message}</p> : null}
            </div>
          </div>
        </WmsSectionCard>

        <WmsSectionCard title="Billing Address" icon={<Building2 className="h-3.5 w-3.5" />}>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Address Line 1</label>
              <input {...register('billingAddress.line1')} type="text" className={inputClassName} placeholder="17th Floor Tower 2 Insular Life Centre" />
              {errors.billingAddress?.line1 ? <p className="mt-2 text-sm text-rose-600">{errors.billingAddress.line1.message}</p> : null}
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Address Line 2</label>
              <input {...register('billingAddress.line2')} type="text" className={inputClassName} placeholder="Optional" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">City</label>
              <input {...register('billingAddress.city')} type="text" className={inputClassName} placeholder="Muntinlupa City" />
              {errors.billingAddress?.city ? <p className="mt-2 text-sm text-rose-600">{errors.billingAddress.city.message}</p> : null}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Province / State</label>
              <input {...register('billingAddress.province')} type="text" className={inputClassName} placeholder="Metro Manila" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Postal Code</label>
              <input {...register('billingAddress.postalCode')} type="text" className={inputClassName} placeholder="1780" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Country</label>
              <input {...register('billingAddress.country')} type="text" className={inputClassName} placeholder="Philippines" />
              {errors.billingAddress?.country ? <p className="mt-2 text-sm text-rose-600">{errors.billingAddress.country.message}</p> : null}
            </div>
          </div>
        </WmsSectionCard>

        <WmsSectionCard title="Primary Admin" icon={<User className="h-3.5 w-3.5" />}>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">First Name</label>
              <input {...register('firstName')} type="text" className={inputClassName} placeholder="John" />
              {errors.firstName ? <p className="mt-2 text-sm text-rose-600">{errors.firstName.message}</p> : null}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Last Name</label>
              <input {...register('lastName')} type="text" className={inputClassName} placeholder="Doe" />
              {errors.lastName ? <p className="mt-2 text-sm text-rose-600">{errors.lastName.message}</p> : null}
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Email Address</label>
              <input {...register('email')} type="email" className={inputClassName} placeholder="admin@partner.com" />
              {errors.email ? <p className="mt-2 text-sm text-rose-600">{errors.email.message}</p> : null}
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input {...register('password')} type="password" className={inputClassName} placeholder="Strong password" />
              {errors.password ? <p className="mt-2 text-sm text-rose-600">{errors.password.message}</p> : null}
            </div>
          </div>
        </WmsSectionCard>

        <WmsSectionCard title="Access Plan" icon={<Layers3 className="h-3.5 w-3.5" />} metadata="Operational limits">
          <div className="grid gap-5 md:grid-cols-2">
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
            {planType === 'trial' ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Trial Days</label>
                <input {...register('trialDays')} type="number" className={inputClassName} />
                {errors.trialDays ? <p className="mt-2 text-sm text-rose-600">{errors.trialDays.message}</p> : null}
              </div>
            ) : null}
          </div>
        </WmsSectionCard>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Creating partner...' : 'Create Partner'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
