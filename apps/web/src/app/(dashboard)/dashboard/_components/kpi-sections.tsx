"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { Flame, Medal, Target, Users } from "lucide-react";
import { formatKpiValue } from "@/lib/kpi/format";
import { DashboardTabs } from "@/components/ui/dashboard-tabs";
import { KpiMilestoneTrack } from "@/components/ui/kpi-milestone-track";
import type {
  ExecutiveKpiMemberRow,
  ExecutiveKpiTeamRow,
  KpiDashboardCard,
  MarketingKpiExecutiveDashboardResponse,
  MarketingKpiTeamDashboardResponse,
} from "../_types/dashboard";
import {
  calculateStreak,
  formatShortDate,
  getStreakMessage,
  KPI_STATUS_META,
} from "../_utils/dashboard";
import { DashboardSection } from "./dashboard-section";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/* ── Color helpers ──────────────────────────────────────────── */

const GAUGE_COLORS: Record<KpiDashboardCard["status"], string> = {
  ON_TRACK: "#10b981",
  AT_RISK: "#f97316",
  MISSED: "#fb923c",
  NO_TARGET: "#94a3b8",
};

const GAUGE_GLOW: Record<KpiDashboardCard["status"], string> = {
  ON_TRACK: "rgba(16,185,129,0.25)",
  AT_RISK: "rgba(249,115,22,0.28)",
  MISSED: "rgba(251,146,60,0.24)",
  NO_TARGET: "rgba(148,163,184,0.15)",
};

const GAUGE_BG: Record<KpiDashboardCard["status"], string> = {
  ON_TRACK: "#dcfce7",
  AT_RISK: "#ffedd5",
  MISSED: "#fff1e6",
  NO_TARGET: "#f1f5f9",
};

function getEffectiveColor(card: KpiDashboardCard): string {
  return GAUGE_COLORS[card.status];
}

function getEffectiveBg(card: KpiDashboardCard): string {
  return GAUGE_BG[card.status];
}

function getEffectiveGlow(card: KpiDashboardCard): string {
  return GAUGE_GLOW[card.status];
}

function clampAchievement(value: number | null | undefined) {
  return Math.max(0, Math.min(value ?? 0, 100));
}

/* ── Gauge builders ─────────────────────────────────────────── */

function buildKpiGaugeOption(card: KpiDashboardCard): EChartsOption {
  const gaugeValue = clampAchievement(card.achievementPct);
  const color = getEffectiveColor(card);
  const bgColor = getEffectiveBg(card);
  const glowColor = getEffectiveGlow(card);
  const actualText = formatKpiValue(card.actualValue, card.format);
  const targetText =
    card.targetValue === null
      ? "Target: Not set"
      : `Target: ${formatKpiValue(card.targetValue, card.format)}`;
  const valueFontSize = card.format === "currency" ? 24 : 32;

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
          itemStyle: {
            color,
            shadowColor: glowColor,
            shadowBlur: 8,
          },
        },
        axisLine: {
          lineStyle: {
            width: 16,
            color: [[1, bgColor]],
          },
        },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: false,
          offsetCenter: [0, "8%"],
          formatter: `{value|${actualText}}\n{target|${targetText}}`,
          rich: {
            value: {
              fontSize: valueFontSize,
              fontWeight: 700,
              lineHeight: 34,
              color: "#0f172a",
              align: "center",
            },
            target: {
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 18,
              color: "#64748b",
              align: "center",
            },
          },
        },
        data: [{ value: gaugeValue }],
      },
    ],
  };
}

function buildMiniRingOption(card: KpiDashboardCard): EChartsOption {
  const hasAchievement =
    card.achievementPct !== null && card.achievementPct !== undefined;
  const gaugeValue = hasAchievement ? clampAchievement(card.achievementPct) : 0;
  const color = getEffectiveColor(card);
  const bgColor = getEffectiveBg(card);
  const glowColor = getEffectiveGlow(card);

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
          itemStyle: {
            color,
            shadowColor: glowColor,
            shadowBlur: 6,
          },
        },
        axisLine: {
          lineStyle: {
            width: 10,
            color: [[1, bgColor]],
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
          fontSize: 14,
          fontWeight: 600,
          color,
        },
        data: [{ value: gaugeValue }],
      },
    ],
  };
}

/* ── Single MilestoneTimeline (for KpiProgressCard) ─────────── */

