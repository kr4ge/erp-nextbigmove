export function formatMetaDetailDate(dateString: string | null) {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getMetaAccountStatusText(status: number | null) {
  if (status === null) return 'Unknown';
  switch (status) {
    case 1:
      return 'Active';
    case 2:
      return 'Disabled';
    case 3:
      return 'Unsettled';
    case 7:
      return 'Pending Review';
    case 9:
      return 'In Grace Period';
    case 100:
      return 'Pending Closure';
    case 101:
      return 'Closed';
    default:
      return `Status ${status}`;
  }
}

export function getMetaAccountStatusColor(status: number | null) {
  if (status === 1) return 'text-emerald-600 bg-emerald-50';
  if (status === 2 || status === 101) return 'text-rose-600 bg-rose-50';
  return 'text-slate-600 bg-slate-50';
}

export function getMetaIntegrationStatusBadgeClasses(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-600 ring-emerald-200';
    case 'ERROR':
      return 'bg-rose-50 text-rose-600 ring-rose-200';
    case 'PENDING':
      return 'bg-amber-50 text-amber-600 ring-amber-200';
    case 'DISABLED':
      return 'bg-slate-50 text-slate-600 ring-slate-200';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-200';
  }
}
