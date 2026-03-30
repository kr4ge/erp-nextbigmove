export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Manila';
export const GEO_COUNTRY_CODE = '63';

export const CONFIRMATION_STATUS_OPTIONS = [
  { label: 'Restocking', value: 11 },
  { label: 'Cancel', value: 6 },
  { label: 'Delete', value: 7 },
  { label: 'Confirm', value: 1 },
] as const;
