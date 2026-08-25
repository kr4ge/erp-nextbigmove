import type { ReactNode } from 'react';
import {
  formatCount,
  formatCurrency,
  formatDecimal,
  formatPercent,
} from '../../../overview/_utils/creative-overview-format';
import { DriveThumbnail } from '../../../video-registry/_components/drive-thumbnail';
import type { PerformanceRow, PerformanceSortKey, ScopeInfo } from '../_types/advertising-performance';

export type PerfColumnGroup = 'Identity' | 'Today' | 'Engagement' | 'Orders' | 'Money';

export type PerfCellContext = {
  scope: ScopeInfo | null;
};

/**
 * One registry drives the header, the cells, the sort whitelist, and the
 * column picker. Array order is the table's column order; `group` only decides
 * where a column sits in the picker.
 */
export type PerfColumn = {
  key: string;
  label: string;
  group: PerfColumnGroup;
  numeric?: boolean;
  defaultOn: boolean;
  /** Locked columns cannot be hidden from the picker. */
  locked?: boolean;
  /** Frozen columns stick to the left edge; explicit widths keep offsets stable. */
  frozen?: boolean;
  width: number;
  help?: string;
  sortKey?: PerformanceSortKey;
  mono?: boolean;
  render: (row: PerformanceRow, ctx: PerfCellContext) => ReactNode;
};

const dash = <span className="text-muted">—</span>;

function PerfThumbnail({ row }: { row: PerformanceRow }) {
  return <DriveThumbnail mediaUrl={row.creative?.mediaUrl ?? null} title={row.creative?.title ?? row.adName ?? 'Ad'} compact />;
}

