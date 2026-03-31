"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/card";
import { AlertBanner } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/emptystate";
import {
  BarChart3,
  LinkIcon,
  StoreIcon,
  Zap,
  Users,
  TrendingUp,
  CheckCircle2,
  Coins,
  PieChart,
  Lightbulb,
  Boxes,
  DollarSignIcon,
  ClipboardList,
} from "lucide-react";
import dynamic from "next/dynamic";
import { DashboardDateControls } from "./_components/dashboard-date-controls";
import { DashboardSection } from "./_components/dashboard-section";
import {
  ExecutiveKpiSection,
  PersonalKpiSection,
  TeamKpiSection,
} from "./_components/kpi-sections";
import { NameConventionCard } from "./_components/name-convention-card";
import {
  getExecutiveOverview,
  getIntegrationCount,
  getMarketingKpiExecutive,
  getMarketingKpiMe,
  getMarketingKpiTeam,
  getMarketingLeaderStats,
  getMarketingMyStats,
  getMyTeams,
  getPermissions,
  getSalesDashboardBundle,
} from "./_services/dashboard.service";
import type {
  DashboardStats,
  ExecutiveOverviewStats,
  MarketingKpiDashboardResponse,
  MarketingKpiExecutiveDashboardResponse,
  MarketingKpiTeamDashboardResponse,
  MyStats,
  ProblematicDeliveryResponse,
  SalesDashboardResponse,
  SunburstHoverInfo,
} from "./_types/dashboard";
import {
  buildSparklineOption,
  formatCount,
  formatCurrency,
  formatDateInTimezone,
  formatDatepickerValue,
  formatNumber,
  formatPercent,
  formatSalesDelta,
  formatSalesValue,
  formatShortDate,
  getTodayRange,
  salesMetricDefinitions,
} from "./_utils/dashboard";

const Datepicker = dynamic(() => import("react-tailwindcss-datepicker"), {
  ssr: false,
});
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type DashboardUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
  employeeId?: string;
  permissions?: string[];
};

type DashboardTenant = {
  status?: string;
};

const EMPTY_SHOP_SELECTION: string[] = [];

