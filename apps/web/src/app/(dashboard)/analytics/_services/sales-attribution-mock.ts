import type {
  SalesAttributionOverviewParams,
  SalesAttributionOverviewResponse,
} from '../_types/sales-attribution';

type ProductSeed = {
  teamCode: string;
  mapping: string | null;
  purchasesPos: number;
  processedPurchasesPos: number;
  leads: number;
  confirmedCount: number;
  unconfirmedCount: number;
  printedCount: number;
  waitingPickupCount: number;
  shippedCount: number;
  deliveredCount: number;
  canceledCount: number;
  deletedCount: number;
  rtsCount: number;
  restockingCount: number;
  abandonedCount: number;
  codPos: number;
  deliveredCodPos: number;
  shippedCodPos: number;
  waitingPickupCodPos: number;
  rtsCodPos: number;
  canceledCodPos: number;
  restockingCodPos: number;
  confirmedCodPos: number;
  unconfirmedCodPos: number;
  abandonedCodPos: number;
  spend: number;
  cogsPos: number;
  cogsCanceledPos: number;
  cogsRestockingPos: number;
  cogsRtsPos: number;
  cogsDeliveredPos: number;
  sfPos: number;
  ffPos: number;
  ifPos: number;
  sfSdrPos: number;
  ffSdrPos: number;
  ifSdrPos: number;
  codFeePos: number;
  codFeeDeliveredPos: number;
};

type AggregateShape = {
  _sum: Record<string, number>;
};

const TEAM_LABELS: Record<string, string> = {
  '1001': 'Team 1001',
  '2002': 'Team 2002',
  '3003': 'Team 3003',
};

