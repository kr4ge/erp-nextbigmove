export function formatStockCount(value: number) {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return Math.trunc(value).toLocaleString('en-US');
}

export function formatStockDate(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${month}/${day} ${hours}:${minutes}`;
}

export function joinStockMeta(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}
