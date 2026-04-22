import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f2e8] px-4">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          ERP Warehouse Operating System
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-slate-900">
          Stock-Truth Core
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-600">
          This workspace is now the WMS foundation surface. Use it to enter the warehouse shell, validate
          access, and begin the stock-truth rollout from receiving into inventory units and movement history.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/login"
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Open WMS Login
          </Link>
        </div>
      </div>
    </div>
  );
}
