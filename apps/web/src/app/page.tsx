import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          ERP Analytics Platform
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Multi-tenant Business Intelligence & Analytics
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="btn btn-lg btn-primary"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="btn btn-lg btn-ghost"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
