'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import apiClient from '@/lib/api-client';
import Link from 'next/link';

const updateTenantSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2, 'Tenant slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  planType: z.enum(['trial', 'starter', 'professional', 'enterprise']),
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']),
  maxUsers: z.number().min(1).max(10000),
  maxIntegrations: z.number().min(1).max(100),
});

type UpdateTenantForm = z.infer<typeof updateTenantSchema>;

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  planType: string;
  maxUsers: number;
  maxIntegrations: number;
  createdAt: string;
  updatedAt: string;
  trialEndsAt: string | null;
  _count?: {
    users: number;
    integrations: number;
  };
}

export default function TenantDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<UpdateTenantForm>({
    resolver: zodResolver(updateTenantSchema),
  });

  useEffect(() => {
    fetchTenant();
  }, [tenantId]);

  const fetchTenant = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await apiClient.get(`/tenants/${tenantId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const tenantData = response.data;
      setTenant(tenantData);

      // Populate form with tenant data
      setValue('name', tenantData.name);
      setValue('slug', tenantData.slug);
      setValue('planType', tenantData.planType);
      setValue('status', tenantData.status);
      setValue('maxUsers', tenantData.maxUsers);
      setValue('maxIntegrations', tenantData.maxIntegrations);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load tenant');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: UpdateTenantForm) => {
    setError('');
    setSuccessMessage('');
    setIsSaving(true);

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      await apiClient.patch(`/tenants/${tenantId}`, data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSuccessMessage('Tenant updated successfully');
      fetchTenant(); // Refresh tenant data
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update tenant');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuspend = async () => {
    if (!confirm('Are you sure you want to suspend this tenant?')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      await apiClient.patch(
        `/tenants/${tenantId}`,
        { status: 'SUSPENDED' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSuccessMessage('Tenant suspended successfully');
      fetchTenant();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to suspend tenant');
    }
  };

  const handleActivate = async () => {
    try {
      const token = localStorage.getItem('access_token');
      await apiClient.patch(
        `/tenants/${tenantId}`,
        { status: 'ACTIVE' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSuccessMessage('Tenant activated successfully');
      fetchTenant();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to activate tenant');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400 text-lg">Loading tenant...</div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-400 text-lg">Tenant not found</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Link href="/tenants" className="text-gray-400 hover:text-gray-300">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold text-white">{tenant.name}</h1>
        </div>
        <p className="text-gray-400">Manage tenant settings, users, and features</p>
      </div>

      {/* Error/Success Display */}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-6 bg-green-900/20 border border-green-500 text-green-400 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Tenant Information */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-slate-800 shadow rounded-lg border border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Tenant Information</h2>

              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                    Organization Name
                  </label>
                  <input
                    {...register('name')}
                    type="text"
                    className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>}
                </div>

                <div>
                  <label htmlFor="slug" className="block text-sm font-medium text-gray-300">
                    Tenant Slug
                  </label>
                  <input
                    {...register('slug')}
                    type="text"
                    className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.slug && <p className="mt-1 text-sm text-red-400">{errors.slug.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end space-x-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="bg-slate-800 shadow rounded-lg border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-400">Users</dt>
                <dd className="text-2xl font-semibold text-white">
                  {tenant._count?.users || 0} / {tenant.maxUsers}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-400">Integrations</dt>
                <dd className="text-2xl font-semibold text-white">
                  {tenant._count?.integrations || 0} / {tenant.maxIntegrations}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-400">Created</dt>
                <dd className="text-sm text-white">{formatDate(tenant.createdAt)}</dd>
              </div>
              {tenant.trialEndsAt && (
                <div>
                  <dt className="text-sm text-gray-400">Trial Ends</dt>
                  <dd className="text-sm text-white">{formatDate(tenant.trialEndsAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-800 shadow rounded-lg border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-3">
              {tenant.status !== 'ACTIVE' && (
                <button
                  onClick={handleActivate}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500 text-sm font-medium"
                >
                  Activate Tenant
                </button>
              )}
              {tenant.status === 'ACTIVE' && (
                <button
                  onClick={handleSuspend}
                  className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-500 text-sm font-medium"
                >
                  Suspend Tenant
                </button>
              )}
              <button className="w-full px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-600 text-sm font-medium">
                View Users
              </button>
              <button className="w-full px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-600 text-sm font-medium">
                View Integrations
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-900/20 shadow rounded-lg border border-red-500/50 p-6">
            <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
            <p className="text-sm text-gray-400 mb-4">
              Deleting a tenant will permanently remove all data associated with it.
            </p>
            <button className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 text-sm font-medium">
              Delete Tenant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
