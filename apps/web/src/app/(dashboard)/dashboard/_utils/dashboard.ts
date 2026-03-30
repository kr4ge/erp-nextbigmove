import type {
  DateRangeValue,
  KpiDashboardCard,
  SalesMetricDefinition,
} from "../_types/dashboard";

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Manila";

export const salesMetricDefinitions: SalesMetricDefinition[] = [
  { key: "mktg_cod", label: "MKTG Cod (₱)", format: "currency" },
  { key: "sales_cod", label: "Sales Cod (₱)", format: "currency" },
  { key: "sales_vs_mktg_pct", label: "SMP %", format: "percent" },
  { key: "rts_rate_pct", label: "RTS Rate (%)", format: "percent" },
  {
    key: "confirmation_rate_pct",
    label: "Confirmation Rate (%)",
    format: "percent",
  },
  { key: "pending_rate_pct", label: "Pending Rate (%)", format: "percent" },
  {
    key: "cancellation_rate_pct",
    label: "Cancellation Rate (%)",
    format: "percent",
  },
  { key: "upsell_rate_pct", label: "Upsell Rate (%)", format: "percent" },
];

export const KPI_STATUS_META: Record<
  KpiDashboardCard["status"],
  { label: string; badgeClass: string; progressClass: string }
> = {
  ON_TRACK: {
    label: "On Track",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    progressClass: "bg-emerald-500",
  },
  AT_RISK: {
    label: "At Risk",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    progressClass: "bg-amber-500",
  },
  MISSED: {
    label: "Missed",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    progressClass: "bg-rose-500",
  },
  NO_TARGET: {
    label: "No Target",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
    progressClass: "bg-slate-300",
  },
};

export const formatDateInTimezone = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const parseYmdToLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

export const normalizePickerDate = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") return parseYmdToLocalDate(value.slice(0, 10));
  return null;
};

export const getTodayRange = (): DateRangeValue => {
  const today = formatDateInTimezone(new Date());
  return {
    startDate: parseYmdToLocalDate(today),
    endDate: parseYmdToLocalDate(today),
  };
};

export const formatCount = (val?: number) =>
  new Intl.NumberFormat("en-US").format(val ?? 0);

export const formatShortDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatCurrency = (val?: number) =>
  typeof val === "number"
    ? new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
      }).format(val)
    : "—";

export const formatNumber = (val?: number) =>
  typeof val === "number" ? new Intl.NumberFormat("en-US").format(val) : "—";

export const formatPercent = (val?: number) =>
  typeof val === "number" ? `${val.toFixed(1)}%` : "—";

export const formatSalesValue = (
  val: number,
  format: "currency" | "percent" | "number",
) => {
  if (!Number.isFinite(val)) return "—";
  if (format === "currency") {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(val);
  }
  if (format === "percent") {
    return `${val.toFixed(2)}%`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    val,
  );
};

export const formatSalesDelta = (current: number, previous: number) => {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

export const formatDatepickerValue = (value: unknown, fallbackYmd: string) => {
  if (!value) return fallbackYmd;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return formatDateInTimezone(value);
  return fallbackYmd;
};

export const buildSparklineOption = (
  labels: string[],
  data: number[],
  color: string,
  fill: string,
  seriesLabel: string,
) => ({
  animation: false,
  tooltip: {
    trigger: "axis",
    confine: true,
    formatter: (
      params:
        | { value?: unknown; axisValueLabel?: string; axisValue?: string }
        | Array<{ value?: unknown; axisValueLabel?: string; axisValue?: string }>,
    ) => {
      const row = Array.isArray(params) ? params[0] : params;
      const value = Number(row?.value ?? 0);
      const date = row?.axisValueLabel || row?.axisValue || "";
      return `${seriesLabel}<br/>${date}: ${formatCount(value)}`;
    },
  },
  grid: {
    left: 8,
    right: 8,
    top: 6,
    bottom: 6,
    containLabel: false,
  },
  xAxis: {
    type: "category",
    data: labels,
    show: false,
    boundaryGap: false,
  },
  yAxis: {
    type: "value",
    show: false,
    scale: true,
  },
  series: [
    {
      name: seriesLabel,
      type: "line",
      data,
      smooth: true,
      symbol: "none",
      lineStyle: { color, width: 4 },
      areaStyle: { color: fill },
    },
  ],
});
