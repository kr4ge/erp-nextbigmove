"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { Target } from "lucide-react";
import { formatKpiValue } from "@/lib/kpi/format";
import type {
  ExecutiveKpiMemberRow,
  KpiDashboardCard,
  MarketingKpiExecutiveDashboardResponse,
} from "../_types/dashboard";
import { formatShortDate, KPI_STATUS_META } from "../_utils/dashboard";
import { DashboardSection } from "./dashboard-section";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const KPI_STATUS_GAUGE_COLOR: Record<KpiDashboardCard["status"], string> = {
  ON_TRACK: "#10b981",
  AT_RISK: "#f59e0b",
  MISSED: "#f43f5e",
  NO_TARGET: "#94a3b8",
};

function clampAchievement(value: number | null | undefined) {
  return Math.max(0, Math.min(value ?? 0, 100));
}

function buildKpiGaugeOption(card: KpiDashboardCard): EChartsOption {
  const hasAchievement =
    card.achievementPct !== null && card.achievementPct !== undefined;
  const gaugeValue = hasAchievement ? clampAchievement(card.achievementPct) : 0;

  return {
    animation: false,
    tooltip: { show: false },
    series: [
      {
        type: "gauge",
        startAngle: 90,
        endAngle: -270,
        pointer: { show: false },
        progress: {
          show: true,
          roundCap: true,
          clip: false,
          itemStyle: { color: KPI_STATUS_GAUGE_COLOR[card.status] },
        },
        axisLine: {
          lineStyle: {
            width: 16,
            color: [[1, "rgba(0, 0, 0, 0)"]],
          },
        },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: false,
          offsetCenter: [0, "0%"],
          formatter: hasAchievement ? `${gaugeValue.toFixed(0)}%` : "—",
          fontSize: 20,
          fontWeight: 600,
          color: "#475569",
        },
        data: [{ value: gaugeValue }],
      },
    ],
  };
}

interface KpiProgressCardProps {
  card: KpiDashboardCard;
}