const BASE_PRODUCT_SEEDS: ProductSeed[] = [
  {
    teamCode: '1001',
    mapping: 'legal-kit',
    purchasesPos: 18,
    processedPurchasesPos: 14,
    leads: 41,
    confirmedCount: 7,
    unconfirmedCount: 2,
    printedCount: 1,
    waitingPickupCount: 3,
    shippedCount: 3,
    deliveredCount: 4,
    canceledCount: 1,
    deletedCount: 0,
    rtsCount: 1,
    restockingCount: 1,
    abandonedCount: 1,
    codPos: 42120,
    deliveredCodPos: 9920,
    shippedCodPos: 7380,
    waitingPickupCodPos: 6640,
    rtsCodPos: 2280,
    canceledCodPos: 1890,
    restockingCodPos: 2360,
    confirmedCodPos: 16840,
    unconfirmedCodPos: 4550,
    abandonedCodPos: 2260,
    spend: 9640,
    cogsPos: 14680,
    cogsCanceledPos: 690,
    cogsRestockingPos: 840,
    cogsRtsPos: 720,
    cogsDeliveredPos: 3540,
    sfPos: 1020,
    ffPos: 420,
    ifPos: 84,
    sfSdrPos: 480,
    ffSdrPos: 198,
    ifSdrPos: 40,
    codFeePos: 852,
    codFeeDeliveredPos: 222,
  },
  {
    teamCode: '1001',
    mapping: 'legal-booklet',
    purchasesPos: 12,
    processedPurchasesPos: 9,
    leads: 26,
    confirmedCount: 4,
    unconfirmedCount: 1,
    printedCount: 1,
    waitingPickupCount: 2,
    shippedCount: 2,
    deliveredCount: 3,
    canceledCount: 1,
    deletedCount: 0,
    rtsCount: 0,
    restockingCount: 1,
    abandonedCount: 0,
    codPos: 19680,
    deliveredCodPos: 4920,
    shippedCodPos: 3280,
    waitingPickupCodPos: 3320,
    rtsCodPos: 0,
    canceledCodPos: 1640,
    restockingCodPos: 1680,
    confirmedCodPos: 7380,
    unconfirmedCodPos: 1640,
    abandonedCodPos: 0,
    spend: 4360,
    cogsPos: 6780,
    cogsCanceledPos: 420,
    cogsRestockingPos: 510,
    cogsRtsPos: 0,
    cogsDeliveredPos: 1580,
    sfPos: 660,
    ffPos: 270,
    ifPos: 54,
    sfSdrPos: 300,
    ffSdrPos: 125,
    ifSdrPos: 25,
    codFeePos: 388,
    codFeeDeliveredPos: 110,
  },
  {
    teamCode: '2002',
    mapping: 'mold-remover',
    purchasesPos: 22,
    processedPurchasesPos: 18,
    leads: 53,
    confirmedCount: 8,
    unconfirmedCount: 2,
    printedCount: 1,
    waitingPickupCount: 3,
    shippedCount: 4,
    deliveredCount: 4,
    canceledCount: 1,
    deletedCount: 0,
    rtsCount: 1,
    restockingCount: 1,
    abandonedCount: 1,
    codPos: 53340,
    deliveredCodPos: 11320,
    shippedCodPos: 9480,
    waitingPickupCodPos: 7010,
    rtsCodPos: 2630,
    canceledCodPos: 2190,
    restockingCodPos: 2410,
    confirmedCodPos: 18880,
    unconfirmedCodPos: 5320,
    abandonedCodPos: 2100,
    spend: 11820,
    cogsPos: 17560,
    cogsCanceledPos: 760,
    cogsRestockingPos: 880,
    cogsRtsPos: 760,
    cogsDeliveredPos: 4020,
    sfPos: 1260,
    ffPos: 520,
    ifPos: 104,
    sfSdrPos: 540,
    ffSdrPos: 220,
    ifSdrPos: 44,
    codFeePos: 1078,
    codFeeDeliveredPos: 254,
  },
  {
    teamCode: '2002',
    mapping: 'callus-remover',
    purchasesPos: 15,
    processedPurchasesPos: 11,
    leads: 34,
    confirmedCount: 5,
    unconfirmedCount: 2,
    printedCount: 1,
    waitingPickupCount: 2,
    shippedCount: 2,
    deliveredCount: 2,
    canceledCount: 1,
    deletedCount: 0,
    rtsCount: 1,
    restockingCount: 1,
    abandonedCount: 1,
    codPos: 24840,
    deliveredCodPos: 6200,
    shippedCodPos: 3720,
    waitingPickupCodPos: 2480,
    rtsCodPos: 1550,
    canceledCodPos: 1240,
    restockingCodPos: 1860,
    confirmedCodPos: 8680,
    unconfirmedCodPos: 3100,
    abandonedCodPos: 1240,
    spend: 5720,
    cogsPos: 8240,
    cogsCanceledPos: 430,
    cogsRestockingPos: 520,
    cogsRtsPos: 470,
    cogsDeliveredPos: 1930,
    sfPos: 840,
    ffPos: 350,
    ifPos: 70,
    sfSdrPos: 300,
    ffSdrPos: 124,
    ifSdrPos: 25,
    codFeePos: 502,
    codFeeDeliveredPos: 139,
  },
  {
    teamCode: '3003',
    mapping: 'pet-shampoo',
    purchasesPos: 17,
    processedPurchasesPos: 13,
    leads: 39,
    confirmedCount: 6,
    unconfirmedCount: 2,
    printedCount: 1,
    waitingPickupCount: 2,
    shippedCount: 3,
    deliveredCount: 3,
    canceledCount: 1,
    deletedCount: 0,
    rtsCount: 1,
    restockingCount: 1,
    abandonedCount: 0,
    codPos: 33660,
    deliveredCodPos: 7440,
    shippedCodPos: 6360,
    waitingPickupCodPos: 4040,
    rtsCodPos: 2020,
    canceledCodPos: 1680,
    restockingCodPos: 1880,
    confirmedCodPos: 12060,
    unconfirmedCodPos: 4040,
    abandonedCodPos: 0,
    spend: 8160,
    cogsPos: 11840,
    cogsCanceledPos: 540,
    cogsRestockingPos: 660,
    cogsRtsPos: 590,
    cogsDeliveredPos: 2780,
    sfPos: 900,
    ffPos: 365,
    ifPos: 73,
    sfSdrPos: 420,
    ffSdrPos: 171,
    ifSdrPos: 34,
    codFeePos: 684,
    codFeeDeliveredPos: 166,
  },
  {
    teamCode: '3003',
    mapping: 'cooling-gel',
    purchasesPos: 9,
    processedPurchasesPos: 7,
    leads: 18,
    confirmedCount: 3,
    unconfirmedCount: 1,
    printedCount: 1,
    waitingPickupCount: 1,
    shippedCount: 1,
    deliveredCount: 2,
    canceledCount: 0,
    deletedCount: 0,
    rtsCount: 0,
    restockingCount: 1,
    abandonedCount: 0,
    codPos: 12360,
    deliveredCodPos: 4760,
    shippedCodPos: 1620,
    waitingPickupCodPos: 1180,
    rtsCodPos: 0,
    canceledCodPos: 0,
    restockingCodPos: 1220,
    confirmedCodPos: 4920,
    unconfirmedCodPos: 1180,
    abandonedCodPos: 0,
    spend: 3140,
    cogsPos: 4680,
    cogsCanceledPos: 0,
    cogsRestockingPos: 390,
    cogsRtsPos: 0,
    cogsDeliveredPos: 1420,
    sfPos: 480,
    ffPos: 195,
    ifPos: 39,
    sfSdrPos: 180,
    ffSdrPos: 75,
    ifSdrPos: 15,
    codFeePos: 246,
    codFeeDeliveredPos: 107,
  },
];

