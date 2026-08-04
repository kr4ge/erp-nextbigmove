export function formatSmsCount(value: number) {
  return new Intl.NumberFormat('en-PH').format(value);
}

export function formatSmsDateTime(value: string | null) {
  if (!value) return 'Not yet';

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}

export function formatEnrollmentExpiry(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}
