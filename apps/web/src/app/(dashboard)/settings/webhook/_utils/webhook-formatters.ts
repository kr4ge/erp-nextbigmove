type ApiLikeError = {
  response?: {
    data?: {
      message?: string | string[];
    } | string;
  };
  message?: string;
};

export const parseWebhookErrorMessage = (error: unknown): string => {
  const apiError = error as ApiLikeError;
  const data = apiError?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;

  const dataMessage =
    data && typeof data === 'object' && 'message' in data
      ? (data as { message?: string | string[] }).message
      : undefined;

  if (typeof dataMessage === 'string' && dataMessage.trim()) return dataMessage;
  if (Array.isArray(dataMessage) && dataMessage.length > 0) return dataMessage.join(', ');

  return apiError?.message || 'Request failed. Please try again.';
};

export const formatWebhookDateTime = (value?: string | null) => {
  if (!value) return '--';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '--';
  return dt.toLocaleString();
};

export const maskApiKey = (key: string) => '•'.repeat(Math.max(12, key.length));

export const toStatusBadgeClass = (status: string | null | undefined) => {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'PROCESSED' || normalized === 'ACCEPTED' || normalized === 'SUCCESS') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (normalized === 'QUEUED' || normalized === 'PROCESSING' || normalized === 'RECEIVED' || normalized === 'PARTIAL') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
  if (normalized === 'SKIPPED') {
    return 'bg-slate-50 text-slate-600 ring-slate-200';
  }
  if (!normalized) {
    return 'bg-slate-50 text-slate-600 ring-slate-200';
  }
  return 'bg-rose-50 text-rose-700 ring-rose-200';
};

export const formatDuration = (value?: number | null) => {
  if (value === null || value === undefined) return '--';
  if (!Number.isFinite(value)) return '--';
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
};