const KPI_PROGRESS_STEPS = [
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
] as const;

function MilestoneTimeline({ card }: { card: KpiDashboardCard }) {
  return (
    <KpiMilestoneTrack
      progress={clampAchievement(card.achievementPct)}
      activeColor={getEffectiveColor(card)}
      size="sm"
      steps={KPI_PROGRESS_STEPS.map((step) => ({
        value: step.value,
        label: step.label,
      }))}
      className="px-1 py-2"
    />
  );
}

/* ── Combined Progress Bar (executive — single overall KPI progress) */

function CombinedProgressBar({ cards }: { cards: KpiDashboardCard[] }) {
  if (cards.length === 0) return null;

  const trackedAchievements = cards
    .filter((card) => card.achievementPct !== null && card.achievementPct !== undefined)
    .map((card) => clampAchievement(card.achievementPct));
  const avgAchievement =
    trackedAchievements.length > 0
      ? trackedAchievements.reduce((a, b) => a + b, 0) / trackedAchievements.length
      : 0;

  // Bar color follows semantic progression while staying within theme discipline.
  let barColor: string;
  if (avgAchievement >= 100) barColor = "#10b981"; // on track
  else if (avgAchievement >= 80) barColor = "#ea580c"; // strong progress
  else if (avgAchievement >= 50) barColor = "#f97316"; // building momentum
  else if (avgAchievement >= 25) barColor = "#fb923c"; // early momentum
  else barColor = "#fdba74"; // getting started

  // Compute best overall streak
  const bestStreak = Math.max(
    ...cards.map((c) => calculateStreak(c.dailyProgress)),
    0,
  );
  const streakMsg = getStreakMessage(bestStreak);

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Target Progress
          </p>
          {bestStreak > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5">
              <Flame className="h-2.5 w-2.5 text-orange-500" />
              <span className="text-[10px] font-semibold tabular-nums text-orange-700">
                {bestStreak}d streak
              </span>
              {streakMsg && (
                <span className="text-[9px] text-orange-500">{streakMsg}</span>
              )}
            </div>
          )}
        </div>
        <p className="text-sm font-semibold tabular-nums text-slate-900">
          {avgAchievement.toFixed(1)}%
        </p>
      </div>

      <KpiMilestoneTrack
        progress={avgAchievement}
        activeColor={barColor}
        size="md"
        steps={KPI_PROGRESS_STEPS.map((step) => ({
          value: step.value,
          label: step.label,
        }))}
      />
    </div>
  );
}

/* ── Streak Badge ───────────────────────────────────────────── */

function StreakBadge({ card }: { card: KpiDashboardCard }) {
  const streak = calculateStreak(card.dailyProgress);
  const message = getStreakMessage(streak);
  if (streak === 0) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1">
      <Flame className="h-3 w-3 text-orange-500" />
      <span className="text-[11px] font-semibold tabular-nums text-orange-700">
        {streak}d streak
      </span>
      {message && (
        <span className="text-[10px] text-orange-500">{message}</span>
      )}
    </div>
  );
}

/* ── KpiProgressCard (leader/marketing dashboards) ──────────── */

interface KpiProgressCardProps {
  card: KpiDashboardCard;
}

function KpiProgressCard({ card }: KpiProgressCardProps) {
  const statusMeta = KPI_STATUS_META[card.status];
  const streak = calculateStreak(card.dailyProgress);

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {card.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5">
              <Flame className="h-2.5 w-2.5 text-orange-500" />
              <span className="text-[10px] font-semibold tabular-nums text-orange-700">
                {streak}d
              </span>
            </div>
          )}
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusMeta.badgeClass}`}
          >
            {statusMeta.label}
          </span>
        </div>
      </div>

      {/* Ring gauge + value */}
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <ReactECharts
            option={buildMiniRingOption(card)}
            style={{ height: 80, width: 80 }}
            opts={{ renderer: "svg" }}
          />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold tabular-nums text-slate-900">
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
        </div>
      </div>

      {/* Milestone timeline */}
      <MilestoneTimeline card={card} />

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>
          {formatShortDate(card.startDate)} – {formatShortDate(card.endDate)}
        </span>
        <span>{card.dailyProgress.length}d</span>
      </div>
    </div>
  );
}

/* ── KpiGaugeCard (executive dashboard) ─────────────────────── */

interface KpiGaugeCardProps {
  card: KpiDashboardCard;
}

function KpiGaugeCard({ card }: KpiGaugeCardProps) {
  const statusMeta = KPI_STATUS_META[card.status];

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {card.label}
        </p>
        <div className="flex items-center gap-1.5">
          <StreakBadge card={card} />
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.badgeClass}`}
          >
            {statusMeta.label}
          </span>
        </div>
      </div>

      <div className="mt-2.5">
        <ReactECharts
          option={buildKpiGaugeOption(card)}
          style={{ height: 240, width: "100%" }}
          opts={{ renderer: "svg" }}
        />
      </div>

    </div>
  );
}

