import type { WmsProductProfileStatus } from '../_types/product';

export function formatProductProfileStatus(status: WmsProductProfileStatus) {
  if (status === 'READY') {
    return 'Ready';
  }

  if (status === 'ARCHIVED') {
    return 'Archived';
  }

  return 'Default';
}

export function getProductProfileStatusClasses(status: WmsProductProfileStatus) {
  if (status === 'READY') {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  }

  if (status === 'ARCHIVED') {
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  }

  return 'bg-orange-50 text-orange-700 border border-orange-200';
}