function KpiProgressCard({ card }: KpiProgressCardProps) {
  const progressWidth = clampAchievement(card.achievementPct);
  const statusMeta = KPI_STATUS_META[card.status];

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {card.label}
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">
            {formatKpiValue(card.actualValue, card.format)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Target:{" "}
            <span className="font-medium tabular-nums text-slate-700">
              {card.targetValue === null
                ? "Not set"
                : formatKpiValue(card.targetValue, card.format)}
            </span>
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusMeta.badgeClass}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>
            {card.direction === "LOWER_IS_BETTER"
              ? "Lower is better"
              : "Higher is better"}
          </span>
          <span className="tabular-nums">
            {card.achievementPct === null
              ? "—"
              : `${card.achievementPct.toFixed(1)}%`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${statusMeta.progressClass}`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          {card.startDate} to {card.endDate}
        </span>
        <span>{card.dailyProgress.length} day(s)</span>
      </div>
    </div>
  );
}

interface KpiGaugeCardProps {
  card: KpiDashboardCard;
}

function KpiGaugeCard({ card }: KpiGaugeCardProps) {
  const statusMeta = KPI_STATUS_META[card.status];

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {card.label}
        </p>
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.badgeClass}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-[140px_minmax(0,1fr)] gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
        <div>
          <ReactECharts
            option={buildKpiGaugeOption(card)}
            style={{ height: 140, width: "100%" }}
            opts={{ renderer: "svg" }}
          />
        </div>

        <div className="flex flex-col justify-center gap-1">
          <p className="text-base font-semibold leading-none tabular-nums text-slate-900">
            {formatKpiValue(card.actualValue, card.format)}
          </p>
          <p className="text-[11px] text-slate-500">
            Target:{" "}
            <span className="font-medium tabular-nums text-slate-700">
              {card.targetValue === null
                ? "Not set"
                : formatKpiValue(card.targetValue, card.format)}
            </span>
          </p>
          <p className="text-[11px] tabular-nums text-slate-400">
            {formatAchievement(card.achievementPct)} achieved
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
        <span>
          {formatShortDate(card.startDate)} – {formatShortDate(card.endDate)}
        </span>
        <span>{card.dailyProgress.length}d</span>
      </div>
    </div>
  );
}

interface KpiProgressSectionProps {
  title: string;
  description: string;
  cards: KpiDashboardCard[];
  loading: boolean;
  error: string;
  meta?: ReactNode;
  loadingLabel?: string;
  emptyLabel?: string;
}

export function KpiProgressSection({
  title,
  description,
  cards,
  loading,
  error,
  meta,
  loadingLabel = "Loading KPI progress…",
  emptyLabel = "No KPI target is active for the selected date range.",
}: KpiProgressSectionProps) {
  return (
    <DashboardSection
      title={title}
      icon={<Target className="h-3.5 w-3.5 text-orange-500" />}
      contentClassName="space-y-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">{description}</p>
        {meta}
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          {loadingLabel}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
          {error}
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {cards.map((card) => (
            <KpiProgressCard key={card.metricKey} card={card} />
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

interface ExecutiveKpiSectionProps {
  data: MarketingKpiExecutiveDashboardResponse | null;
  loading: boolean;
  error: string;
}

function formatCategoryBadge(category: "SCALING" | "TESTING" | null) {
  if (!category) return null;
  return category === "SCALING" ? "Scaling" : "Testing";
}

function getMemberMetricCard(
  member: ExecutiveKpiMemberRow,
  metricKey: "USER_CREATIVES_CREATED" | "USER_AR_PCT",
) {
  return member.cards.find((card) => card.metricKey === metricKey);
}

function formatAchievement(achievementPct: number | null | undefined) {
  if (achievementPct === null || achievementPct === undefined) return "—";
  return `${achievementPct.toFixed(1)}%`;
}

export function ExecutiveKpiSection({
  data,
  loading,
  error,
}: ExecutiveKpiSectionProps) {
  return (
    <DashboardSection
      title="Marketing KPI Overview"
      icon={<Target className="h-3.5 w-3.5 text-orange-500" />}
      contentClassName="space-y-3"
    >
      {loading ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Loading executive KPI progress…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
          {error}
        </div>
      ) : !data ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No executive KPI data available.
        </div>
      ) : (
        <div className="space-y-3">
          {data.rows.map((row) => (
            <div
              key={row.teamCode}
              className="space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {row.teamName}
                  </h3>
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">
                    {row.teamCode}
                  </span>
                </div>
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {row.members.length} member
                  {row.members.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                {row.cards.map((card) => (
                  <KpiGaugeCard key={card.metricKey} card={card} />
                ))}
              </div>

              {row.members.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="min-w-[600px] w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Member
                        </th>
                        <th className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Cat.
                        </th>
                        <th className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Creatives
                        </th>
                        <th className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          AR
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {row.members.map((member) => {
                        const creativeCard = getMemberMetricCard(
                          member,
                          "USER_CREATIVES_CREATED",
                        );
                        const arCard = getMemberMetricCard(
                          member,
                          "USER_AR_PCT",
                        );
                        const creativeStatus =
                          KPI_STATUS_META[
                            creativeCard?.status || "NO_TARGET"
                          ];
                        const arStatus =
                          KPI_STATUS_META[arCard?.status || "NO_TARGET"];
                        const creativeProgressWidth = clampAchievement(
                          creativeCard?.achievementPct,
                        );
                        const arProgressWidth = clampAchievement(
                          arCard?.achievementPct,
                        );

                        return (
                          <tr
                            key={member.userId}
                            className="align-middle"
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              <p className="text-xs font-medium text-slate-900">
                                {member.name}
                              </p>
                              <p className="max-w-[180px] truncate text-[11px] text-slate-400">
                                {member.employeeId || member.email}
                              </p>
                            </td>
                            <td className="px-3 py-2">
                              {member.currentCategory ? (
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                  {formatCategoryBadge(
                                    member.currentCategory,
                                  )}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold tabular-nums text-slate-900">
                                    {creativeCard
                                      ? formatKpiValue(
                                          creativeCard.actualValue,
                                          creativeCard.format,
                                        )
                                      : "—"}
                                  </span>
                                  <span className="text-[10px] tabular-nums text-slate-400">
                                    / {creativeCard?.targetValue != null
                                      ? formatKpiValue(creativeCard.targetValue, creativeCard.format)
                                      : "—"}
                                  </span>
                                  <span
                                    className={`ml-auto inline-flex rounded-full border px-1.5 py-px text-[9px] font-semibold ${creativeStatus.badgeClass}`}
                                  >
                                    {creativeStatus.label}
                                  </span>
                                </div>
                                <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full ${creativeStatus.progressClass}`}
                                    style={{ width: `${creativeProgressWidth}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold tabular-nums text-slate-900">
                                    {arCard
                                      ? formatKpiValue(
                                          arCard.actualValue,
                                          arCard.format,
                                        )
                                      : "—"}
                                  </span>
                                  <span className="text-[10px] tabular-nums text-slate-400">
                                    / {arCard?.targetValue != null
                                      ? formatKpiValue(arCard.targetValue, arCard.format)
                                      : "—"}
                                  </span>
                                  <span
                                    className={`ml-auto inline-flex rounded-full border px-1.5 py-px text-[9px] font-semibold ${arStatus.badgeClass}`}
                                  >
                                    {arStatus.label}
                                  </span>
                                </div>
                                <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full ${arStatus.progressClass}`}
                                    style={{ width: `${arProgressWidth}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Separator between teams */}
              {data.rows.indexOf(row) < data.rows.length - 1 && (
                <div className="border-b border-slate-100" />
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
