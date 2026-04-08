import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <div className="min-h-screen bg-[#f4f6f8] px-4 py-16">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-10 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">Warehouse Connex</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">Warehouse Connex</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            Internal control center for partner onboarding, warehouse operations, inventory,
            fulfillment, RTS, and operational billing across the ERP platform.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ['Partners', 'Operational onboarding and account controls'],
              ['Inventory', 'Stock, COGS, and movement traceability'],
              ['Fulfillment', 'Picker, packer, and dispatch execution'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-2 text-sm text-slate-300">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Internal Access</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Open Warehouse Connex</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Use the admin login to enter the app shell. This front end is now structured as the
              WMS surface that will host partners, operators, warehouses, inventory, fulfillment,
              and billing.
            </p>
            <div className="mt-8 flex gap-4">
          <Link
            href="/login"
                className="inline-flex items-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
          >
                Go to Login
          </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