export default function DashboardPage() {
  const today = useMemo(() => formatDateInTimezone(new Date()), []);
  const todayRange = useMemo(() => getTodayRange(), []);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [tenant, setTenant] = useState<DashboardTenant | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    integrationCount: 0,
    totalUsers: 1,
  });
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [range, setRange] = useState(todayRange);
  const [perms, setPerms] = useState<string[]>([]);
  const [excludeCancel, setExcludeCancel] = useState(true);
  const [excludeRestocking, setExcludeRestocking] = useState(true);
  const [excludeAbandoned, setExcludeAbandoned] = useState(true);
  const [showAllWinning, setShowAllWinning] = useState(false);
  const [excludeRts, setExcludeRts] = useState(true);
  const [includeTax12, setIncludeTax12] = useState(false);
  const [includeTax1, setIncludeTax1] = useState(false);
  const [execStats, setExecStats] = useState<ExecutiveOverviewStats | null>(
    null,
  );
  const [execLoading, setExecLoading] = useState(false);
  const [execError, setExecError] = useState("");
  const [teamCode, setTeamCode] = useState<string>("");
  const [teamName, setTeamName] = useState<string>("");
  const [teamCodeLoading, setTeamCodeLoading] = useState(false);
  const [leaderStats, setLeaderStats] = useState<{
    team_ad_spend: number;
    team_ar: number;
    team_overall_ranking: number | null;
  } | null>(null);
  const [marketingKpiData, setMarketingKpiData] =
    useState<MarketingKpiDashboardResponse | null>(null);
  const [marketingKpiLoading, setMarketingKpiLoading] = useState(false);
  const [marketingKpiError, setMarketingKpiError] = useState("");
  const [teamKpiData, setTeamKpiData] =
    useState<MarketingKpiTeamDashboardResponse | null>(null);
  const [teamKpiLoading, setTeamKpiLoading] = useState(false);
  const [teamKpiError, setTeamKpiError] = useState("");
  const [executiveKpiData, setExecutiveKpiData] =
    useState<MarketingKpiExecutiveDashboardResponse | null>(null);
  const [executiveKpiLoading, setExecutiveKpiLoading] = useState(false);
  const [executiveKpiError, setExecutiveKpiError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [salesRange, setSalesRange] = useState(todayRange);
  const [salesStartDate, setSalesStartDate] = useState(today);
  const [salesEndDate, setSalesEndDate] = useState(today);
  const [salesData, setSalesData] = useState<SalesDashboardResponse | null>(
    null,
  );
  const [salesProblematicData, setSalesProblematicData] =
    useState<ProblematicDeliveryResponse | null>(null);
  const [salesSunburstHoverInfo, setSalesSunburstHoverInfo] =
    useState<SunburstHoverInfo | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [shopOptions, setShopOptions] = useState<string[]>([]);
  const [selectedShops, setSelectedShops] = useState<string[]>([]);
  const [isAllShopsMode, setIsAllShopsMode] = useState(true);
  const [showShopPicker, setShowShopPicker] = useState(false);
  const [shopSearch, setShopSearch] = useState("");
  const [hasInitializedShopSelection, setHasInitializedShopSelection] =
    useState(false);
  const shopPickerRef = useRef<HTMLDivElement | null>(null);
  const lastSalesSunburstHoverKeyRef = useRef<string>("");
  const selectedShopsForQuery = useMemo(
    () => (isAllShopsMode ? EMPTY_SHOP_SELECTION : selectedShops),
    [isAllShopsMode, selectedShops],
  );

  const parseErrorMessage = (error: unknown, fallback: string) => {
    if (!error || typeof error !== "object") return fallback;
    const maybeError = error as {
      response?: { data?: { message?: unknown } };
      message?: unknown;
    };
    const responseMessage = maybeError.response?.data?.message;
    if (
      typeof responseMessage === "string" &&
      responseMessage.trim().length > 0
    )
      return responseMessage;
    if (
      typeof maybeError.message === "string" &&
      maybeError.message.trim().length > 0
    )
      return maybeError.message;
    return fallback;
  };

  const canViewMarketingDashboard = useMemo(() => {
    return perms.includes("dashboard.marketing");
  }, [perms]);

  const canViewMarketingLeader = useMemo(
    () => perms.includes("dashboard.marketing_leader"),
    [perms],
  );
  const canViewExecutives = useMemo(
    () => perms.includes("dashboard.executives"),
    [perms],
  );
  const canViewSalesDashboard = useMemo(
    () => perms.includes("dashboard.sales"),
    [perms],
  );

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    const tenantStr = localStorage.getItem("tenant");

    if (userStr) setUser(JSON.parse(userStr) as DashboardUser);
    if (tenantStr) setTenant(JSON.parse(tenantStr) as DashboardTenant);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          setIsLoading(false);
          return;
        }
        const integrationCount = await getIntegrationCount(token);
        setStats((prev) => ({
          ...prev,
          integrationCount,
        }));
      } catch (error: unknown) {
        setError(parseErrorMessage(error, "Failed to load dashboard data"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Fetch permissions to ensure gating reflects latest assignments
  useEffect(() => {
    const fetchPerms = async () => {
      try {
        setPerms(await getPermissions());
      } catch {
        setPerms((prev) => prev); // keep whatever we had
      }
    };
    fetchPerms();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        showShopPicker &&
        shopPickerRef.current &&
        !shopPickerRef.current.contains(e.target as Node)
      ) {
        setShowShopPicker(false);
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [showShopPicker]);

  // Fetch team code for name convention (uses my-teams)
  useEffect(() => {
    const fetchTeamCode = async () => {
      if (
        !canViewMarketingDashboard &&
        !canViewMarketingLeader &&
        !canViewExecutives
      )
        return;
      setTeamCodeLoading(true);
      try {
        const list = await getMyTeams();
        const stored = localStorage.getItem("current_team_id");
        const chosen = (stored && list.find((t) => t.id === stored)) || list[0];
        if (chosen?.teamCode) setTeamCode(chosen.teamCode);
        if (chosen?.name) setTeamName(chosen.name);
      } catch {
        // ignore
      } finally {
        setTeamCodeLoading(false);
      }
    };
    fetchTeamCode();
  }, [canViewMarketingDashboard, canViewMarketingLeader, canViewExecutives]);

  useEffect(() => {
    const fetchExecStats = async () => {
      if (!canViewExecutives) return;
      setExecLoading(true);
      setExecError("");
      try {
        const params: Record<string, string | boolean | string[]> = {};
        if (range.startDate)
          params.start_date = formatDateInTimezone(range.startDate);
        if (range.endDate)
          params.end_date = formatDateInTimezone(range.endDate);
        params.exclude_cancel = excludeCancel;
        params.exclude_restocking = excludeRestocking;
        params.exclude_abandoned = excludeAbandoned;
        params.exclude_rts = excludeRts;
        params.include_tax_12 = includeTax12;
        params.include_tax_1 = includeTax1;
        const overview = await getExecutiveOverview(params);
        const kpis = overview?.kpis || null;
        const counts = overview?.counts || {};
        setExecStats(
          kpis ? { ...kpis, purchases: counts.purchases ?? 0 } : null,
        );
      } catch (error: unknown) {
        setExecError(
          parseErrorMessage(error, "Failed to load executive stats"),
        );
      } finally {
        setExecLoading(false);
      }
    };
    fetchExecStats();
  }, [
    canViewExecutives,
    range.startDate,
    range.endDate,
    excludeCancel,
    excludeRestocking,
    excludeAbandoned,
    excludeRts,
    includeTax12,
    includeTax1,
  ]);

  useEffect(() => {
    const fetchMyStats = async () => {
      const canView =
        perms.includes("dashboard.marketing") ||
        perms.includes("dashboard.marketing_leader");
      if (!canView) return;
      setStatsLoading(true);
      setError("");
      try {
        const params: Record<string, string | boolean | string[]> = {};
        if (range.startDate)
          params.start_date = formatDateInTimezone(range.startDate);
        if (range.endDate)
          params.end_date = formatDateInTimezone(range.endDate);
        params.exclude_cancel = excludeCancel;
        params.exclude_restocking = excludeRestocking;
        params.exclude_abandoned = excludeAbandoned;
        params.exclude_rts = excludeRts;
        const data = await getMarketingMyStats(params);
        if (data?.kpis) {
          setMyStats({
            ...data.kpis,
            winning_creatives_list: data?.winning_creatives_list || [],
          });
        } else {
          setMyStats(null);
        }
      } catch (error: unknown) {
        setError(parseErrorMessage(error, "Failed to load your stats"));
        setMyStats(null);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchMyStats();
  }, [
    perms,
    range.startDate,
    range.endDate,
    excludeCancel,
    excludeRestocking,
    excludeAbandoned,
    excludeRts,
  ]);

  useEffect(() => {
    const fetchLeaderStats = async () => {
      if (!canViewMarketingLeader) return;
      setStatsLoading(true);
      setError("");
      try {
        const params: Record<string, string | boolean | string[]> = {};
        if (range.startDate)
          params.start_date = formatDateInTimezone(range.startDate);
        if (range.endDate)
          params.end_date = formatDateInTimezone(range.endDate);
        params.exclude_cancel = excludeCancel;
        params.exclude_restocking = excludeRestocking;
        params.exclude_abandoned = excludeAbandoned;
        params.exclude_rts = excludeRts;
        if (teamCode) params.team_code = teamCode;
        setLeaderStats((await getMarketingLeaderStats(params)) || null);
      } catch (error: unknown) {
        setError(parseErrorMessage(error, "Failed to load leader stats"));
        setLeaderStats(null);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchLeaderStats();
  }, [
    canViewMarketingLeader,
    range.startDate,
    range.endDate,
    excludeCancel,
    excludeRestocking,
    excludeAbandoned,
    excludeRts,
    teamCode,
  ]);

  useEffect(() => {
    const fetchMarketingKpi = async () => {
      if (!canViewMarketingDashboard) return;
      setMarketingKpiLoading(true);
      setMarketingKpiError("");
      try {
        const params: Record<string, string | boolean | string[]> = {};
        if (range.startDate)
          params.start_date = formatDateInTimezone(range.startDate);
        if (range.endDate)
          params.end_date = formatDateInTimezone(range.endDate);
        params.exclude_cancel = excludeCancel;
        params.exclude_restocking = excludeRestocking;
        params.exclude_abandoned = excludeAbandoned;
        params.exclude_rts = excludeRts;
        setMarketingKpiData(await getMarketingKpiMe(params));
      } catch (error: unknown) {
        setMarketingKpiError(
          parseErrorMessage(error, "Failed to load KPI progress"),
        );
        setMarketingKpiData(null);
      } finally {
        setMarketingKpiLoading(false);
      }
    };

    fetchMarketingKpi();
  }, [
    canViewMarketingDashboard,
    range.startDate,
    range.endDate,
    excludeCancel,
    excludeRestocking,
    excludeAbandoned,
    excludeRts,
  ]);

  useEffect(() => {
    const fetchTeamKpi = async () => {
      if (!canViewMarketingLeader) return;
      setTeamKpiLoading(true);
      setTeamKpiError("");
      try {
        const params: Record<string, string | boolean | string[]> = {};
        if (range.startDate)
          params.start_date = formatDateInTimezone(range.startDate);
        if (range.endDate)
          params.end_date = formatDateInTimezone(range.endDate);
        params.exclude_cancel = excludeCancel;
        params.exclude_restocking = excludeRestocking;
        params.exclude_abandoned = excludeAbandoned;
        params.exclude_rts = excludeRts;
        if (teamCode) params.team_code = teamCode;
        setTeamKpiData(await getMarketingKpiTeam(params));
      } catch (error: unknown) {
        setTeamKpiError(
          parseErrorMessage(error, "Failed to load team KPI progress"),
        );
        setTeamKpiData(null);
      } finally {
        setTeamKpiLoading(false);
      }
    };

    fetchTeamKpi();
  }, [
    canViewMarketingLeader,
    range.startDate,
    range.endDate,
    teamCode,
    excludeCancel,
    excludeRestocking,
    excludeAbandoned,
    excludeRts,
  ]);

  useEffect(() => {
    const fetchExecutiveKpi = async () => {
      if (!canViewExecutives) return;
      setExecutiveKpiLoading(true);
      setExecutiveKpiError("");
      try {
        const params: Record<string, string | boolean | string[]> = {};
        if (range.startDate)
          params.start_date = formatDateInTimezone(range.startDate);
        if (range.endDate)
          params.end_date = formatDateInTimezone(range.endDate);
        params.exclude_cancel = excludeCancel;
        params.exclude_restocking = excludeRestocking;
        params.exclude_abandoned = excludeAbandoned;
        params.exclude_rts = excludeRts;
        setExecutiveKpiData(await getMarketingKpiExecutive(params));
      } catch (error: unknown) {
        setExecutiveKpiError(
          parseErrorMessage(error, "Failed to load executive KPI progress"),
        );
        setExecutiveKpiData(null);
      } finally {
        setExecutiveKpiLoading(false);
      }
    };

    fetchExecutiveKpi();
  }, [
    canViewExecutives,
    range.startDate,
    range.endDate,
    excludeCancel,
    excludeRestocking,
    excludeAbandoned,
    excludeRts,
  ]);

  const resolvedShopSelection = useMemo(
    () => (isAllShopsMode ? shopOptions : selectedShops),
    [isAllShopsMode, selectedShops, shopOptions],
  );
  const isAllShopsSelected = isAllShopsMode;
  const selectedShopLabel = isAllShopsSelected
    ? "All shops"
    : `${selectedShops.length} selected`;
  const filteredShopOptions = useMemo(
    () =>
      shopOptions.filter((value) =>
        shopSearch.trim()
          ? (salesData?.filters?.shopDisplayMap?.[value] || value)
              .toLowerCase()
              .includes(shopSearch.toLowerCase())
          : true,
      ),
    [shopOptions, shopSearch, salesData?.filters?.shopDisplayMap],
  );

  useEffect(() => {
    const fetchSalesDashboard = async () => {
      if (!canViewSalesDashboard) return;
      setSalesSunburstHoverInfo(null);
      lastSalesSunburstHoverKeyRef.current = "";
      setSalesLoading(true);
      try {
        const params: Record<string, string | boolean | string[]> = {};
        params.start_date = salesStartDate;
        params.end_date = salesEndDate;
        if (!isAllShopsMode) {
          params.shop_id =
            selectedShopsForQuery.length > 0
              ? selectedShopsForQuery
              : ["__no_selection__"];
        }
        const { stats: statsData, problematic: problematicData } =
          await getSalesDashboardBundle(params);
        setSalesData(statsData);
        setSalesProblematicData(problematicData);

        const shops = statsData?.filters?.shops || [];
        setShopOptions(shops);
        if (!hasInitializedShopSelection) {
          setIsAllShopsMode(true);
          setSelectedShops((prev) => (prev.length === 0 ? prev : []));
          setHasInitializedShopSelection(true);
        } else if (isAllShopsMode) {
          setSelectedShops((prev) => (prev.length === 0 ? prev : []));
        } else {
          const allowed = new Set(shops);
          setSelectedShops((prev) => prev.filter((v) => allowed.has(v)));
        }
      } catch (err) {
        console.error("Failed to load sales dashboard", err);
        setSalesProblematicData(null);
      } finally {
        setSalesLoading(false);
      }
    };
    fetchSalesDashboard();
  }, [
    canViewSalesDashboard,
    salesStartDate,
    salesEndDate,
    selectedShopsForQuery,
    isAllShopsMode,
    hasInitializedShopSelection,
  ]);

  const accountStatus = useMemo(() => {
    const raw = (tenant?.status || "Unknown").toString();
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }, [tenant]);

  const displayName = useMemo(() => {
    if (!user) return "there";
    const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
    return name || user?.email || "there";
  }, [user]);

  const salesMetrics = useMemo(() => {
    return salesMetricDefinitions.map((def) => {
      const current = salesData?.summary?.[def.key] ?? 0;
      const previous = salesData?.prevSummary?.[def.key] ?? 0;
      return {
        ...def,
        current,
        previous,
        delta: formatSalesDelta(current, previous),
      };
    });
  }, [salesData]);

  const salesSunburstSeriesData = useMemo(() => {
    const baseHues = [24, 205, 142, 268, 347, 192, 48, 285];
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const tone = (hue: number, saturation: number, lightness: number) =>
      `hsl(${hue}, ${clamp(saturation, 35, 95)}%, ${clamp(lightness, 20, 88)}%)`;

    return (salesProblematicData?.data || []).map((l1, l1Index) => {
      const hue = baseHues[l1Index % baseHues.length];
      return {
        ...l1,
        itemStyle: { color: tone(hue, 90, 52) },
        children: (l1.children || []).map((l2, l2Index) => ({
          ...l2,
          itemStyle: {
            color: tone(hue, 80 - (l2Index % 3) * 4, 60 + (l2Index % 4) * 2),
          },
          children: (l2.children || []).map((l3, l3Index) => ({
            ...l3,
            itemStyle: {
              color: tone(hue, 72 - (l3Index % 4) * 4, 69 + (l3Index % 5) * 2),
            },
          })),
        })),
      };
    });
  }, [salesProblematicData?.data]);

  const salesSunburstLegend = useMemo(
    () =>
      (salesSunburstSeriesData || []).map(
        (node: {
          name?: string;
          value?: unknown;
          itemStyle?: { color?: string };
        }) => ({
          name: node?.name || "Unknown",
          count: Number(node?.value || 0),
          color: node?.itemStyle?.color || "#94A3B8",
        }),
      ),
    [salesSunburstSeriesData],
  );

  const salesSunburstOption = useMemo(
    () => ({
      tooltip: {
        show: false,
      },
      series: [
        {
          type: "sunburst",
          radius: ["2%", "94%"],
          data: salesSunburstSeriesData,
          sort: null,
          nodeClick: false,
          animation: false,
          animationDurationUpdate: 0,
          label: { show: false },
          itemStyle: {
            borderColor: "#ffffff",
            borderWidth: 2,
          },
          levels: [
            {},
            {
              r0: "8%",
              r: "24%",
              itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
              label: { show: false },
            },
            {
              r0: "34%",
              r: "50%",
              itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
              label: { show: false },
            },
            {
              r0: "60%",
              r: "76%",
              itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
              label: { show: false },
            },
          ],
          emphasis: {
            focus: "ancestor",
            itemStyle: {
              opacity: 1,
              borderColor: "#ffffff",
              borderWidth: 2,
            },
          },
          blur: {
            itemStyle: {
              opacity: 0.22,
              borderColor: "#ffffff",
              borderWidth: 2,
            },
          },
        },
      ],
    }),
    [salesSunburstSeriesData],
  );

  const salesSunburstEvents = useMemo(
    () => ({
      mouseover: (params: {
        seriesType?: string;
        treePathInfo?: Array<{ name?: string }>;
        name?: string;
        value?: unknown;
        color?: unknown;
      }) => {
        if (params?.seriesType !== "sunburst") return;
        const path =
          params?.treePathInfo
            ?.slice(1)
            ?.map((p) => p?.name)
            ?.filter((name: string | undefined) => !!name)
            ?.join(" / ") ||
          params?.name ||
          "Unknown";
        const orders = Number(params?.value || 0);
        const total = Number(salesProblematicData?.total || 0);
        const pct = total > 0 ? (orders / total) * 100 : 0;
        const color =
          typeof params?.color === "string" ? params.color : "#94A3B8";
        const key = `${path}|${orders}|${pct.toFixed(4)}|${color}`;
        if (lastSalesSunburstHoverKeyRef.current === key) {
          return;
        }
        lastSalesSunburstHoverKeyRef.current = key;
        setSalesSunburstHoverInfo({ path, orders, pct, color });
      },
      globalout: () => {
        if (!lastSalesSunburstHoverKeyRef.current) return;
        lastSalesSunburstHoverKeyRef.current = "";
        setSalesSunburstHoverInfo(null);
      },
    }),
    [salesProblematicData?.total],
  );

  const salesTrendChartData = useMemo(() => {
    const trend = salesProblematicData?.trend || [];
    const labels = trend.map((row) => {
      const [year, month, day] = row.date.split("-").map(Number);
      if (!year || !month || !day) return row.date;
      return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });
    const delivered = trend.map((row) => row.delivered_count || 0);
    const rts = trend.map((row) => row.rts_count || 0);
    const deliveredTotal = delivered.reduce((sum, value) => sum + value, 0);
    const rtsTotal = rts.reduce((sum, value) => sum + value, 0);
    return { labels, delivered, rts, deliveredTotal, rtsTotal };
  }, [salesProblematicData?.trend]);

  const salesTrendLineOption = useMemo(() => {
    const { labels, delivered, rts } = salesTrendChartData;

    return {
      tooltip: {
        trigger: "axis",
      },
      legend: {
        data: ["Delivered", "RTS"],
        top: 6,
        left: 12,
      },
      grid: {
        left: 16,
        right: 16,
        top: 42,
        bottom: 20,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        splitLine: {
          lineStyle: { color: "#E2E8F0" },
        },
      },
      series: [
        {
          name: "Delivered",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          data: delivered,
          lineStyle: { color: "#16A34A", width: 3 },
          itemStyle: { color: "#16A34A" },
          areaStyle: {
            color: "rgba(22,163,74,0.10)",
          },
        },
        {
          name: "RTS",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          data: rts,
          lineStyle: { color: "#F97316", width: 3 },
          itemStyle: { color: "#F97316" },
          areaStyle: {
            color: "rgba(249,115,22,0.10)",
          },
        },
      ],
    };
  }, [salesTrendChartData]);

  const salesUndeliverableChartData = useMemo(() => {
    const trend = salesProblematicData?.undeliverableTrend || [];
    const labels = trend.map((row) => {
      const [year, month, day] = row.date.split("-").map(Number);
      if (!year || !month || !day) return row.date;
      return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });
    const counts = trend.map((row) => row.count || 0);
    return { labels, counts };
  }, [salesProblematicData?.undeliverableTrend]);

  const salesUndeliverableSparklineOption = useMemo(
    () =>
      buildSparklineOption(
        salesUndeliverableChartData.labels,
        salesUndeliverableChartData.counts,
        "#E11D48",
        "rgba(225,29,72,0.16)",
        "Undeliverable",
      ),
    [salesUndeliverableChartData],
  );

  const salesOnDeliveryChartData = useMemo(() => {
    const trend = salesProblematicData?.onDeliveryTrend || [];
    const labels = trend.map((row) => {
      const [year, month, day] = row.date.split("-").map(Number);
      if (!year || !month || !day) return row.date;
      return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });
    const counts = trend.map((row) => row.count || 0);
    return { labels, counts };
  }, [salesProblematicData?.onDeliveryTrend]);

  const salesOnDeliverySparklineOption = useMemo(
    () =>
      buildSparklineOption(
        salesOnDeliveryChartData.labels,
        salesOnDeliveryChartData.counts,
        "#D97706",
        "rgba(217,119,6,0.18)",
        "On Delivery",
      ),
    [salesOnDeliveryChartData],
  );

  const salesDeliveredInRangeChartData = useMemo(() => {
    const trend = salesProblematicData?.deliveredInRangeTrend || [];
    const labels = trend.map((row) => {
      const [year, month, day] = row.date.split("-").map(Number);
      if (!year || !month || !day) return row.date;
      return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });
    const counts = trend.map((row) => row.count || 0);
    return { labels, counts };
  }, [salesProblematicData?.deliveredInRangeTrend]);

  const salesDeliveredInRangeSparklineOption = useMemo(
    () =>
      buildSparklineOption(
        salesDeliveredInRangeChartData.labels,
        salesDeliveredInRangeChartData.counts,
        "#16A34A",
        "rgba(22,163,74,0.20)",
        "Delivered",
      ),
    [salesDeliveredInRangeChartData],
  );

  const salesReturnedInRangeChartData = useMemo(() => {
    const trend = salesProblematicData?.returnedInRangeTrend || [];
    const labels = trend.map((row) => {
      const [year, month, day] = row.date.split("-").map(Number);
      if (!year || !month || !day) return row.date;
      return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });
    const counts = trend.map((row) => row.count || 0);
    return { labels, counts };
  }, [salesProblematicData?.returnedInRangeTrend]);

  const salesReturnedInRangeSparklineOption = useMemo(
    () =>
      buildSparklineOption(
        salesReturnedInRangeChartData.labels,
        salesReturnedInRangeChartData.counts,
        "#DC2626",
        "rgba(220,38,38,0.20)",
        "Returned",
      ),
    [salesReturnedInRangeChartData],
  );

  const salesDeliveredInRangeLabel = useMemo(() => {
    if (salesStartDate !== salesEndDate) {
      return `Delivered ${formatShortDate(salesStartDate)} → ${formatShortDate(salesEndDate)}`;
    }

    const now = new Date();
    const todayStr = formatDateInTimezone(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateInTimezone(yesterday);

    if (salesStartDate === todayStr) return "Delivered Today";
    if (salesStartDate === yesterdayStr) return "Delivered Yesterday";
    return `Delivered ${formatShortDate(salesStartDate)}`;
  }, [salesStartDate, salesEndDate]);

  const salesReturnedInRangeLabel = useMemo(() => {
    if (salesStartDate !== salesEndDate) {
      return `Returned ${formatShortDate(salesStartDate)} → ${formatShortDate(salesEndDate)}`;
    }

    const now = new Date();
    const todayStr = formatDateInTimezone(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateInTimezone(yesterday);

    if (salesStartDate === todayStr) return "Returned Today";
    if (salesStartDate === yesterdayStr) return "Returned Yesterday";
    return `Returned ${formatShortDate(salesStartDate)}`;
  }, [salesStartDate, salesEndDate]);

  const toggleShop = (value: string) => {
    if (isAllShopsMode) {
      setIsAllShopsMode(false);
      setSelectedShops(shopOptions.filter((v) => v !== value));
    } else {
      const has = selectedShops.includes(value);
      const next = has
        ? selectedShops.filter((v) => v !== value)
        : [...selectedShops, value];
      if (shopOptions.length > 0 && next.length === shopOptions.length) {
        setIsAllShopsMode(true);
        setSelectedShops([]);
      } else {
        setSelectedShops(next);
      }
    }
    setShowShopPicker(true);
  };

  const displayShop = (value: string) => {
    return salesData?.filters?.shopDisplayMap?.[value] || value;
  };

  const renderDefaultDashboard = () => (
    <>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here’s what’s happening with your business today."
      />
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Loading dashboard...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Users"
              value={stats.totalUsers}
              helper="Active this month"
              icon={<Users className="h-5 w-5" />}
              tone="default"
            />
            <MetricCard
              label="Integrations"
              value={stats.integrationCount}
              helper="Meta + POS"
              icon={<LinkIcon className="h-5 w-5" />}
            />
            <MetricCard
              label="Stores"
              value="—"
              helper="Connected POS stores"
              icon={<StoreIcon className="h-5 w-5" />}
            />
            <MetricCard
              label="Account Status"
              value={accountStatus}
              helper="Manage billing in settings"
              icon={<BarChart3 className="h-5 w-5" />}
              tone="warning"
            />
          </div>

          <DashboardSection
            title="Quick Actions"
            icon={<Zap className="h-3.5 w-3.5 text-orange-500" />}
            contentClassName="space-y-3"
          >
            <p className="text-sm text-slate-600">
              Move faster with these shortcuts.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                variant="secondary"
                iconLeft={<LinkIcon className="h-4 w-4" />}
              >
                Connect Meta Ads
              </Button>
              <Button
                variant="secondary"
                iconLeft={<StoreIcon className="h-4 w-4" />}
              >
                Connect POS Store
              </Button>
              <Button
                variant="secondary"
                iconLeft={<Zap className="h-4 w-4" />}
              >
                Invite Team Member
              </Button>
            </div>
          </DashboardSection>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <DashboardSection
              title="Recent Activity"
              icon={<TrendingUp className="h-3.5 w-3.5 text-orange-500" />}
              meta={
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              }
              contentClassName="space-y-2"
            >
              {[
                {
                  title: "Synced products from Agriblast PH",
                  time: "2h ago",
                  status: "ACTIVE" as const,
                },
                {
                  title: "Meta access token refreshed",
                  time: "5h ago",
                  status: "INFO" as const,
                },
                {
                  title: "Store added: The Book Hub",
                  time: "1d ago",
                  status: "ACTIVE" as const,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{item.time}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </DashboardSection>

            <DashboardSection
              title="Quick Links"
              icon={<LinkIcon className="h-3.5 w-3.5 text-orange-500" />}
              meta={
                <Button variant="ghost" size="sm">
                  Manage
                </Button>
              }
              contentClassName="space-y-2"
            >
              {[
                { label: "View Integrations", href: "/integrations" },
                { label: "Manage Stores", href: "/integrations/store" },
                { label: "Meta Accounts", href: "/integrations/meta" },
                { label: "Workspace Settings", href: "/settings" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 hover:bg-slate-50"
                >
                  <span>{link.label}</span>
                  <span className="text-slate-400">→</span>
                </a>
              ))}
            </DashboardSection>
          </div>

          <EmptyState
            title="No analytics events yet"
            description="When events arrive from your integrations, you’ll see them here."
            actionLabel="Connect an integration"
            onAction={() => (window.location.href = "/integrations")}
          />
        </>
      )}
    </>
  );

  const renderSalesDashboard = () => (
    <div className="space-y-4">
      <PageHeader
        title="Sales Dashboard"
        description="Your performance overview based on the selected date range."
      />

      <DashboardSection
        title="Monitoring"
        icon={<BarChart3 className="h-3.5 w-3.5 text-orange-500" />}
        meta={`Last updated: ${salesData?.lastUpdatedAt ? new Date(salesData.lastUpdatedAt).toLocaleString() : "—"}`}
        contentClassName="space-y-4"
      >
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Shop POS
            </p>
            <div className="relative" ref={shopPickerRef}>
              <button
                type="button"
                onClick={() => setShowShopPicker((p) => !p)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:border-orange-200 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <span className="text-slate-900">{selectedShopLabel}</span>
                <span className="text-slate-400 text-xs">
                  (click to choose)
                </span>
              </button>
              {showShopPicker && (
                <div className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 border-b border-slate-100">
                    <span>Select shops</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAllShopsMode(true);
                        setSelectedShops([]);
                      }}
                      className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="px-3 py-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={shopSearch}
                      onChange={(e) => setShopSearch(e.target.value)}
                      placeholder="Type to search"
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isAllShopsSelected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIsAllShopsMode(checked);
                            setSelectedShops([]);
                            setShowShopPicker(true);
                          }}
                          className="rounded border-slate-300 text-orange-600 focus:ring-orange-200"
                        />
                        <span>All</span>
                      </label>
                    </div>
                    {filteredShopOptions.map((value) => {
                      const checked = resolvedShopSelection.includes(value);
                      return (
                        <div
                          key={value}
                          className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleShop(value)}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-200"
                            />
                            <span>{displayShop(value)}</span>
                          </label>
                          <button
                            type="button"
                            className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                            onClick={() => {
                              setIsAllShopsMode(false);
                              setSelectedShops([value]);
                              setShowShopPicker(true);
                            }}
                          >
                            ONLY
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Date range
            </p>
            <div className="relative">
              <Datepicker
                value={salesRange}
                onChange={(
                  val: { startDate?: unknown; endDate?: unknown } | null,
                ) => {
                  const nextStartRaw = val?.startDate;
                  const nextEndRaw = val?.endDate;
                  const nextStartDate =
                    nextStartRaw instanceof Date ? nextStartRaw : null;
                  const nextEndDate =
                    nextEndRaw instanceof Date ? nextEndRaw : null;
                  setSalesRange({
                    startDate: nextStartDate,
                    endDate: nextEndDate,
                  });
                  setSalesStartDate(formatDatepickerValue(nextStartRaw, today));
                  setSalesEndDate(formatDatepickerValue(nextEndRaw, today));
                }}
                inputClassName="rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                containerClassName=""
                popupClassName={(defaultClass: string) =>
                  `${defaultClass} z-50`
                }
                displayFormat="MM/DD/YYYY"
                separator=" – "
                toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                placeholder=""
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {salesLoading
            ? Array.from({ length: salesMetricDefinitions.length }).map(
                (_, idx) => (
                  <div
                    key={idx}
                    className="animate-pulse rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                  >
                    <div className="h-3 w-20 bg-slate-200 rounded" />
                    <div className="mt-1.5 h-5 w-16 bg-slate-200 rounded" />
                    <div className="mt-1 h-2.5 w-14 bg-slate-200 rounded" />
                  </div>
                ),
              )
            : salesMetrics.map((m) => {
                const delta = m.delta;
                const deltaLabel =
                  delta === null
                    ? "N/A"
                    : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
                const deltaColor =
                  delta === null
                    ? "text-slate-400"
                    : delta >= 0
                      ? "text-emerald-600"
                      : "text-rose-500";
                return (
                  <div
                    key={m.key}
                    className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {m.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                      {formatSalesValue(m.current, m.format)}
                    </p>
                    <p
                      className={`mt-0.5 text-[10px] tabular-nums ${deltaColor}`}
                    >
                      {deltaLabel}
                      {salesData?.rangeDays
                        ? ` from previous ${salesData.rangeDays} day${salesData.rangeDays > 1 ? "s" : ""}`
                        : ""}
                    </p>
                  </div>
                );
              })}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Sales Performance"
        icon={<TrendingUp className="h-3.5 w-3.5 text-orange-500" />}
        meta={`${salesData?.rows?.length || 0} rows`}
        contentClassName="p-0"
      >
        <div className="overflow-hidden rounded-b-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shop POS
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    MKTG Cod
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sales Cod
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    SMP %
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    RTS Rate %
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Confirmation Rate %
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pending Rate %
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cancellation Rate %
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Upsell Rate %
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sales Upsell
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesLoading ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-sm text-slate-400"
                      colSpan={10}
                    >
                      Loading...
                    </td>
                  </tr>
                ) : salesData?.rows?.length ? (
                  salesData.rows.map((row) => (
                    <tr
                      key={`${row.shopId}`}
                      className="bg-white hover:bg-slate-50/50"
                    >
                      <td className="px-3 py-2.5 text-sm text-slate-700">
                        <div className="flex flex-col">
                          <span className="text-slate-900">
                            {displayShop(row.shopId)}
                          </span>
                          {displayShop(row.shopId) !== row.shopId && (
                            <span className="text-[11px] text-slate-400">
                              {row.shopId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-sm tabular-nums text-slate-700">
                        {formatCurrency(row.mktgCod)}
                      </td>
                      <td className="px-3 py-2.5 text-sm tabular-nums text-slate-700">
                        {formatCurrency(row.salesCod)}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-900">
                        {formatSalesValue(row.salesVsMktgPct, "percent")}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-900">
                        {formatSalesValue(row.rtsRatePct, "percent")}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-900">
                        {formatSalesValue(row.confirmationRatePct, "percent")}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-900">
                        {formatSalesValue(row.pendingRatePct, "percent")}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-900">
                        {formatSalesValue(row.cancellationRatePct, "percent")}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-900">
                        {formatSalesValue(row.upsellRatePct, "percent")}
                      </td>
                      <td className="px-3 py-2.5 text-sm tabular-nums text-slate-700">
                        {formatCurrency(row.upsellDelta)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-3 py-6 text-sm text-slate-400"
                      colSpan={10}
                    >
                      No data available for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Delivery Monitoring"
        icon={<ClipboardList className="h-3.5 w-3.5 text-orange-500" />}
        meta="Scoped to your matched sales assignee and selected shops"
        contentClassName="space-y-3"
      >
        <div className="flex items-center justify-end">
          <p className="text-xs text-slate-500">
            Total problematic orders:{" "}
            <span className="font-semibold tabular-nums text-slate-700">
              {formatCount(salesProblematicData?.total || 0)}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              On Delivery
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {formatCount(salesProblematicData?.onDeliveryAllTime?.count || 0)}
            </p>
            <p className="text-xs tabular-nums text-slate-500">
              COD:{" "}
              {formatCurrency(
                salesProblematicData?.onDeliveryAllTime?.totalCod || 0,
              )}
            </p>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-100 bg-white">
              {salesLoading ? (
                <div className="h-[140px] animate-pulse" />
              ) : (salesProblematicData?.onDeliveryTrend?.length || 0) > 0 ? (
                <ReactECharts
                  option={salesOnDeliverySparklineOption}
                  style={{ height: 140 }}
                />
              ) : (
                <div className="h-[140px] flex items-center justify-center text-xs text-slate-400">
                  No on-delivery trend data.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Undeliverable
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {formatCount(
                salesProblematicData?.undeliverableAllTime?.count || 0,
              )}
            </p>
            <p className="text-xs tabular-nums text-slate-500">
              COD:{" "}
              {formatCurrency(
                salesProblematicData?.undeliverableAllTime?.totalCod || 0,
              )}
            </p>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-100 bg-white">
              {salesLoading ? (
                <div className="h-[140px] animate-pulse" />
              ) : (salesProblematicData?.undeliverableTrend?.length || 0) >
                0 ? (
                <ReactECharts
                  option={salesUndeliverableSparklineOption}
                  style={{ height: 140 }}
                />
              ) : (
                <div className="h-[140px] flex items-center justify-center text-xs text-slate-400">
                  No undeliverable trend data.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {salesDeliveredInRangeLabel}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {formatCount(salesProblematicData?.deliveredInRange?.count || 0)}
            </p>
            <p className="text-xs tabular-nums text-slate-500">
              COD:{" "}
              {formatCurrency(
                salesProblematicData?.deliveredInRange?.totalCod || 0,
              )}
            </p>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-100 bg-white">
              {salesLoading ? (
                <div className="h-[140px] animate-pulse" />
              ) : (salesProblematicData?.deliveredInRangeTrend?.length || 0) >
                0 ? (
                <ReactECharts
                  option={salesDeliveredInRangeSparklineOption}
                  style={{ height: 140 }}
                />
              ) : (
                <div className="h-[140px] flex items-center justify-center text-xs text-slate-400">
                  No delivered trend data.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {salesReturnedInRangeLabel}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {formatCount(salesProblematicData?.returnedInRange?.count || 0)}
            </p>
            <p className="text-xs tabular-nums text-slate-500">
              COD:{" "}
              {formatCurrency(
                salesProblematicData?.returnedInRange?.totalCod || 0,
              )}
            </p>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-100 bg-white">
              {salesLoading ? (
                <div className="h-[140px] animate-pulse" />
              ) : (salesProblematicData?.returnedInRangeTrend?.length || 0) >
                0 ? (
                <ReactECharts
                  option={salesReturnedInRangeSparklineOption}
                  style={{ height: 140 }}
                />
              ) : (
                <div className="h-[140px] flex items-center justify-center text-xs text-slate-400">
                  No returned trend data.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 lg:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
              RTS Reason Data
            </p>
            {salesLoading ? (
              <div className="h-[440px] animate-pulse rounded-lg bg-white" />
            ) : (salesProblematicData?.data?.length || 0) > 0 ? (
              <div className="flex flex-col">
                <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {salesSunburstLegend.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-1.5 text-[11px] text-slate-600"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-slate-700">
                        {item.name}
                      </span>
                      <span className="text-slate-500">
                        {formatCount(item.count)}
                      </span>
                    </div>
                  ))}
                </div>
                <ReactECharts
                  option={salesSunburstOption}
                  onEvents={salesSunburstEvents}
                  style={{ height: 420 }}
                />
                <div className="mt-2 min-h-[76px] rounded-lg border border-slate-100 bg-white px-3 py-2">
                  {salesSunburstHoverInfo ? (
                    <div className="space-y-1">
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          className="mt-1 h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: salesSunburstHoverInfo.color,
                          }}
                        />
                        <p
                          className="line-clamp-2 min-w-0 flex-1 whitespace-normal break-words text-sm font-medium leading-5 text-slate-800"
                          title={salesSunburstHoverInfo.path}
                        >
                          {salesSunburstHoverInfo.path}
                        </p>
                      </div>
                      <p className="text-xs text-slate-600">
                        Orders:{" "}
                        <span className="font-semibold text-slate-900">
                          {formatCount(salesSunburstHoverInfo.orders)}
                        </span>{" "}
                        ({salesSunburstHoverInfo.pct.toFixed(1)}%)
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Hover a chart segment to inspect details.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-[440px] items-center justify-center text-sm text-slate-400">
                No RTS reason data.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 lg:col-span-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
              Delivered vs RTS Trend
            </p>
            {salesLoading ? (
              <div className="h-[440px] animate-pulse rounded-lg bg-white" />
            ) : (salesProblematicData?.trend?.length || 0) > 0 ? (
              <ReactECharts
                option={salesTrendLineOption}
                style={{ height: 440 }}
              />
            ) : (
              <div className="flex h-[440px] items-center justify-center text-sm text-slate-400">
                No trend data for the selected range.
              </div>
            )}
          </div>
        </div>
      </DashboardSection>
    </div>
  );

  const renderMarketingDashboard = () => (
    <div className="space-y-6">
      {error && <AlertBanner tone="error" message={error} className="mb-2" />}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Good day, {displayName}{" "}
            {teamName ? (
              <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 align-super">
                {teamName}
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-slate-600">
            This is your report based on the selected period.
          </p>
        </div>
        <DashboardDateControls
          range={range}
          onRangeChange={setRange}
          filters={[
            {
              id: "exclude-canceled",
              label: "Exclude canceled",
              checked: excludeCancel,
              onChange: setExcludeCancel,
            },
            {
              id: "exclude-restocking",
              label: "Exclude restocking",
              checked: excludeRestocking,
              onChange: setExcludeRestocking,
            },
            {
              id: "exclude-abandoned",
              label: "Exclude abandoned",
              checked: excludeAbandoned,
              onChange: setExcludeAbandoned,
            },
            {
              id: "exclude-rts",
              label: "Exclude RTS",
              checked: excludeRts,
              onChange: setExcludeRts,
            },
          ]}
        />
      </div>

      {statsLoading && (
        <AlertBanner tone="info" message="Loading your stats..." />
      )}

      <PersonalKpiSection
        title="My Marketing KPI"
        description="Live KPI progress for your current active targets."
        cards={marketingKpiData?.cards || []}
        loading={marketingKpiLoading}
        error={marketingKpiError}
        meta={
          marketingKpiData?.category ? (
            <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              Category: {marketingKpiData.category}
            </span>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <MetricCard
          label="My Ad Spent"
          value={formatCurrency(myStats?.ad_spend)}
          icon={<Coins className="h-5 w-5 text-emerald-600" />}
          tone="default"
        />
        <MetricCard
          label="Winning Creatives"
          value={formatNumber(myStats?.winning_creatives)}
          icon={<Lightbulb className="h-5 w-5 text-amber-500" />}
          tone="default"
        />
        <MetricCard
          label="Creatives Created"
          value={formatNumber(myStats?.creatives_created)}
          icon={<Zap className="h-5 w-5 text-emerald-600" />}
          tone="default"
        />
        <MetricCard
          label="Overall Ranking"
          value={myStats?.overall_ranking ?? "—"}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="default"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DashboardSection
          title="Winning Creatives"
          icon={<Lightbulb className="h-3.5 w-3.5 text-orange-500" />}
          meta={
            myStats?.winning_creatives_list &&
            myStats.winning_creatives_list.length > 3 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllWinning((p) => !p)}
              >
                {showAllWinning ? "Collapse" : "View all"}
              </Button>
            ) : null
          }
          contentClassName="space-y-2"
        >
          {myStats?.winning_creatives_list &&
          myStats.winning_creatives_list.length > 0 ? (
            (showAllWinning
              ? myStats.winning_creatives_list
              : myStats.winning_creatives_list.slice(0, 3)
            ).map((item, idx) => (
              <div
                key={`${item.adId || "ad"}-${idx}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {item.adName || "Unnamed creative"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.adId || "No Ad ID"}
                  </p>
                </div>
                <StatusBadge status="ACTIVE" />
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">
              No winning creatives in this range.
            </p>
          )}
        </DashboardSection>

        <DashboardSection
          title="Quick Links"
          icon={<LinkIcon className="h-3.5 w-3.5 text-orange-500" />}
          meta={
            <Button variant="ghost" size="sm">
              Manage
            </Button>
          }
          contentClassName="space-y-2"
        >
          {[
            { label: "Marketer leaderboard", href: "#marketer" },
            { label: "Team leaderboard", href: "#team" },
            { label: "Marketing analytics", href: "/analytics/marketing" },
          ].map((link) => (
            <a
              key={`${link.href}-${link.label}`}
              href={link.href}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 hover:bg-slate-50"
            >
              <span>{link.label}</span>
              <span className="text-slate-400">→</span>
            </a>
          ))}
        </DashboardSection>
      </div>

      <NameConventionCard
        teamCode={teamCode}
        teamCodeLoading={teamCodeLoading}
        employeeId={user?.employeeId}
      />
    </div>
  );

  const renderExecutiveDashboard = () => (
    <div className="space-y-5">
      {execError && (
        <AlertBanner tone="error" message={execError} className="mb-2" />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Executive Dashboard
          </h1>
          <p className="text-sm text-slate-600">
            Challenge-driven KPI command center for team and member performance.
          </p>
        </div>
        <DashboardDateControls
          range={range}
          onRangeChange={setRange}
          filterMenuWidthClassName="w-60"
          filters={[
            {
              id: "exclude-canceled",
              label: "Exclude Canceled",
              checked: excludeCancel,
              onChange: setExcludeCancel,
            },
            {
              id: "exclude-restocking",
              label: "Exclude Restocking",
              checked: excludeRestocking,
              onChange: setExcludeRestocking,
            },
            {
              id: "exclude-abandoned",
              label: "Exclude Abandoned",
              checked: excludeAbandoned,
              onChange: setExcludeAbandoned,
            },
            {
              id: "exclude-rts",
              label: "Exclude RTS",
              checked: excludeRts,
              onChange: setExcludeRts,
            },
            {
              id: "include-tax-12",
              label: "Include 12% Ads Tax",
              checked: includeTax12,
              onChange: setIncludeTax12,
            },
            {
              id: "include-tax-1",
              label: "Include 1% Ads Tax",
              checked: includeTax1,
              onChange: setIncludeTax1,
            },
          ]}
        />
      </div>

      {execLoading && (
        <AlertBanner tone="info" message="Loading executive stats..." />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(execStats?.revenue)}
          icon={<DollarSignIcon className="h-5 w-5" />}
          tone="success"
          className="h-full"
          valueClassName="text-2xl"
        />
        <MetricCard
          label="Total Sales"
          value={formatNumber(execStats?.purchases)}
          helper="Orders placed"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="default"
          className="h-full"
          valueClassName="text-2xl"
        />
        <MetricCard
          label="Confirmed Sales"
          value={formatCurrency(execStats?.confirmed ?? 0)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
          className="h-full"
          valueClassName="text-2xl"
        />
        <MetricCard
          label="Ad Spend"
          value={formatCurrency(execStats?.ad_spend)}
          helper="Tax inclusive if selected"
          icon={<Coins className="h-5 w-5" />}
          tone="warning"
          className="h-full"
          valueClassName="text-2xl"
        />
        <MetricCard
          label="AR %"
          value={formatPercent(execStats?.ar_pct)}
          helper="Spend / Revenue"
          icon={<PieChart className="h-5 w-5" />}
          tone="default"
          className="h-full"
          valueClassName="text-2xl"
        />
        <MetricCard
          label="CM (RTS 20%)"
          value={formatCurrency(execStats?.cm_rts_forecast)}
          helper="Contribution margin forecast"
          icon={<Zap className="h-5 w-5" />}
          tone="warning"
          className="h-full"
          valueClassName="text-2xl"
        />
      </div>

      <ExecutiveKpiSection
        data={executiveKpiData}
        loading={executiveKpiLoading}
        error={executiveKpiError}
      />

      <NameConventionCard
        teamCode={teamCode}
        teamCodeLoading={teamCodeLoading}
        employeeId={user?.employeeId}
      />
    </div>
  );

  const renderLeaderDashboard = () => (
    <div className="space-y-6">
      {error && <AlertBanner tone="error" message={error} className="mb-2" />}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Good day, {displayName}{" "}
              {teamName ? (
                <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 align-super">
                  {teamName}
                </span>
              ) : null}
            </h1>
            <p className="text-sm text-slate-600">
              This is your team report based on the selected period.
            </p>
          </div>
        </div>
        <DashboardDateControls
          range={range}
          onRangeChange={setRange}
          filters={[
            {
              id: "exclude-canceled",
              label: "Exclude canceled",
              checked: excludeCancel,
              onChange: setExcludeCancel,
            },
            {
              id: "exclude-restocking",
              label: "Exclude restocking",
              checked: excludeRestocking,
              onChange: setExcludeRestocking,
            },
            {
              id: "exclude-abandoned",
              label: "Exclude abandoned",
              checked: excludeAbandoned,
              onChange: setExcludeAbandoned,
            },
            {
              id: "exclude-rts",
              label: "Exclude RTS",
              checked: excludeRts,
              onChange: setExcludeRts,
            },
          ]}
        />
      </div>

      {statsLoading && (
        <AlertBanner tone="info" message="Loading your stats..." />
      )}

      <TeamKpiSection
        data={teamKpiData}
        loading={teamKpiLoading}
        error={teamKpiError}
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
        <MetricCard
          label="My Ad Spend"
          value={formatCurrency(myStats?.ad_spend)}
          helper="Across selected range"
          icon={<Coins className="h-5 w-5 text-emerald-600" />}
          tone="default"
        />
        <MetricCard
          label="My AR"
          value={formatPercent(myStats?.ar)}
          helper="Spend / Revenue"
          icon={<PieChart className="h-5 w-5" />}
          tone="default"
        />
        <MetricCard
          label="Team Ad Spend"
          value={formatCurrency(leaderStats?.team_ad_spend)}
          helper={teamName ? `${teamName} total spend` : "Team total spend"}
          icon={<Users className="h-5 w-5" />}
          tone="default"
        />
        <MetricCard
          label="Team AR"
          value={formatPercent(leaderStats?.team_ar)}
          helper="Team Spend / Revenue"
          icon={<Boxes className="h-5 w-5" />}
          tone="default"
        />
        <MetricCard
          label="Overall Team Ranking"
          value={leaderStats?.team_overall_ranking ?? "—"}
          helper="Coming soon"
          icon={<BarChart3 className="h-5 w-5" />}
          tone="default"
        />
      </div>

      <NameConventionCard
        teamCode={teamCode}
        teamCodeLoading={teamCodeLoading}
        employeeId={user?.employeeId}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {canViewExecutives
        ? renderExecutiveDashboard()
        : canViewMarketingLeader
          ? renderLeaderDashboard()
          : canViewMarketingDashboard
            ? renderMarketingDashboard()
            : canViewSalesDashboard
              ? renderSalesDashboard()
              : renderDefaultDashboard()}
    </div>
  );
}
