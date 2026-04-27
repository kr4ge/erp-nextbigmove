import apiClient from "@/lib/api-client";
import type {
  MarketingLeaderStatsResponse,
  MarketingMyStatsResponse,
  MarketingKpiDashboardResponse,
  MarketingKpiExecutiveDashboardResponse,
  MarketingKpiTeamDashboardResponse,
  ProblematicDeliveryResponse,
  SalesDashboardResponse,
} from "../_types/dashboard";

type QueryParams = Record<string, string | boolean | string[]>;
type TeamSummary = { id: string; name: string; teamCode?: string };

export async function getIntegrationCount(token: string) {
  const response = await apiClient.get("/integrations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(response.data) ? response.data.length : 0;
}

export async function getPermissions() {
  const res = await apiClient.get("/auth/permissions", {
    params: { workspace: "erp" },
  });
  return (res?.data?.permissions || []) as string[];
}

export async function getMyTeams() {
  const res = await apiClient.get("/teams/my-teams");
  return (res.data || []) as TeamSummary[];
}

export async function getExecutiveOverview(params: QueryParams) {
  const res = await apiClient.get("/analytics/sales/executive-overview", {
    params,
  });
  return res.data;
}

export async function getMarketingMyStats(params: QueryParams) {
  const res = await apiClient.get<MarketingMyStatsResponse>(
    "/analytics/marketing/my-stats",
    { params },
  );
  return res.data;
}

export async function getMarketingLeaderStats(params: QueryParams) {
  const res = await apiClient.get<MarketingLeaderStatsResponse>(
    "/analytics/marketing/leader-stats",
    { params },
  );
  return res.data;
}

export async function getMarketingKpiMe(params: QueryParams) {
  const response = await apiClient.get<MarketingKpiDashboardResponse>(
    "/kpis/marketing/dashboard/me",
    { params },
  );
  return response.data;
}

export async function getMarketingKpiTeam(params: QueryParams) {
  const response = await apiClient.get<MarketingKpiTeamDashboardResponse>(
    "/kpis/marketing/dashboard/team",
    { params },
  );
  return response.data;
}

export async function getMarketingKpiExecutive(params: QueryParams) {
  const response = await apiClient.get<MarketingKpiExecutiveDashboardResponse>(
    "/kpis/marketing/dashboard/executive",
    { params },
  );
  return response.data;
}

export async function getSalesDashboardBundle(params: QueryParams) {
  const [statsRes, problematicRes] = await Promise.all([
    apiClient.get<SalesDashboardResponse>("/analytics/sales-performance/my-stats", {
      params,
    }),
    apiClient.get<ProblematicDeliveryResponse>(
      "/analytics/sales-performance/my-problematic-delivery",
      { params },
    ),
  ]);

  return {
    stats: statsRes.data,
    problematic: problematicRes.data,
  };
}
