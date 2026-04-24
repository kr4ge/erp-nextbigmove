'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import apiClient from '@/lib/api-client';
import {
  clearAdminSession,
  fetchEffectivePermissions,
  storePermissions,
} from '@/lib/admin-session';
import { hasWmsAccess } from '@/lib/wms-access';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (
      typeof error === 'object'
      && error !== null
      && 'response' in error
      && typeof (error as { response?: unknown }).response === 'object'
      && (error as { response?: { data?: unknown } }).response?.data
      && typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
    ) {
      return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
    }

    return fallback;
  };

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setIsLoading(true);

    try {
      const response = await apiClient.post('/auth/login', data);

      // Store tokens and user info
      localStorage.setItem('access_token', response.data.accessToken);
      localStorage.setItem('refresh_token', response.data.refreshToken);
      if (response.data.tenant) {
        localStorage.setItem('current_tenant_id', response.data.tenant.id);
      }
      localStorage.setItem('user', JSON.stringify(response.data.user));

      let permissions: string[] = [];
      if (response.data.user.role !== 'SUPER_ADMIN') {
        permissions = await fetchEffectivePermissions();
        if (!hasWmsAccess(response.data.user.role, permissions)) {
          clearAdminSession();
          setError('Access denied. WMS permissions are required for this workspace.');
          return;
        }
      }

      storePermissions(permissions);

      // Redirect to WMS workspace
      router.push('/wms');
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Login failed. Please check your credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-2xl">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            WMS Workspace
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in with WMS access, or use a platform super-admin session.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-slate-900 focus:border-slate-900"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                {...register('password')}
                type="password"
                autoComplete="current-password"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-slate-900 focus:border-slate-900"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in to WMS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
