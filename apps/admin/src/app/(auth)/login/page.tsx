'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import apiClient from '@/lib/api-client';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (typeof response?.data?.message === 'string') {
      return response.data.message;
    }
  }
  return fallback;
}

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
      } else {
        localStorage.removeItem('current_tenant_id');
      }
      localStorage.removeItem('admin_permissions');
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Redirect to admin dashboard
      router.push('/partners');
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Login failed. Please check your credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] px-4 py-10">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-10 text-white shadow-sm lg:block">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-lg font-semibold text-white">
            WC
          </div>
          <div className="mt-10 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">Warehouse Connex</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">Warehouse Connex</h1>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-300">
              Internal control center for partner onboarding, inventory operations, fulfillment,
              returns, and billing across the ERP platform.
            </p>
            <div className="grid gap-3 pt-4">
              {[
                'Partner and tenant onboarding',
                'Warehouse, stock, and COGS control',
                'Pick, pack, dispatch, and RTS workflows',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-md w-full space-y-8 rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm lg:ml-auto">
          <div>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
              Internal Access
            </p>
            <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight text-slate-950">
              Sign in to Warehouse Connex
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500">
              Use your platform operator account to access warehouse operations.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
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
                  className="mt-2 block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
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
                  className="mt-2 block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
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
                className="flex w-full justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign in to Warehouse Connex'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
