import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), '../../.env'));

const prisma = new PrismaClient();

const UNASSIGNED_MAPPING_KEY = '__unassigned_mapping__';
const UNASSIGNED_TEAM_CODE_KEY = '__unassigned_team_code__';
const UNASSIGNED_CAMPAIGN_KEY = '__unassigned_campaign__';
const MONEY_TOLERANCE = 0.01;

const NUMERIC_FIELDS = [
  'spend',
  'clicks',
  'linkClicks',
  'impressions',
  'leads',
  'purchasesPos',
  'processedPurchasesPos',
  'confirmedCount',
  'unconfirmedCount',
  'printedCount',
  'deletedCount',
  'abandonedCount',
  'waitingPickupCount',
  'shippedCount',
  'deliveredCount',
  'canceledCount',
  'rtsCount',
  'restockingCount',
  'codPos',
  'deliveredCodPos',
  'shippedCodPos',
  'waitingPickupCodPos',
  'rtsCodPos',
  'canceledCodPos',
  'restockingCodPos',
  'cogsRtsPos',
  'cogsDeliveredPos',
  'confirmedCodPos',
  'unconfirmedCodPos',
  'abandonedCodPos',
  'cogsPos',
  'cogsCanceledPos',
  'cogsRestockingPos',
  'sfPos',
  'ffPos',
  'ifPos',
  'sfSdrPos',
  'ffSdrPos',
  'ifSdrPos',
  'codFeePos',
  'codFeeDeliveredPos',
] as const;

type NumericField = (typeof NUMERIC_FIELDS)[number];
type Totals = Record<NumericField, number>;

type GroupEntry = {
  date: string;
  campaignId: string | null;
  campaignName: string | null;
  campaignKey: string;
  mapping: string | null;
  mappingKey: string;
  teamCode: string | null;
  teamCodeKey: string;
  isUnmatched: boolean;
  totals: Totals;
};