const seconds = (value: number | null) => {
  if (value == null) return '—';
  const whole = Math.floor(value);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

function CppCell({ value, scope }: { value: number | null; scope: ScopeInfo | null }) {
  if (value == null) return dash;
  const breakeven = scope?.ceiling.breakevenCpp ?? null;
  // Coloured by headroom against the break-even, not by the raw number.
  const headroom = breakeven && breakeven > 0 ? 1 - value / breakeven : null;
  const tone = headroom == null ? '' : headroom > 0.5 ? 'text-success' : headroom > 0 ? 'text-warning' : 'text-destructive';
  return <span className={tone}>{formatCurrency(value)}</span>;
}

function NetCell({ value }: { value: number }) {
  return (
    <span className={value < 0 ? 'font-semibold text-destructive' : 'font-semibold text-success'}>
      {value < 0 ? '−' : '+'}{formatCurrency(Math.abs(value))}
    </span>
  );
}

function CancelCell({ value }: { value: number | null }) {
  if (value == null) return dash;
  return (
    <span className={value > 0.35 ? 'text-destructive' : ''}>
      {formatPercent(value)}{value > 0.35 ? ' !' : ''}
    </span>
  );
}

export function verdictLabel(row: PerformanceRow): { label: string; tone: 'success' | 'warning' | 'destructive' | 'neutral' } {
  const verdict = row.verdict;
  if (verdict.suppressed || verdict.verdict === null) return { label: 'Suppressed', tone: 'neutral' };
  if (!verdict.decided) return { label: 'Too early', tone: 'neutral' };
  if (verdict.verdict === 'SCALE') return { label: 'Scale', tone: 'success' };
  if (verdict.verdict === 'KILL') return { label: 'Kill', tone: 'destructive' };
  return { label: 'Watch', tone: 'warning' };
}

const VERDICT_TONE_CLASS: Record<string, string> = {
  success: 'bg-success-soft/40 text-success dark:bg-success/15',
  warning: 'bg-warning-soft text-warning dark:bg-warning/15',
  destructive: 'bg-destructive-soft/50 text-destructive dark:bg-destructive/15',
  neutral: 'bg-secondary/40 text-muted dark:bg-secondary/15 dark:text-slate-300',
};

export function VerdictPill({ row }: { row: PerformanceRow }) {
  const { label, tone } = verdictLabel(row);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs-tight font-semibold uppercase tracking-wide ${VERDICT_TONE_CLASS[tone]}`}
      title={row.verdict.reason}
    >
      {label}
    </span>
  );
}

const rowName = (row: PerformanceRow) =>
  row.group === 'CAMPAIGNS'
    ? (row.campaignName ?? row.campaignId ?? '—')
    : row.group === 'CREATIVES'
      ? (row.creative?.title ?? row.creative?.code ?? '—')
      : (row.adName ?? row.adId ?? '—');

export const PERFORMANCE_COLUMNS: PerfColumn[] = [
  {
    key: 'thumbnail', label: '', group: 'Identity', defaultOn: true, locked: true, frozen: true,
    width: 56,
    render: (row) => <PerfThumbnail row={row} />,
  },
  {
    key: 'name', label: 'Ad', group: 'Identity', defaultOn: true, locked: true, frozen: true,
    width: 240, sortKey: 'name',
    render: (row) => (
      <div className="min-w-0">
        <p className="truncate text-sm-custom font-semibold text-foreground" title={rowName(row)}>{rowName(row)}</p>
        <p className="mt-0.5 truncate text-xs-tight text-muted">
          {row.group === 'ADS' ? (row.campaignName ?? 'No campaign') : row.adCount != null ? `${row.adCount} ad${row.adCount === 1 ? '' : 's'}` : ''}
        </p>
      </div>
    ),
  },
  {
    key: 'code', label: 'Code', group: 'Identity', defaultOn: true, width: 110, mono: true,
    help: 'Canonical creative code from the registry, when the ad is linked.',
    render: (row) => row.creative?.code
      ? <span className="font-mono text-xs font-bold text-primary">{row.creative.code}</span>
      : <span className="text-xs-tight text-muted">unlinked</span>,
  },
  {
    key: 'creator', label: 'Creator', group: 'Identity', defaultOn: false, width: 140,
    render: (row) => row.creative?.creatorName ?? dash,
  },
  {
    key: 'store', label: 'Store', group: 'Identity', defaultOn: false, width: 140,
    render: (row) => row.creative?.storeName ?? dash,
  },
  {
    key: 'account', label: 'Account', group: 'Identity', defaultOn: false, width: 130, mono: true,
    render: (row) => row.accountId ? <span className="font-mono text-xs-tight text-muted">{row.accountId}</span> : dash,
  },
  {
    key: 'adIdRaw', label: 'Ad ID', group: 'Identity', defaultOn: false, width: 150, mono: true,
    help: 'Raw Meta ad id — useful in a spreadsheet or support thread.',
    render: (row) => row.adId ? <span className="font-mono text-xs-tight text-muted">{row.adId}</span> : dash,
  },
  {
    key: 'campaignIdRaw', label: 'Campaign ID', group: 'Identity', defaultOn: false, width: 150, mono: true,
    render: (row) => row.campaignId ? <span className="font-mono text-xs-tight text-muted">{row.campaignId}</span> : dash,
  },
  {
    key: 'status', label: 'Status', group: 'Today', defaultOn: true, width: 90,
    help: 'Current Meta delivery status from the latest imported insight.',
    render: (row) => row.status
      ? <span className={`text-xs-tight font-semibold uppercase ${row.status === 'ACTIVE' ? 'text-success' : 'text-muted'}`}>{row.status}</span>
      : dash,
  },
  {
    key: 'firstSpendDate', label: 'First spend', group: 'Today', defaultOn: false, width: 110, sortKey: 'firstSpendDate',
    render: (row) => row.firstSpendDate ?? dash,
  },
  {
    key: 'lastSpendDate', label: 'Last spend', group: 'Today', defaultOn: false, width: 110, sortKey: 'lastSpendDate',
    render: (row) => row.lastSpendDate ?? dash,
  },
  {
    key: 'ordersToday', label: 'Orders today', group: 'Today', numeric: true, defaultOn: true, width: 110, sortKey: 'ordersToday',
    help: 'POS orders attributed today (Manila) — only when the range includes today.',
    render: (row) => row.today.available ? formatCount(row.today.orders) : dash,
  },
  {
    key: 'spendToday', label: 'Spent today', group: 'Today', numeric: true, defaultOn: true, width: 110, sortKey: 'spendToday',
    render: (row) => row.today.available ? formatCurrency(row.today.spend) : dash,
  },
  {
    key: 'spendYesterday', label: 'Spent yesterday', group: 'Today', numeric: true, defaultOn: true, width: 125, sortKey: 'spendYesterday',
    render: (row) => row.today.spendYesterday == null ? dash : formatCurrency(row.today.spendYesterday),
  },
  {
    key: 'cpp', label: 'CPP', group: 'Money', numeric: true, defaultOn: true, width: 105, sortKey: 'cpp',
    help: 'Spend ÷ POS orders placed. Coloured by headroom against the break-even ceiling.',
    render: (row, ctx) => <CppCell value={row.metrics.cpp} scope={ctx.scope} />,
  },
  {
    key: 'delivered', label: 'Delivered', group: 'Orders', numeric: true, defaultOn: true, width: 95, sortKey: 'delivered',
    render: (row) => formatCount(row.metrics.delivered),
  },
  {
    key: 'deliveredCpp', label: 'Delivered CPP', group: 'Money', numeric: true, defaultOn: true, width: 120, sortKey: 'deliveredCpp',
    help: 'Spend ÷ delivered orders — the same figure the creative leaderboard calls Delivered CPP.',
    render: (row) => formatCurrency(row.metrics.deliveredCpp),
  },
  {
    key: 'netContribution', label: 'Net contribution', group: 'Money', numeric: true, defaultOn: true, width: 130, sortKey: 'netContribution',
    help: 'Delivered COD revenue − delivered COGS − reconciled fulfillment fees − ad spend.',
    render: (row) => <NetCell value={row.metrics.netContribution} />,
  },
  {
    key: 'hookRate', label: 'Hook', group: 'Engagement', numeric: true, defaultOn: true, width: 85, sortKey: 'hookRate',
    help: '3-second plays ÷ measured video impressions. Statics have no hook rate.',
    render: (row) => row.metrics.hookRate == null && row.creative?.kind === 'STATIC'
      ? <span className="text-xs-tight text-muted">static</span>
      : formatPercent(row.metrics.hookRate),
  },
  {
    key: 'holdRate', label: 'Hold', group: 'Engagement', numeric: true, defaultOn: true, width: 85, sortKey: 'holdRate',
    help: 'ThruPlays ÷ 3-second plays.',
    render: (row) => formatPercent(row.metrics.holdRate),
  },
  {
    key: 'deliveryRate', label: 'Delivery', group: 'Orders', numeric: true, defaultOn: true, width: 95, sortKey: 'deliveryRate',
    help: 'Delivered ÷ resolved (delivered + cancelled + RTS).',
    render: (row) => formatPercent(row.metrics.deliveryRate),
  },
  {
    key: 'rtsRate', label: 'RTS', group: 'Orders', numeric: true, defaultOn: true, width: 85, sortKey: 'rtsRate',
    help: 'Returned-to-sender ÷ resolved.',
    render: (row) => formatPercent(row.metrics.rtsRate),
  },
  {
    key: 'orders', label: 'Orders', group: 'Orders', numeric: true, defaultOn: false, width: 90, sortKey: 'orders',
    help: 'POS orders attributed in the period — from POS, never the pixel.',
    render: (row) => formatCount(row.metrics.orders),
  },
  {
    key: 'cancelled', label: 'Cancelled', group: 'Orders', numeric: true, defaultOn: false, width: 95, sortKey: 'cancelled',
    render: (row) => formatCount(row.metrics.cancelled),
  },
  {
    key: 'rts', label: 'RTS count', group: 'Orders', numeric: true, defaultOn: false, width: 95, sortKey: 'rts',
    render: (row) => formatCount(row.metrics.rts),
  },
  {
    key: 'inProcess', label: 'In process', group: 'Orders', numeric: true, defaultOn: false, width: 100,
    help: 'Orders placed but not yet delivered, cancelled, or RTS.',
    render: (row) => formatCount(row.metrics.inProcess),
  },
  {
    key: 'cancellationRate', label: 'Cancel', group: 'Orders', numeric: true, defaultOn: false, width: 90, sortKey: 'cancellationRate',
    help: 'Cancelled ÷ resolved — lost at the confirmation call. Above ~35% usually means the ad over-promises.',
    render: (row) => <CancelCell value={row.metrics.cancellationRate} />,
  },
  {
    key: 'impressions', label: 'Impressions', group: 'Engagement', numeric: true, defaultOn: false, width: 110, sortKey: 'impressions',
    render: (row) => formatCount(row.metrics.impressions),
  },
  {
    key: 'linkClicks', label: 'Link clicks', group: 'Engagement', numeric: true, defaultOn: false, width: 100, sortKey: 'linkClicks',
    render: (row) => formatCount(row.metrics.linkClicks),
  },
  {
    key: 'landingPageViews', label: 'LP views', group: 'Engagement', numeric: true, defaultOn: false, width: 95, sortKey: 'landingPageViews',
    help: 'Landing-page views — an arrival, not just a tap.',
    render: (row) => formatCount(row.metrics.landingPageViews),
  },
  {
    key: 'completionRate', label: 'Completion', group: 'Engagement', numeric: true, defaultOn: false, width: 105, sortKey: 'completionRate',
    help: 'ThruPlays ÷ measured video impressions.',
    render: (row) => formatPercent(row.metrics.completionRate),
  },
  {
    key: 'ctr', label: 'CTR', group: 'Engagement', numeric: true, defaultOn: false, width: 85, sortKey: 'ctr',
    help: 'Link clicks ÷ impressions.',
    render: (row) => formatPercent(row.metrics.ctr),
  },
  {
    key: 'cvr', label: 'CVR', group: 'Engagement', numeric: true, defaultOn: false, width: 85, sortKey: 'cvr',
    help: 'POS orders ÷ landing-page views. Withheld when LP views are unmeasured — never silently switched to clicks.',
    render: (row) => formatPercent(row.metrics.cvr),
  },
  {
    key: 'avgWatch', label: 'Avg watch', group: 'Engagement', numeric: true, defaultOn: false, width: 95,
    help: 'Impression-weighted average video play time.',
    render: (row) => seconds(row.metrics.avgWatchSeconds),
  },
  {
    key: 'retention25', label: 'Watch 25%', group: 'Engagement', numeric: true, defaultOn: false, width: 95,
    render: (row) => formatPercent(row.metrics.retention25),
  },
  {
    key: 'retention50', label: 'Watch 50%', group: 'Engagement', numeric: true, defaultOn: false, width: 95,
    render: (row) => formatPercent(row.metrics.retention50),
  },
  {
    key: 'retention75', label: 'Watch 75%', group: 'Engagement', numeric: true, defaultOn: false, width: 95,
    render: (row) => formatPercent(row.metrics.retention75),
  },
  {
    key: 'retention95', label: 'Watch 95%', group: 'Engagement', numeric: true, defaultOn: false, width: 95,
    render: (row) => formatPercent(row.metrics.retention95),
  },
  {
    key: 'retention100', label: 'Watch 100%', group: 'Engagement', numeric: true, defaultOn: false, width: 100,
    render: (row) => formatPercent(row.metrics.retention100),
  },
  {
    key: 'spend', label: 'Spend', group: 'Money', numeric: true, defaultOn: false, width: 110, sortKey: 'spend',
    render: (row) => formatCurrency(row.metrics.spend),
  },
  {
    key: 'cpc', label: 'CPC', group: 'Money', numeric: true, defaultOn: false, width: 90, sortKey: 'cpc',
    help: 'Spend ÷ link clicks.',
    render: (row) => formatCurrency(row.metrics.cpc),
  },
  {
    key: 'grossSales', label: 'Gross POS sales', group: 'Money', numeric: true, defaultOn: false, width: 130, sortKey: 'grossSales',
    render: (row) => formatCurrency(row.metrics.grossSales),
  },
  {
    key: 'deliveredSales', label: 'Delivered sales', group: 'Money', numeric: true, defaultOn: false, width: 125, sortKey: 'deliveredSales',
    render: (row) => formatCurrency(row.metrics.deliveredSales),
  },
  {
    key: 'adSpendRatio', label: 'Ad spend ratio', group: 'Money', numeric: true, defaultOn: false, width: 120, sortKey: 'adSpendRatio',
    help: 'Spend ÷ gross POS sales (AR%) — lower is better.',
    render: (row) => formatPercent(row.metrics.adSpendRatio),
  },
  {
    key: 'trueRoas', label: 'True ROAS', group: 'Money', numeric: true, defaultOn: false, width: 100, sortKey: 'trueRoas',
    help: 'Delivered COD revenue ÷ spend — cash that arrived, not platform-reported value.',
    render: (row) => row.metrics.trueRoas == null ? dash : `${formatDecimal(row.metrics.trueRoas)}×`,
  },
  {
    key: 'verdict', label: 'Action', group: 'Identity', defaultOn: true, locked: true, width: 110,
    help: 'Deterministic Scale/Watch/Kill recommendation against the working ceiling. Never an automatic Meta change.',
    render: (row) => <VerdictPill row={row} />,
  },
];

export const DEFAULT_VISIBLE_COLUMN_KEYS = PERFORMANCE_COLUMNS
  .filter((column) => column.defaultOn)
  .map((column) => column.key);

export const PERFORMANCE_COLUMN_STORAGE_KEY = 'advertising-performance-visible-columns';
