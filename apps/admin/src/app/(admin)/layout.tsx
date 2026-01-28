'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated and has admin role
    const token = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('user');

    if (!token) {
      router.push('/login');
      return;
    }

    if (userStr) {
      const userData = JSON.parse(userStr);

      // Verify user has SUPER_ADMIN privileges (platform administrators only)
      if (userData.role !== 'SUPER_ADMIN') {
        router.push('/login');
        return;
      }

      setUser(userData);
    }

    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_tenant_id');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Top Navigation */}
      <nav className="bg-slate-800 border-b border-slate-700">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <Link
                    href="/tenants"
                    className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-slate-700 hover:text-white"
                  >
                    Tenants
                  </Link>
                  <Link
                    href="/users"
                    className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-slate-700 hover:text-white"
                  >
                    Users
                  </Link>
                  <Link
                    href="/settings"
                    className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-slate-700 hover:text-white"
                  >
                    Settings
                  </Link>
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-300">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="inline-flex items-center rounded-md bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
                  {user?.role}
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