function normalize(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function toNumber(value: unknown): number {
  const numeric = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildCampaignKey(params: { campaignId?: string | null; adId?: string | null }) {
  const normalizedCampaignId = normalize(params.campaignId);
  if (normalizedCampaignId) {
    return normalizedCampaignId;
  }

  const normalizedAdId = normalize(params.adId);
  if (normalizedAdId) {
    return `ad:${normalizedAdId}`;
  }

  return UNASSIGNED_CAMPAIGN_KEY;
}

function createEmptyTotals(): Totals {
  return Object.fromEntries(NUMERIC_FIELDS.map((field) => [field, 0])) as Totals;
}

function usage() {
  console.log([
    'Usage:',
    '  npm run analytics:validate:sales-attribution -- --tenant-id=<uuid> --start-date=YYYY-MM-DD [--end-date=YYYY-MM-DD] [--sample-limit=10]',
    '',
    'Example:',
    '  npm run analytics:validate:sales-attribution -- --tenant-id=... --start-date=2026-06-01 --end-date=2026-06-07',
  ].join('\n'));
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const rawArg of argv) {
    if (!rawArg.startsWith('--')) {
      continue;
    }
    const cleaned = rawArg.slice(2);
    const separatorIndex = cleaned.indexOf('=');
    if (separatorIndex === -1) {
      args[cleaned] = 'true';
    } else {
      args[cleaned.slice(0, separatorIndex)] = cleaned.slice(separatorIndex + 1);
    }
  }

  if (args.help === 'true' || args.h === 'true') {
    usage();
    process.exit(0);
  }

  const tenantId = args['tenant-id'] || args.tenantId;
  const startDate = args['start-date'] || args.startDate;
  const endDate = args['end-date'] || args.endDate || startDate;
  const sampleLimit = Number(args['sample-limit'] || args.sampleLimit || '10');

  if (!tenantId || !startDate) {
    usage();
    throw new Error('tenant-id and start-date are required');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error('start-date and end-date must be in YYYY-MM-DD format');
  }

  if (endDate < startDate) {
    throw new Error('end-date must be after or equal to start-date');
  }

  return {
    tenantId,
    startDate,
    endDate,
    sampleLimit: Number.isFinite(sampleLimit) && sampleLimit > 0 ? Math.floor(sampleLimit) : 10,
  };
}

function dateKeyFromDate(value: Date | string) {
  const iso = typeof value === 'string' ? value : value.toISOString();
  return iso.slice(0, 10);
}

function buildGroupKey(params: {
  date: string;
  campaignKey: string;
  mappingKey: string;
  teamCodeKey: string;
}) {
  return `${params.date}::${params.campaignKey}::${params.mappingKey}::${params.teamCodeKey}`;
}

function addTotals(target: Totals, source: Partial<Record<NumericField, unknown>>) {
  for (const field of NUMERIC_FIELDS) {
    target[field] += toNumber(source[field]);
  }
}

function compareTotals(left: Totals, right: Totals) {
  const mismatches: Array<{ field: NumericField; left: number; right: number; delta: number }> = [];
  for (const field of NUMERIC_FIELDS) {
    const leftValue = left[field];
    const rightValue = right[field];
    const delta = leftValue - rightValue;
    if (Math.abs(delta) > MONEY_TOLERANCE) {
      mismatches.push({ field, left: leftValue, right: rightValue, delta });
    }
  }
  return mismatches;
}

async function main() {
  const { tenantId, startDate, endDate, sampleLimit } = parseArgs(process.argv.slice(2));
  const rangeStart = new Date(`${startDate}T00:00:00.000Z`);
  const rangeEndExclusive = new Date(`${endDate}T00:00:00.000Z`);
  rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);

  const sourceRows = await prisma.reconcileMarketing.findMany({
    where: {
      tenantId,
      date: {
        gte: rangeStart,
        lt: rangeEndExclusive,
      },
    },
    select: {
      date: true,
      campaignId: true,
      campaignName: true,
      adId: true,
      adName: true,
      mapping: true,
      teamCode: true,
      spend: true,
      clicks: true,
      linkClicks: true,
      impressions: true,
      leads: true,
      purchasesPos: true,
      processedPurchasesPos: true,
      confirmedCount: true,
      unconfirmedCount: true,
      printedCount: true,
      deletedCount: true,
      abandonedCount: true,
      waitingPickupCount: true,
      shippedCount: true,
      deliveredCount: true,
      canceledCount: true,
      rtsCount: true,
      restockingCount: true,
      codPos: true,
      deliveredCodPos: true,
      shippedCodPos: true,
      waitingPickupCodPos: true,
      rtsCodPos: true,
      canceledCodPos: true,
      restockingCodPos: true,
      cogsRtsPos: true,
      cogsDeliveredPos: true,
      confirmedCodPos: true,
      unconfirmedCodPos: true,
      abandonedCodPos: true,
      cogsPos: true,
      cogsCanceledPos: true,
      cogsRestockingPos: true,
      sfPos: true,
      ffPos: true,
      ifPos: true,
      sfSdrPos: true,
      ffSdrPos: true,
      ifSdrPos: true,
      codFeePos: true,
      codFeeDeliveredPos: true,
    },
  });

  const rollupRows = await prisma.reconcileSalesAttribution.findMany({
    where: {
      tenantId,
      date: {
        gte: rangeStart,
        lt: rangeEndExclusive,
      },
    },
    select: {
      date: true,
      campaignId: true,
      campaignName: true,
      campaignKey: true,
      mapping: true,
      mappingKey: true,
      teamCode: true,
      teamCodeKey: true,
      isUnmatched: true,
      spend: true,
      clicks: true,
      linkClicks: true,
      impressions: true,
      leads: true,
      purchasesPos: true,
      processedPurchasesPos: true,
      confirmedCount: true,
      unconfirmedCount: true,
      printedCount: true,
      deletedCount: true,
      abandonedCount: true,
      waitingPickupCount: true,
      shippedCount: true,
      deliveredCount: true,
      canceledCount: true,
      rtsCount: true,
      restockingCount: true,
      codPos: true,
      deliveredCodPos: true,
      shippedCodPos: true,
      waitingPickupCodPos: true,
      rtsCodPos: true,
      canceledCodPos: true,
      restockingCodPos: true,
      cogsRtsPos: true,
      cogsDeliveredPos: true,
      confirmedCodPos: true,
      unconfirmedCodPos: true,
      abandonedCodPos: true,
      cogsPos: true,
      cogsCanceledPos: true,
      cogsRestockingPos: true,
      sfPos: true,
      ffPos: true,
      ifPos: true,
      sfSdrPos: true,
      ffSdrPos: true,
      ifSdrPos: true,
      codFeePos: true,
      codFeeDeliveredPos: true,
    },
  });

  const sourceMap = new Map<string, GroupEntry>();
  const sourceOverall = createEmptyTotals();

  for (const row of sourceRows) {
    const date = dateKeyFromDate(row.date);
    const campaignId = row.campaignId?.trim() || null;
    const campaignKey = buildCampaignKey({
      campaignId: row.campaignId,
      adId: row.adId,
    });
    const mapping = row.mapping?.trim() || null;
    const mappingKey = normalize(row.mapping) || UNASSIGNED_MAPPING_KEY;
    const teamCode = row.teamCode?.trim() || null;
    const teamCodeKey = normalize(row.teamCode) || UNASSIGNED_TEAM_CODE_KEY;
    const key = buildGroupKey({ date, campaignKey, mappingKey, teamCodeKey });

    if (!sourceMap.has(key)) {
      sourceMap.set(key, {
        date,
        campaignId,
        campaignName: row.campaignName || row.adName || campaignId || row.adId || null,
        campaignKey,
        mapping,
        mappingKey,
        teamCode,
        teamCodeKey,
        isUnmatched: !campaignId,
        totals: createEmptyTotals(),
      });
    }

    const group = sourceMap.get(key)!;
    addTotals(group.totals, row);
    addTotals(sourceOverall, row);
  }

  const rollupMap = new Map<string, GroupEntry>();
  const rollupOverall = createEmptyTotals();

  for (const row of rollupRows) {
    const date = dateKeyFromDate(row.date);
    const key = buildGroupKey({
      date,
      campaignKey: row.campaignKey,
      mappingKey: row.mappingKey,
      teamCodeKey: row.teamCodeKey,
    });
    rollupMap.set(key, {
      date,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      campaignKey: row.campaignKey,
      mapping: row.mapping,
      mappingKey: row.mappingKey,
      teamCode: row.teamCode,
      teamCodeKey: row.teamCodeKey,
      isUnmatched: row.isUnmatched,
      totals: Object.fromEntries(
        NUMERIC_FIELDS.map((field) => [field, toNumber(row[field])]),
      ) as Totals,
    });
    addTotals(rollupOverall, row as Partial<Record<NumericField, unknown>>);
  }

  const missingKeys = [...sourceMap.keys()].filter((key) => !rollupMap.has(key));
  const unexpectedKeys = [...rollupMap.keys()].filter((key) => !sourceMap.has(key));
  const mismatchedGroups: Array<{
    key: string;
    summary: Pick<GroupEntry, 'date' | 'campaignName' | 'mapping' | 'teamCode'>;
    fields: Array<{ field: NumericField; source: number; rollup: number; delta: number }>;
  }> = [];

  for (const [key, sourceGroup] of sourceMap.entries()) {
    const rollupGroup = rollupMap.get(key);
    if (!rollupGroup) {
      continue;
    }

    const fieldDiffs = compareTotals(sourceGroup.totals, rollupGroup.totals).map((diff) => ({
      field: diff.field,
      source: diff.left,
      rollup: diff.right,
      delta: diff.delta,
    }));

    if (fieldDiffs.length > 0 || sourceGroup.isUnmatched !== rollupGroup.isUnmatched) {
      mismatchedGroups.push({
        key,
        summary: {
          date: sourceGroup.date,
          campaignName: sourceGroup.campaignName,
          mapping: sourceGroup.mapping,
          teamCode: sourceGroup.teamCode,
        },
        fields: fieldDiffs,
      });
    }
  }

  const overallDiffs = compareTotals(sourceOverall, rollupOverall);

  const salesAgg = await prisma.reconcileSales.aggregate({
    where: {
      tenantId,
      date: {
        gte: rangeStart,
        lt: rangeEndExclusive,
      },
    },
    _sum: Object.fromEntries(NUMERIC_FIELDS.map((field) => [field, true])) as Record<NumericField, true>,
  });

  const salesOverall = createEmptyTotals();
  for (const field of NUMERIC_FIELDS) {
    salesOverall[field] = toNumber(salesAgg._sum[field]);
  }
  const salesVsAttributionDiffs = compareTotals(salesOverall, rollupOverall);

  console.log(`Sales attribution validation for tenant ${tenantId}`);
  console.log(`Range: ${startDate} -> ${endDate}`);
  console.log(`Source groups: ${sourceMap.size}`);
  console.log(`Rollup groups: ${rollupMap.size}`);
  console.log(`Missing rollup groups: ${missingKeys.length}`);
  console.log(`Unexpected rollup groups: ${unexpectedKeys.length}`);
  console.log(`Group mismatches: ${mismatchedGroups.length}`);
  console.log(`Overall source vs rollup diffs: ${overallDiffs.length}`);
  console.log(`Overall reconcile_sales vs attribution diffs: ${salesVsAttributionDiffs.length}`);

  if (missingKeys.length > 0) {
    console.log('\nMissing groups sample:');
    for (const key of missingKeys.slice(0, sampleLimit)) {
      const group = sourceMap.get(key)!;
      console.log(`- ${key} | campaign=${group.campaignName || 'null'} | mapping=${group.mapping || 'null'} | team=${group.teamCode || 'null'}`);
    }
  }

  if (unexpectedKeys.length > 0) {
    console.log('\nUnexpected groups sample:');
    for (const key of unexpectedKeys.slice(0, sampleLimit)) {
      const group = rollupMap.get(key)!;
      console.log(`- ${key} | campaign=${group.campaignName || 'null'} | mapping=${group.mapping || 'null'} | team=${group.teamCode || 'null'}`);
    }
  }

  if (mismatchedGroups.length > 0) {
    console.log('\nMismatched groups sample:');
    for (const mismatch of mismatchedGroups.slice(0, sampleLimit)) {
      console.log(`- ${mismatch.key} | campaign=${mismatch.summary.campaignName || 'null'} | mapping=${mismatch.summary.mapping || 'null'} | team=${mismatch.summary.teamCode || 'null'}`);
      for (const field of mismatch.fields.slice(0, 5)) {
        console.log(`    ${field.field}: source=${field.source} rollup=${field.rollup} delta=${field.delta}`);
      }
    }
  }

  if (overallDiffs.length > 0) {
    console.log('\nOverall source vs rollup diffs:');
    for (const diff of overallDiffs) {
      console.log(`- ${diff.field}: source=${diff.left} rollup=${diff.right} delta=${diff.delta}`);
    }
  }

  if (salesVsAttributionDiffs.length > 0) {
    console.log('\nOverall reconcile_sales vs attribution diffs:');
    for (const diff of salesVsAttributionDiffs) {
      console.log(`- ${diff.field}: reconcile_sales=${diff.left} attribution=${diff.right} delta=${diff.delta}`);
    }
  }

  const hasFailure =
    missingKeys.length > 0
    || unexpectedKeys.length > 0
    || mismatchedGroups.length > 0
    || overallDiffs.length > 0
    || salesVsAttributionDiffs.length > 0;

  if (hasFailure) {
    process.exitCode = 1;
    return;
  }

  console.log('\nValidation passed: attribution rollup matches source and overall sales totals.');
}

main()
  .catch((error) => {
    console.error('Failed to validate sales attribution rollup:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
