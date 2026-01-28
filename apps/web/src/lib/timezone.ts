/**
 * Timezone utilities for Asia/Manila (Philippine Time)
 */

export const TIMEZONE = 'Asia/Manila';

/**
 * Get current date/time in Manila timezone
 */
export function getNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Get today's date at midnight in Manila timezone
 */
export function getToday(): Date {
  const now = getNow();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Convert a date to Manila timezone
 */
export function toManilaTime(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Format date in Manila timezone
 */
export function formatManilaDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString('en-US', {
    timeZone: TIMEZONE,
    ...options
  });
}

/**
 * Check if a date is in the future (Manila time)
 */
export function isFuture(date: Date): boolean {
  const now = getNow();
  return date > now;
}

/**
 * Check if a date is today (Manila time)
 */
export function isToday(date: Date): boolean {
  const today = getToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return date >= today && date < tomorrow;
}
