/**
 * Manila calendar-day helpers. The API keys "today" to Asia/Manila, so a UTC
 * date string would silently exclude the current day every Manila morning
 * (00:00–07:59), blanking the "today" columns and the calendar's last day.
 */
export function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

export function manilaDaysAgo(days: number): string {
  const today = new Date(`${manilaToday()}T00:00:00.000Z`);
  today.setUTCDate(today.getUTCDate() - days);
  return today.toISOString().slice(0, 10);
}