const SCALE_FIELDS = new Set<keyof ProductSeed>([
  'purchasesPos',
  'processedPurchasesPos',
  'leads',
  'confirmedCount',
  'unconfirmedCount',
  'printedCount',
  'waitingPickupCount',
  'shippedCount',
  'deliveredCount',
  'canceledCount',
  'deletedCount',
  'rtsCount',
  'restockingCount',
  'abandonedCount',
  'codPos',
  'deliveredCodPos',
  'shippedCodPos',
  'waitingPickupCodPos',
  'rtsCodPos',
  'canceledCodPos',
  'restockingCodPos',
  'confirmedCodPos',
  'unconfirmedCodPos',
  'abandonedCodPos',
  'spend',
  'cogsPos',
  'cogsCanceledPos',
  'cogsRestockingPos',
  'cogsRtsPos',
  'cogsDeliveredPos',
  'sfPos',
  'ffPos',
  'ifPos',
  'sfSdrPos',
  'ffSdrPos',
  'ifSdrPos',
  'codFeePos',
  'codFeeDeliveredPos',
]);

const COUNT_FIELDS = new Set<keyof ProductSeed>([
  'purchasesPos',
  'processedPurchasesPos',
  'leads',
  'confirmedCount',
  'unconfirmedCount',
  'printedCount',
  'waitingPickupCount',
  'shippedCount',
  'deliveredCount',
  'canceledCount',
  'deletedCount',
  'rtsCount',
  'restockingCount',
  'abandonedCount',
]);

const PREVIOUS_FACTOR = 0.84;

const buildScaledSeed = (seed: ProductSeed, factor: number): ProductSeed => {
  const next: ProductSeed = { ...seed };

  for (const field of SCALE_FIELDS) {
    const value = seed[field];
    if (typeof value !== 'number') continue;
    const scaled = value * factor;
    next[field] = COUNT_FIELDS.has(field) ? Math.max(0, Math.round(scaled)) as never : Number(scaled.toFixed(2)) as never;
  }

  return next;
};

