'use client';

interface MetaIntegrationDetailsCardProps {
  status: string;
  userId?: string;
  userName?: string;
  createdAt: string;
  updatedAt: string;
  formatDate: (value: string | null) => string;
  getStatusBadgeClasses: (status: string) => string;
}

export function MetaIntegrationDetailsCard({
  status,
  userId,
  userName,
  createdAt,
  updatedAt,
  formatDate,
  getStatusBadgeClasses,
}: MetaIntegrationDetailsCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Integration Details</h2>
        <span
          className={`inline-flex items-center self-start rounded-md px-3 py-1 text-xs font-medium ring-1 ring-inset ${getStatusBadgeClasses(
            status,
          )}`}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {userId ? (
          <div>
            <p className="text-sm text-slate-500">User ID</p>
            <p className="mt-1 break-all font-mono text-sm text-slate-900">{userId}</p>
          </div>
        ) : null}
        {userName ? (
          <div>
            <p className="text-sm text-slate-500">User Name</p>
            <p className="mt-1 text-sm text-slate-900">{userName}</p>
          </div>
        ) : null}
        <div>
          <p className="text-sm text-slate-500">Created</p>
          <p className="mt-1 text-sm text-slate-900">{formatDate(createdAt)}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Last Updated</p>
          <p className="mt-1 text-sm text-slate-900">{formatDate(updatedAt)}</p>
        </div>
      </div>
    </div>
  );
}