/* ── KpiProgressSection (leader/marketing dashboards) ───────── */

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

/* ── Personal KPI Section (marketing dashboard) ─────────────── */

interface PersonalKpiSectionProps {
  title: string;
  description: string;
  cards: KpiDashboardCard[];
  loading: boolean;
  error: string;
  meta?: ReactNode;
  loadingLabel?: string;
  emptyLabel?: string;
}

export function PersonalKpiSection({
  title,
  description,
  cards,
  loading,
  error,
  meta,
  loadingLabel = "Loading KPI progress…",
  emptyLabel = "No KPI target is active for the selected date range.",
}: PersonalKpiSectionProps) {
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
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
            {cards.map((card) => (
              <KpiGaugeCard key={card.metricKey} card={card} />
            ))}
          </div>
          <CombinedProgressBar cards={cards} />
        </div>
      )}
    </DashboardSection>
  );
}

/* ── Executive KPI Section ──────────────────────────────────── */

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

type TeamLeaderboardEntry = {
  teamCode: string;
  teamName: string;
  memberCount: number;
  onTrackCount: number;
  totalCount: number;
  avgAchievement: number;
  bestStreak: number;
};

function buildTeamLeaderboard(rows: ExecutiveKpiTeamRow[]): TeamLeaderboardEntry[] {
  return rows
    .map((row) => {
      const achievements = row.cards
        .map((card) => card.achievementPct)
        .filter((value): value is number => value !== null && value !== undefined);
      const avgAchievement =
        achievements.length > 0
          ? achievements.reduce((sum, value) => sum + value, 0) / achievements.length
          : 0;
      const onTrackCount = row.cards.filter(
        (card) => card.status === "ON_TRACK",
      ).length;
      const bestStreak = Math.max(
        ...row.cards.map((card) => calculateStreak(card.dailyProgress)),
        0,
      );

      return {
        teamCode: row.teamCode,
        teamName: row.teamName,
        memberCount: row.members.length,
        onTrackCount,
        totalCount: row.cards.length,
        avgAchievement,
        bestStreak,
      };
    })
    .sort((a, b) => {
      if (b.onTrackCount !== a.onTrackCount) return b.onTrackCount - a.onTrackCount;
      if (b.avgAchievement !== a.avgAchievement) {
        return b.avgAchievement - a.avgAchievement;
      }
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      return a.teamName.localeCompare(b.teamName);
    });
}

interface TeamKpiRowProps {
  row: ExecutiveKpiTeamRow;
  rank?: number;
}

type TeamKpiTab = "team" | "member";

