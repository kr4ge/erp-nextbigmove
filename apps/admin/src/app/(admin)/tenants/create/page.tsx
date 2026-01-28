'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import apiClient from '@/lib/api-client';
import Link from 'next/link';

const createTenantSchema = z.object({
  // Tenant Information
  tenantName: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  tenantSlug: z
    .string()
    .min(2, 'Tenant slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),

  // Admin User Information
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(
      /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/,
      'Password must contain uppercase, lowercase, and number/special character'
    ),
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),

  // Plan & Limits
  planType: z.enum(['trial', 'starter', 'professional', 'enterprise']),
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']),
  maxUsers: z.number().min(1).max(10000),
  maxIntegrations: z.number().min(1).max(100),
  trialDays: z.number().min(0).max(365).optional(),
});

type CreateTenantForm = z.infer<typeof createTenantSchema>;

export default function CreateTenantPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTenantForm>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      planType: 'trial',
      status: 'TRIAL',
      maxUsers: 10,
      maxIntegrations: 5,
      trialDays: 14,
    },
  });

  // Auto-generate slug from tenant name
  const handleTenantNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setValue('tenantSlug', slug);
  };

  const planType = watch('planType');

  const onSubmit = async (data: CreateTenantForm) => {
    setError('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      await apiClient.post('/tenants', data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Redirect to tenants list
      router.push('/tenants');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create tenant. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Link
            href="/tenants"
            className="text-gray-400 hover:text-gray-300"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold text-white">Create New Tenant</h1>
        </div>
        <p className="text-gray-400">
          Create a new tenant organization with an admin user account
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Tenant Information */}
        <div className="bg-slate-800 shadow rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Tenant Information</h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="tenantName" className="block text-sm font-medium text-gray-300">
                Organization Name
              </label>
              <input
                {...register('tenantName')}
                type="text"
                onChange={(e) => {
                  register('tenantName').onChange(e);
                  handleTenantNameChange(e.target.value);
                }}
                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Acme Corporation"
              />
              {errors.tenantName && (
                <p className="mt-1 text-sm text-red-400">{errors.tenantName.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="tenantSlug" className="block text-sm font-medium text-gray-300">
                Tenant Slug (URL identifier)
              </label>
              <input
                {...register('tenantSlug')}
                type="text"
                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="acme-corp"
              />
              {errors.tenantSlug && (
                <p className="mt-1 text-sm text-red-400">{errors.tenantSlug.message}</p>
              )}
              <p className="mt-1 text-sm text-gray-400">
                This will be used in URLs and must be unique
              </p>
            </div>
          </div>
        </div>

        {/* Admin User Information */}
        <div className="bg-slate-800 shadow rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Admin User Account</h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-300">
                First Name
              </label>
              <input
                {...register('firstName')}
                type="text"
                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John"
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-400">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-300">
                Last Name
              </label>
              <input
                {...register('lastName')}
                type="text"
                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Doe"
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-400">{errors.lastName.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email Address
              </label>
              <input
                {...register('email')}
                type="email"
                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="admin@acme.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                {...register('password')}
                type="password"
                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
              )}
              <p className="mt-1 text-sm text-gray-400">
                Must be at least 8 characters with uppercase, lowercase, and number/special char
              </p>
            </div>
          </div>
        </div>

        {/* Plan & Limits */}
        <div className="bg-slate-800 shadow rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Plan & Limits</h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="planType" className="block text-sm font-medium text-gray-300">
                Plan Type
              </label>
              <select
                {...register('planType')}
                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="trial">Trial</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
              {errors.planType && (
                <p className="mt-1 text-sm text-red-400">{errors.planType.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-300">
                Status
              </label>
              <select
                {...register('status')}
                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="TRIAL">Trial</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              {errors.status && (
                <p className="mt-1 text-sm text-red-400">{errors.status.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="maxUsers" className="block text-sm font-medium text-gray-300">
                Max Users
              </label>
              <input
                {...register('maxUsers', { valueAsNumber: true })}
                type="number"
                min="1"
                max="10000"
                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.maxUsers && (
                <p className="mt-1 text-sm text-red-400">{errors.maxUsers.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="maxIntegrations" className="block text-sm font-medium text-gray-300">
                Max Integrations
              </label>
              <input
                {...register('maxIntegrations', { valueAsNumber: true })}
                type="number"
                min="1"
                max="100"
                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.maxIntegrations && (
                <p className="mt-1 text-sm text-red-400">{errors.maxIntegrations.message}</p>
              )}
            </div>

            {planType === 'trial' && (
              <div className="sm:col-span-2">
                <label htmlFor="trialDays" className="block text-sm font-medium text-gray-300">
                  Trial Duration (days)
                </label>
                <input
                  {...register('trialDays', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  max="365"
                  className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.trialDays && (
                  <p className="mt-1 text-sm text-red-400">{errors.trialDays.message}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4">
          <Link
            href="/tenants"
            className="px-6 py-2 border border-slate-600 rounded-md text-sm font-medium text-gray-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating Tenant...' : 'Create Tenant'}
          </button>
        </div>
      </form>
    </div>
  );
}
