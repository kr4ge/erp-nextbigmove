import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-5xl font-bold text-white mb-4">
          Admin Dashboard
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Manage tenants, users, and platform settings
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Admin Login
          </Link>
        </div>
      </div>
    </div>
  );
}