function MemberMetricPanel({
  label,
  card,
}: {
  label: string;
  card?: KpiDashboardCard;
}) {
  const statusMeta = KPI_STATUS_META[card?.status || "NO_TARGET"];
  const progressWidth = clampAchievement(card?.achievementPct);
  const streak = card ? calculateStreak(card.dailyProgress) : 0;

  return (
    <div className="space-y-1.5 rounded-md border border-slate-100 bg-white p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span
          className={`inline-flex rounded-full border px-1.5 py-px text-[10px] font-semibold ${statusMeta.badgeClass}`}
        >
          {statusMeta.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold tabular-nums text-slate-900">
          {card ? formatKpiValue(card.actualValue, card.format) : "—"}
        </span>
        <span className="text-[11px] tabular-nums text-slate-400">
          /{" "}
          {card?.targetValue != null
            ? formatKpiValue(card.targetValue, card.format)
            : "—"}
        </span>
        {streak > 0 && (
          <span className="ml-auto flex items-center gap-0.5 text-[10px] text-orange-600">
            <Flame className="h-2 w-2" />
            {streak}d
          </span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${statusMeta.progressClass}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  );
}

function MemberKpiCard({ member }: { member: ExecutiveKpiMemberRow }) {
  const creativeCard = getMemberMetricCard(member, "USER_CREATIVES_CREATED");
  const arCard = getMemberMetricCard(member, "USER_AR_PCT");

  return (
    <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-900">{member.name}</p>
          <p className="max-w-[220px] truncate text-[11px] text-slate-400">
            {member.employeeId || member.email}
          </p>
        </div>
        {member.currentCategory ? (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            {formatCategoryBadge(member.currentCategory)}
          </span>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <MemberMetricPanel label="Creatives" card={creativeCard} />
        <MemberMetricPanel label="AR" card={arCard} />
      </div>
    </div>
  );
}

function TeamKpiRow({ row, rank }: TeamKpiRowProps) {
  const [activeTab, setActiveTab] = useState<TeamKpiTab>("team");
  const medalTone =
    rank === 1
      ? "text-amber-500"
      : rank === 2
        ? "text-slate-400"
        : rank === 3
          ? "text-orange-500"
          : "text-slate-500";

  return (
    <div className="space-y-3 rounded-lg border border-slate-100 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            {row.teamName}
          </h3>
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            {row.teamCode}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {typeof rank === "number" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              <Medal className={`h-3.5 w-3.5 ${medalTone}`} />
              #{rank}
            </span>
          )}
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {row.members.length} member
            {row.members.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <DashboardTabs
        value={activeTab}
        onValueChange={setActiveTab}
        items={[
          {
            value: "team",
            label: "Team KPI",
            icon: <Target className="h-3.5 w-3.5" />,
          },
          {
            value: "member",
            label: "Member KPI",
            icon: <Users className="h-3.5 w-3.5" />,
            badge: row.members.length,
          },
        ]}
      />

      {activeTab === "team" ? (
        <>
          <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
            {row.cards.map((card) => (
              <KpiGaugeCard key={card.metricKey} card={card} />
            ))}
          </div>
          <CombinedProgressBar cards={row.cards} />
        </>
      ) : row.members.length > 0 ? (
        <div className="space-y-2.5">
          {row.members.map((member) => (
            <MemberKpiCard key={member.userId} member={member} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          No member KPI data for this team.
        </div>
      )}
    </div>
  );
}

export function ExecutiveKpiSection({
  data,
  loading,
  error,
}: ExecutiveKpiSectionProps) {
  const leaderboard = data ? buildTeamLeaderboard(data.rows) : [];
  const rowsByCode = new Map((data?.rows || []).map((row) => [row.teamCode, row]));
  const rankedRows = leaderboard
    .map((entry) => rowsByCode.get(entry.teamCode))
    .filter((row): row is ExecutiveKpiTeamRow => Boolean(row));

  return (
    <DashboardSection
      title="Marketing KPI Overview"
      icon={<Target className="h-3.5 w-3.5 text-orange-500" />}
      contentClassName="space-y-3"
      headerClassName="px-3 py-2.5"
      titleClassName="text-[11px] tracking-[0.18em]"
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
          {rankedRows.map((row, index) => (
            <TeamKpiRow
              key={row.teamCode}
              row={row}
              rank={index + 1}
            />
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

/* ── TeamKpiSection (leader dashboard reuse) ────────────────── */

interface TeamKpiSectionProps {
  data: MarketingKpiTeamDashboardResponse | null;
  loading: boolean;
  error: string;
}

export function TeamKpiSection({ data, loading, error }: TeamKpiSectionProps) {
  const row: ExecutiveKpiTeamRow | null = data
    ? {
        teamCode: data.selected.teamCode || "TEAM",
        teamName:
          data.selected.teamName || data.selected.teamCode || "Team KPI",
        cards: data.cards || [],
        members: data.members || [],
      }
    : null;

  return (
    <DashboardSection
      title="Marketing KPI Overview"
      icon={<Target className="h-3.5 w-3.5 text-orange-500" />}
      contentClassName="space-y-3"
      headerClassName="px-3 py-2.5"
      titleClassName="text-[11px] tracking-[0.18em]"
    >
      {loading ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Loading team KPI progress…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
          {error}
        </div>
      ) : !row ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No team KPI data available.
        </div>
      ) : (
        <TeamKpiRow row={row} />
      )}
    </DashboardSection>
  );
}
