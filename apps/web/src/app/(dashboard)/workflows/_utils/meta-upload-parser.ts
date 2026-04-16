import type { WorkflowManualMetaUploadRow } from '../_types/manual-meta-upload';

type ColumnKey =
  | 'accountId'
  | 'campaignId'
  | 'campaignName'
  | 'adsetId'
  | 'adsetName'
  | 'adId'
  | 'adName'
  | 'dateCreated'
  | 'amountSpent'
  | 'linkClicks'
  | 'clicks'
  | 'impressions'
  | 'websitePurchases'
  | 'reportingStarts'
  | 'reportingEnds';

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  accountId: ['accountid'],
  campaignId: ['campaignid'],
  campaignName: ['campaignname'],
  adsetId: ['adsetid'],
  adsetName: ['adsetname'],
  adId: ['adid'],
  adName: ['adname'],
  dateCreated: ['datecreated'],
  amountSpent: ['amountspent', 'amountspentphp'],
  linkClicks: ['linkclicks'],
  clicks: ['clicksall', 'clicks'],
  impressions: ['impressions'],
  websitePurchases: ['websitepurchases'],
  reportingStarts: ['reportingstarts'],
  reportingEnds: ['reportingends'],
};

const COLUMN_LABELS: Record<ColumnKey, string> = {
  accountId: 'Account ID',
  campaignId: 'Campaign ID',
  campaignName: 'Campaign name',
  adsetId: 'Ad set ID',
  adsetName: 'Ad set name',
  adId: 'Ad ID',
  adName: 'Ad name',
  dateCreated: 'Date created',
  amountSpent: 'Amount spent',
  linkClicks: 'Link clicks',
  clicks: 'Clicks (all)',
  impressions: 'Impressions',
  websitePurchases: 'Website purchases',
  reportingStarts: 'Reporting starts',
  reportingEnds: 'Reporting ends',
};

const REQUIRED_COLUMNS: ColumnKey[] = [
  'accountId',
  'campaignId',
  'campaignName',
  'adsetId',
  'adId',
  'adName',
  'amountSpent',
  'linkClicks',
  'clicks',
  'impressions',
  'websitePurchases',
  'reportingStarts',
  'reportingEnds',
];

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function toCellString(value: unknown): string {
  return String(value ?? '').trim();
}

function parseDecimal(value: unknown, label: string, rowNumber: number): number {
  const normalized = toCellString(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Row ${rowNumber}: ${label} must be a non-negative number`);
  }
  return parsed;
}

function parseWholeNumber(value: unknown, label: string, rowNumber: number): number {
  const raw = toCellString(value);
  if (raw === '') {
    return 0;
  }

  const normalized = raw.replace(/,/g, '').replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw new Error(`Row ${rowNumber}: ${label} must be a non-negative whole number`);
  }
  return parsed;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizeDate(value: unknown, label: string, rowNumber: number, required = true): string {
  const text = toCellString(value);
  if (!text) {
    if (required) {
      throw new Error(`Row ${rowNumber}: ${label} is required`);
    }
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${pad(Number(month))}-${pad(Number(day))}`;
  }

  const slashShortYearMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashShortYearMatch) {
    const [, month, day, shortYear] = slashShortYearMatch;
    const year = 2000 + Number(shortYear);
    return `${year}-${pad(Number(month))}-${pad(Number(day))}`;
  }

  const dashMatch = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, month, day, year] = dashMatch;
    return `${year}-${pad(Number(month))}-${pad(Number(day))}`;
  }

  const dashShortYearMatch = text.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (dashShortYearMatch) {
    const [, month, day, shortYear] = dashShortYearMatch;
    const year = 2000 + Number(shortYear);
    return `${year}-${pad(Number(month))}-${pad(Number(day))}`;
  }

  throw new Error(`Row ${rowNumber}: ${label} must be a valid date`);
}

function resolveColumnIndexes(headerRow: unknown[]): Record<ColumnKey, number> {
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const indexes = {} as Record<ColumnKey, number>;

  (Object.keys(HEADER_ALIASES) as ColumnKey[]).forEach((key) => {
    indexes[key] = normalizedHeaders.findIndex((header) =>
      HEADER_ALIASES[key].includes(header),
    );
  });

  const missing = REQUIRED_COLUMNS.filter((key) => indexes[key] < 0);
  if (missing.length > 0) {
    throw new Error(
      `Missing required header(s): ${missing.map((key) => COLUMN_LABELS[key]).join(', ')}`,
    );
  }

  return indexes;
}

function getCell(row: unknown[], index: number): unknown {
  if (index < 0) return '';
  return row[index] ?? '';
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every((cell) => toCellString(cell) === '');
}

function isSummaryRow(row: unknown[], indexes: Record<ColumnKey, number>): boolean {
  const accountId = toCellString(getCell(row, indexes.accountId)).toLowerCase();
  const campaignId = toCellString(getCell(row, indexes.campaignId));
  const adsetId = toCellString(getCell(row, indexes.adsetId));
  const adId = toCellString(getCell(row, indexes.adId));
  const adName = toCellString(getCell(row, indexes.adName));

  return (
    accountId === 'multiple' &&
    campaignId === '' &&
    adsetId === '' &&
    adId === '' &&
    adName === ''
  );
}

export async function parseManualMetaUploadFile(file: File): Promise<WorkflowManualMetaUploadRow[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('The selected file does not contain any sheets');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (rows.length < 2) {
    throw new Error('The selected file does not contain any data rows');
  }

  const indexes = resolveColumnIndexes(rows[0]);
  const parsedRows = rows
    .slice(1)
    .filter(
      (row) =>
        Array.isArray(row) &&
        !isEmptyRow(row) &&
        !isSummaryRow(row, indexes),
    )
    .map((row, index) => {
      const rowNumber = index + 2;
      const reportingStarts = normalizeDate(
        getCell(row, indexes.reportingStarts),
        'Reporting starts',
        rowNumber,
      );
      const reportingEnds = normalizeDate(
        getCell(row, indexes.reportingEnds),
        'Reporting ends',
        rowNumber,
      );

      return {
        accountId: toCellString(getCell(row, indexes.accountId)),
        campaignId: toCellString(getCell(row, indexes.campaignId)),
        campaignName: toCellString(getCell(row, indexes.campaignName)),
        adsetId: toCellString(getCell(row, indexes.adsetId)),
        adsetName: toCellString(getCell(row, indexes.adsetName)) || undefined,
        adId: toCellString(getCell(row, indexes.adId)),
        adName: toCellString(getCell(row, indexes.adName)),
        dateCreated: normalizeDate(
          getCell(row, indexes.dateCreated),
          'Date created',
          rowNumber,
          false,
        ) || undefined,
        amountSpent: parseDecimal(getCell(row, indexes.amountSpent), 'Amount spent', rowNumber),
        linkClicks: parseWholeNumber(getCell(row, indexes.linkClicks), 'Link clicks', rowNumber),
        clicks: parseWholeNumber(getCell(row, indexes.clicks), 'Clicks (all)', rowNumber),
        impressions: parseWholeNumber(
          getCell(row, indexes.impressions),
          'Impressions',
          rowNumber,
        ),
        websitePurchases: parseWholeNumber(
          getCell(row, indexes.websitePurchases),
          'Website purchases',
          rowNumber,
        ),
        reportingStarts,
        reportingEnds,
      };
    });

  if (parsedRows.length === 0) {
    throw new Error('The selected file does not contain any importable rows');
  }

  return parsedRows;
}