const toNumber = (value: unknown) => {
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const computeCounts = (
  sum: AggregateShape,
  opts: Pick<
    SalesAttributionOverviewParams,
    'excludeCancel' | 'excludeRestocking' | 'excludeAbandoned' | 'excludeRts'
  >,
) => {
  const purchasesRaw = toNumber(sum._sum.purchasesPos);
  const cancelAdj = opts.excludeCancel ? toNumber(sum._sum.canceledCount) : 0;
  const restockAdj = opts.excludeRestocking ? toNumber(sum._sum.restockingCount) : 0;
  const abandonedAdj = opts.excludeAbandoned ? toNumber(sum._sum.abandonedCount) : 0;
  const rtsAdj = opts.excludeRts ? toNumber(sum._sum.rtsCount) : 0;
  const adjustment = Math.min(purchasesRaw, cancelAdj + restockAdj + abandonedAdj + rtsAdj);

  return {
    purchases: Math.max(0, purchasesRaw - adjustment),
    delivered: toNumber(sum._sum.deliveredCount),
    shipped: toNumber(sum._sum.shippedCount),
    waiting_pickup: toNumber(sum._sum.waitingPickupCount),
    rts: toNumber(sum._sum.rtsCount),
    restocking: toNumber(sum._sum.restockingCount),
    confirmed: toNumber(sum._sum.confirmedCount),
    unconfirmed: toNumber(sum._sum.unconfirmedCount),
    canceled: toNumber(sum._sum.canceledCount),
  };
};

const computeKpis = (
  sum: AggregateShape,
  opts: Pick<
    SalesAttributionOverviewParams,
    | 'excludeCancel'
    | 'excludeRestocking'
    | 'excludeAbandoned'
    | 'excludeRts'
    | 'includeTax12'
    | 'includeTax1'
  >,
) => {
  const spendBase = toNumber(sum._sum.spend);
  const spendMultiplier = 1 + (opts.includeTax12 ? 0.12 : 0) + (opts.includeTax1 ? 0.01 : 0);
  const spend = spendBase * spendMultiplier;
  const cod = toNumber(sum._sum.codPos);
  const canceledCod = toNumber(sum._sum.canceledCodPos);
  const restockingCod = toNumber(sum._sum.restockingCodPos);
  const abandonedCod = toNumber(sum._sum.abandonedCodPos);
  const rtsCod = toNumber(sum._sum.rtsCodPos);
  const revenue =
    cod
    - (opts.excludeCancel ? canceledCod : 0)
    - (opts.excludeRestocking ? restockingCod : 0)
    - (opts.excludeAbandoned ? abandonedCod : 0)
    - (opts.excludeRts ? rtsCod : 0);

  const cogs = toNumber(sum._sum.cogsPos);
  const cogsCanceled = toNumber(sum._sum.cogsCanceledPos);
  const cogsRestocking = toNumber(sum._sum.cogsRestockingPos);
  const cogsRts = toNumber(sum._sum.cogsRtsPos);
  const cogsDelivered = toNumber(sum._sum.cogsDeliveredPos);
  const sf = toNumber(sum._sum.sfPos);
  const ff = toNumber(sum._sum.ffPos);
  const iF = toNumber(sum._sum.ifPos);
  const sfSdr = toNumber(sum._sum.sfSdrPos);
  const ffSdr = toNumber(sum._sum.ffSdrPos);
  const ifSdr = toNumber(sum._sum.ifSdrPos);
  const codFee = toNumber(sum._sum.codFeePos);
  const codFeeDelivered = toNumber(sum._sum.codFeeDeliveredPos);
  const cogsAdjusted =
    cogs
    - (opts.excludeCancel ? cogsCanceled : 0)
    - (opts.excludeRestocking ? cogsRestocking : 0);

  const contributionMargin =
    revenue
    - cogsAdjusted
    - sf
    - ff
    - iF
    - spend
    - codFee
    + cogsRts;

  const delivered = toNumber(sum._sum.deliveredCodPos);
  const netMargin =
    delivered
    - sfSdr
    - ffSdr
    - ifSdr
    - codFeeDelivered
    - cogsDelivered
    - spend;

  const counts = computeCounts(sum, opts);
  const processedPurchases = toNumber(sum._sum.processedPurchasesPos);
  const arPct = revenue > 0 ? (spend / revenue) * 100 : 0;
  const aov = counts.purchases > 0 ? revenue / counts.purchases : 0;
  const cpp = counts.purchases > 0 ? spend / counts.purchases : 0;
  const processedCpp = processedPurchases > 0 ? spend / processedPurchases : 0;
  const leads = toNumber(sum._sum.leads);
  const conversionRate = leads > 0 ? (counts.purchases / leads) * 100 : 0;
  const profitEfficiency = spend > 0 ? (contributionMargin / spend) * 100 : 0;
  const rtsPctBase = counts.delivered + counts.rts;
  const rtsPct = rtsPctBase > 0 ? (counts.rts / rtsPctBase) * 100 : 0;
  const cancellationRatePct = counts.purchases + counts.canceled > 0
    ? (counts.canceled / (counts.purchases + counts.canceled)) * 100
    : 0;

  return {
    revenue,
    delivered,
    shipped: toNumber(sum._sum.shippedCodPos),
    waiting_pickup: toNumber(sum._sum.waitingPickupCodPos),
    rts: toNumber(sum._sum.rtsCodPos),
    ad_spend: spend,
    processed: toNumber(sum._sum.confirmedCodPos) + toNumber(sum._sum.deliveredCodPos) + toNumber(sum._sum.shippedCodPos),
    cancellation_rate_pct: cancellationRatePct,
    confirmed: toNumber(sum._sum.confirmedCodPos),
    unconfirmed: toNumber(sum._sum.unconfirmedCodPos),
    canceled: canceledCod,
    aov,
    contribution_margin: contributionMargin,
    net_margin: netMargin,
    ar_pct: arPct,
    cpp,
    processed_cpp: processedCpp,
    conversion_rate: conversionRate,
    profit_efficiency: profitEfficiency,
    cogs,
    cogs_canceled: cogsCanceled,
    cogs_restocking: cogsRestocking,
    cogs_rts: cogsRts,
    cogs_delivered: cogsDelivered,
    cod_fee: codFee,
    cod_fee_delivered: codFeeDelivered,
    sf_sdr_fees: sfSdr,
    ff_sdr_fees: ffSdr,
    if_sdr_fees: ifSdr,
    gross_cod: cod,
    canceled_cod: canceledCod,
    restocking_cod: restockingCod,
    rts_cod: rtsCod,
    abandoned_cod: abandonedCod,
    sf_fees: sf,
    ff_fees: ff,
    if_fees: iF,
    cm_rts_forecast: contributionMargin * 0.92,
    rts_pct: rtsPct,
  };
};

const computeProductRow = (
  seed: ProductSeed,
  opts: Pick<
    SalesAttributionOverviewParams,
    | 'excludeCancel'
    | 'excludeRestocking'
    | 'excludeAbandoned'
    | 'excludeRts'
    | 'includeTax12'
    | 'includeTax1'
  >,
) => {
  const spendMultiplier = 1 + (opts.includeTax12 ? 0.12 : 0) + (opts.includeTax1 ? 0.01 : 0);
  const spend = seed.spend * spendMultiplier;
  const revenue =
    seed.codPos
    - (opts.excludeCancel ? seed.canceledCodPos : 0)
    - (opts.excludeRestocking ? seed.restockingCodPos : 0)
    - (opts.excludeAbandoned ? seed.abandonedCodPos : 0)
    - (opts.excludeRts ? seed.rtsCodPos : 0);
  const purchaseAdjustments =
    (opts.excludeCancel ? seed.canceledCount : 0)
    + (opts.excludeRestocking ? seed.restockingCount : 0)
    + (opts.excludeAbandoned ? seed.abandonedCount : 0)
    + (opts.excludeRts ? seed.rtsCount : 0);
  const purchasesAdj = Math.max(0, seed.purchasesPos - purchaseAdjustments);
  const cogsAdjusted =
    seed.cogsPos
    - (opts.excludeCancel ? seed.cogsCanceledPos : 0)
    - (opts.excludeRestocking ? seed.cogsRestockingPos : 0);

  const contributionMargin =
    revenue
    - cogsAdjusted
    - seed.sfPos
    - seed.ffPos
    - seed.ifPos
    - spend
    - seed.codFeePos
    + seed.cogsRtsPos;
  const netMargin =
    seed.deliveredCodPos
    - seed.sfSdrPos
    - seed.ffSdrPos
    - seed.ifSdrPos
    - seed.codFeeDeliveredPos
    - seed.cogsDeliveredPos
    - spend;
  const rtsDenominator = seed.deliveredCount + seed.rtsCount;
  const rtsPct = rtsDenominator > 0 ? (seed.rtsCount / rtsDenominator) * 100 : 0;

  return {
    mapping: seed.mapping,
    revenue,
    gross_sales: purchasesAdj,
    cogs: cogsAdjusted,
    aov: purchasesAdj > 0 ? revenue / purchasesAdj : 0,
    cpp: purchasesAdj > 0 ? spend / purchasesAdj : 0,
    processed_cpp: seed.processedPurchasesPos > 0 ? spend / seed.processedPurchasesPos : 0,
    ad_spend: spend,
    ar_pct: revenue > 0 ? (spend / revenue) * 100 : 0,
    profit_efficiency: spend > 0 ? (contributionMargin / spend) * 100 : 0,
    contribution_margin: contributionMargin,
    net_margin: netMargin,
    rts_count: seed.rtsCount,
    delivered_count: seed.deliveredCount,
    cod_raw: seed.codPos,
    purchases_raw: seed.purchasesPos,
    sf_raw: seed.sfPos,
    ff_raw: seed.ffPos,
    if_raw: seed.ifPos,
    cod_fee_delivered_raw: seed.codFeeDeliveredPos,
    cogs_ec: seed.cogsPos - seed.cogsCanceledPos,
    cogs_rts: seed.cogsRtsPos,
    cogs_restocking: seed.cogsRestockingPos,
    canceled_cod: seed.canceledCodPos,
    restocking_cod: seed.restockingCodPos,
    rts_cod: seed.rtsCodPos,
    abandoned_cod: seed.abandonedCodPos,
    _derivedRtsPct: rtsPct,
  };
};

const toAggregate = (seeds: ProductSeed[]): AggregateShape => ({
  _sum: seeds.reduce<Record<string, number>>((acc, seed) => {
    Object.entries(seed).forEach(([key, value]) => {
      if (typeof value !== 'number') return;
      acc[key] = (acc[key] || 0) + value;
    });
    return acc;
  }, {}),
});

const normalize = (value: string | null | undefined) => (value || '').trim().toLowerCase();

const buildOverviewForSeeds = (
  seeds: ProductSeed[],
  previousSeeds: ProductSeed[],
  params: SalesAttributionOverviewParams,
  rangeDays: number,
): SalesAttributionOverviewResponse => {
  const currentAggregate = toAggregate(seeds);
  const previousAggregate = toAggregate(previousSeeds);
  const products = seeds
    .map((seed) => computeProductRow(seed, params))
    .map(({ _derivedRtsPct, ...row }) => row);
  const deliveryStatuses = seeds.map((seed) => ({
    mapping: seed.mapping,
    total_orders: seed.purchasesPos,
    new_orders: seed.unconfirmedCount,
    restocking: seed.restockingCount,
    confirmed: seed.confirmedCount,
    printed: seed.printedCount,
    waiting_pickup: seed.waitingPickupCount,
    shipped: seed.shippedCount,
    delivered: seed.deliveredCount,
    rts: seed.rtsCount,
    canceled: seed.canceledCount,
    deleted: seed.deletedCount,
  }));

  const visibleTeamCodes = Array.from(new Set(BASE_PRODUCT_SEEDS.map((seed) => seed.teamCode))).sort();
  const visibleMappings = Array.from(
    new Set(seeds.map((seed) => normalize(seed.mapping)).filter((value) => value.length > 0)),
  ).sort();
  const mappingsDisplayMap = seeds.reduce<Record<string, string>>((acc, seed) => {
    if (!seed.mapping) return acc;
    const key = normalize(seed.mapping);
    if (!acc[key]) {
      acc[key] = seed.mapping;
    }
    return acc;
  }, {});

  return {
    kpis: computeKpis(currentAggregate, params),
    prevKpis: computeKpis(previousAggregate, params),
    counts: computeCounts(currentAggregate, params),
    prevCounts: computeCounts(previousAggregate, params),
    products,
    deliveryStatuses,
    filters: {
      teamCodes: visibleTeamCodes,
      teamCodeDisplayMap: TEAM_LABELS,
      mappings: visibleMappings,
      mappingsDisplayMap,
    },
    selected: {
      start_date: params.startDate,
      end_date: params.endDate,
      teamCode: params.teamCode,
      mappings: params.mappings,
    },
    rangeDays,
    lastUpdatedAt: new Date().toISOString(),
  };
};

export function buildSalesAttributionOverview(
  params: SalesAttributionOverviewParams,
): SalesAttributionOverviewResponse {
  const start = new Date(`${params.startDate}T00:00:00.000Z`);
  const end = new Date(`${params.endDate}T00:00:00.000Z`);
  const rangeDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);

  const dailySeeds = BASE_PRODUCT_SEEDS
    .filter((seed) => !params.teamCode || seed.teamCode === params.teamCode)
    .map((seed) => buildScaledSeed(seed, rangeDays));

  const allowedMappingSet =
    params.mappings.length > 0 ? new Set(params.mappings.map((mapping) => normalize(mapping))) : null;

  const filteredSeeds = dailySeeds.filter((seed) => {
    if (!allowedMappingSet) return true;
    return allowedMappingSet.has(normalize(seed.mapping));
  });

  const previousSeeds = filteredSeeds.map((seed) => buildScaledSeed(seed, PREVIOUS_FACTOR));

  return buildOverviewForSeeds(filteredSeeds, previousSeeds, params, rangeDays);
}
