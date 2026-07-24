import { Prisma } from '@prisma/client';

const MANILA_TIME_ZONE = 'Asia/Manila';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getManilaDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));

  return `${partMap.get('year')}-${partMap.get('month')}-${partMap.get('day')}`;
}

export function getManilaTodayDate(value = new Date()) {
  return parseExpirationDate(getManilaDateKey(value));
}

export function parseExpirationDate(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new Error('Expiration date must use YYYY-MM-DD format');
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Expiration date is invalid');
  }

  return date;
}

export function isExpiredInventoryDate(
  expirationDate: Date | string | null | undefined,
  now = new Date(),
) {
  if (!expirationDate) {
    return false;
  }

  const dateKey = expirationDate instanceof Date
    ? expirationDate.toISOString().slice(0, 10)
    : expirationDate.slice(0, 10);

  return dateKey < getManilaDateKey(now);
}

export function buildUnexpiredInventoryWhere(
  now = new Date(),
): Prisma.WmsInventoryUnitWhereInput {
  return {
    AND: [
      {
        OR: [
          { expirationDate: null },
          { expirationDate: { gte: getManilaTodayDate(now) } },
        ],
      },
      {
        OR: [
          {
            productProfile: {
              is: {
                requiresExpirationDate: false,
              },
            },
          },
          {
            expirationDate: {
              not: null,
            },
          },
        ],
      },
    ],
  };
}
