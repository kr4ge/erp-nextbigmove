export const ANALYTICS_TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Manila';

export const formatDateInTimezone = (date: Date, timeZone: string = ANALYTICS_TIMEZONE) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

export const parseYmdToLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

export const normalizeDatepickerValue = (value: unknown, fallbackYmd: string) => {
  if (!value) return fallbackYmd;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return formatDateInTimezone(value);
  return fallbackYmd;
};
