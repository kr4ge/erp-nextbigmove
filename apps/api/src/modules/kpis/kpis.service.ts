import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  MarketingKpiCategory,
  MarketingKpiMetricKey,
  MarketingKpiScopeType,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { TeamContextService } from "../../common/services/team-context.service";
import { CreateMarketingCategoryTargetDto } from "./dto/create-marketing-category-target.dto";
import { CreateMarketingTeamTargetDto } from "./dto/create-marketing-team-target.dto";
import { CreateMarketingUserCategoryAssignmentDto } from "./dto/create-marketing-user-category-assignment.dto";
import { CreateMarketingUserTargetDto } from "./dto/create-marketing-user-target.dto";

type TeamOption = {
  id: string;
  name: string;
  teamCode: string;
};

type DailyProgressPoint = {
  date: string;
  actualValue: number;
  achievementPct: number | null;
};

type DashboardCard = {
  metricKey: MarketingKpiMetricKey;
  label: string;
  targetValue: number | null;
  actualValue: number;
  achievementPct: number | null;
  status: "ON_TRACK" | "AT_RISK" | "MISSED" | "NO_TARGET";
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  format: "currency" | "percent" | "number";
  startDate: string;
  endDate: string;
  dailyProgress: DailyProgressPoint[];
};

type TeamMetricSeries = {
  [MarketingKpiMetricKey.TEAM_AD_SPEND]: number;
  [MarketingKpiMetricKey.TEAM_AR_PCT]: number;
};

type UserMetricSeries = {
  [MarketingKpiMetricKey.USER_CREATIVES_CREATED]: number;
  [MarketingKpiMetricKey.USER_AR_PCT]: number;
};

const TEAM_METRICS = [
  MarketingKpiMetricKey.TEAM_AD_SPEND,
  MarketingKpiMetricKey.TEAM_AR_PCT,
] as const;

const USER_METRICS = [
  MarketingKpiMetricKey.USER_CREATIVES_CREATED,
  MarketingKpiMetricKey.USER_AR_PCT,
] as const;

const AR_METRICS = new Set<MarketingKpiMetricKey>([
  MarketingKpiMetricKey.TEAM_AR_PCT,
  MarketingKpiMetricKey.USER_AR_PCT,
]);

const ADDITIVE_TARGET_METRICS = new Set<MarketingKpiMetricKey>([
  MarketingKpiMetricKey.TEAM_AD_SPEND,
  MarketingKpiMetricKey.USER_CREATIVES_CREATED,
]);

const METRIC_LABELS: Record<MarketingKpiMetricKey, string> = {
  [MarketingKpiMetricKey.TEAM_AD_SPEND]: "Ad Spend",
  [MarketingKpiMetricKey.TEAM_AR_PCT]: "AR%",
  [MarketingKpiMetricKey.USER_CREATIVES_CREATED]: "Creative Created",
  [MarketingKpiMetricKey.USER_AR_PCT]: "AR%",
};

const METRIC_DIRECTIONS: Record<
  MarketingKpiMetricKey,
  "HIGHER_IS_BETTER" | "LOWER_IS_BETTER"
> = {
  [MarketingKpiMetricKey.TEAM_AD_SPEND]: "HIGHER_IS_BETTER",
  [MarketingKpiMetricKey.TEAM_AR_PCT]: "LOWER_IS_BETTER",
  [MarketingKpiMetricKey.USER_CREATIVES_CREATED]: "HIGHER_IS_BETTER",
  [MarketingKpiMetricKey.USER_AR_PCT]: "LOWER_IS_BETTER",
};

const METRIC_FORMATS: Record<
  MarketingKpiMetricKey,
  "currency" | "percent" | "number"
> = {
  [MarketingKpiMetricKey.TEAM_AD_SPEND]: "currency",
  [MarketingKpiMetricKey.TEAM_AR_PCT]: "percent",
  [MarketingKpiMetricKey.USER_CREATIVES_CREATED]: "number",
  [MarketingKpiMetricKey.USER_AR_PCT]: "percent",
};

type TeamUserSummary = {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
  firstName: string | null;
  lastName: string | null;
  currentCategory: MarketingKpiCategory | null;
};

@Injectable()
export class KpisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamContext: TeamContextService,
  ) {}

  private toNumber(value: unknown): number {
    const numeric =
      typeof value === "string" ? Number.parseFloat(value) : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private normalize(value: string | null | undefined): string {
    return (value || "").trim().toLowerCase();
  }

  private buildUserDisplayName(user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  }): string {
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    return fullName || user.email;
  }

  private parseDate(value?: string, fallback?: string): Date {
    const candidate = (value || fallback || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      throw new BadRequestException("Date must use YYYY-MM-DD format");
    }

    const parsed = new Date(`${candidate}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Invalid date supplied");
    }
    return parsed;
  }

  private formatDate(value: Date | null | undefined): string | null {
    if (!value) return null;
    return value.toISOString().slice(0, 10);
  }

  private previousDate(value: Date): Date {
    const next = new Date(value);
    next.setUTCDate(next.getUTCDate() - 1);
    return next;
  }

  private buildDateRange(startDate?: string, endDate?: string) {
    const today = new Date().toISOString().slice(0, 10);
    const start = this.parseDate(startDate, today);
    const end = this.parseDate(endDate, this.formatDate(start) || today);
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException(
        "start_date must be before or equal to end_date",
      );
    }

    return {
      start,
      end,
      startDate: this.formatDate(start)!,
      endDate: this.formatDate(end)!,
      referenceDate: end,
      startDateTime: new Date(`${this.formatDate(start)}T00:00:00.000Z`),
      endDateTime: new Date(`${this.formatDate(end)}T23:59:59.999Z`),
    };
  }

  private buildDateKeys(start: Date, end: Date): string[] {
    const values: string[] = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      values.push(this.formatDate(cursor)!);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return values;
  }

  private computeAchievementPct(
    metricKey: MarketingKpiMetricKey,
    targetValue: number | null,
    actualValue: number,
  ): number | null {
    if (targetValue === null) {
      return null;
    }

    // AR = 0 means no measurable value yet; avoid classifying it as "on track".
    if (AR_METRICS.has(metricKey) && actualValue <= 0) {
      return null;
    }

    const direction = METRIC_DIRECTIONS[metricKey];
    if (direction === "LOWER_IS_BETTER") {
      if (actualValue <= targetValue) {
        return 100;
      }
      if (targetValue <= 0 || actualValue <= 0) {
        return 0;
      }
      return Math.max(0, Math.min((targetValue / actualValue) * 100, 100));
    }

    if (targetValue <= 0) {
      return actualValue > 0 ? 100 : 0;
    }

    return Math.max(0, Math.min((actualValue / targetValue) * 100, 100));
  }

  private buildStatus(
    achievementPct: number | null,
  ): "ON_TRACK" | "AT_RISK" | "MISSED" | "NO_TARGET" {
    if (achievementPct === null) return "NO_TARGET";
    if (achievementPct >= 100) return "ON_TRACK";
    if (achievementPct >= 80) return "AT_RISK";
    return "MISSED";
  }

  private buildAssociateKeysForUser(user: {
    employeeId: string | null;
    firstName: string | null;
    lastName: string | null;
  }): string[] {
    const keys = new Set<string>();
    if (user.employeeId?.trim()) {
      keys.add(this.normalize(user.employeeId));
    }
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    if (fullName) {
      keys.add(this.normalize(fullName));
    }
    return Array.from(keys).filter(Boolean);
  }

  private async getAccessibleTeams() {
    const context = await this.teamContext.getContext();
    const where = context.isAdmin
      ? {
          tenantId: context.tenantId,
          status: "ACTIVE" as const,
          teamCode: { not: null },
        }
      : {
          tenantId: context.tenantId,
          status: "ACTIVE" as const,
          id: { in: context.userTeams },
          teamCode: { not: null },
        };

    const teams = await this.prisma.team.findMany({
      where,
      select: {
        id: true,
        name: true,
        teamCode: true,
      },
      orderBy: { name: "asc" },
    });

    return {
      context,
      teams: teams
        .filter((team) => Boolean(team.teamCode))
        .map((team) => ({
          id: team.id,
          name: team.name,
          teamCode: team.teamCode!,
        })),
    };
  }

  private async resolveTeamSelection(teamCode?: string | null) {
    const { context, teams } = await this.getAccessibleTeams();

    if (teams.length === 0) {
      return { context, teams, selectedTeam: null as TeamOption | null };
    }

    let selectedTeam: TeamOption | null = null;
    const normalizedRequestedCode = this.normalize(teamCode);

    if (normalizedRequestedCode) {
      selectedTeam =
        teams.find(
          (team) => this.normalize(team.teamCode) === normalizedRequestedCode,
        ) || null;
      if (!selectedTeam) {
        throw new ForbiddenException(
          "You do not have access to the requested teamCode",
        );
      }
    }

    if (!selectedTeam && context.teamId) {
      selectedTeam = teams.find((team) => team.id === context.teamId) || null;
    }

    if (!selectedTeam) {
      selectedTeam = teams[0] || null;
    }

    return { context, teams, selectedTeam };
  }

  private async getEffectiveAccessMaps(
    tenantId: string,
    teamId: string,
    userIds: string[],
  ) {
    const permissionMap = new Map<string, Set<string>>();
    const roleKeyMap = new Map<string, Set<string>>();

    userIds.forEach((userId) => {
      permissionMap.set(userId, new Set<string>());
      roleKeyMap.set(userId, new Set<string>());
    });

    const [tenantRoles, teamRoles, tenantPerms, teamPerms] = await Promise.all([
      this.prisma.userRoleAssignment.findMany({
        where: { tenantId, userId: { in: userIds }, teamId: null },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      }),
      this.prisma.userRoleAssignment.findMany({
        where: { tenantId, userId: { in: userIds }, teamId },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      }),
      this.prisma.userPermissionAssignment.findMany({
        where: { tenantId, userId: { in: userIds }, teamId: null },
        include: { permission: true },
      }),
      this.prisma.userPermissionAssignment.findMany({
        where: { tenantId, userId: { in: userIds }, teamId },
        include: { permission: true },
      }),
    ]);

    [...tenantRoles, ...teamRoles].forEach((assignment) => {
      const permissionSet =
        permissionMap.get(assignment.userId) || new Set<string>();
      const roleSet = roleKeyMap.get(assignment.userId) || new Set<string>();
      roleSet.add(assignment.role.key);
      assignment.role.rolePermissions.forEach((rolePermission) => {
        permissionSet.add(rolePermission.permission.key);
      });
      permissionMap.set(assignment.userId, permissionSet);
      roleKeyMap.set(assignment.userId, roleSet);
    });

    [...tenantPerms, ...teamPerms].forEach((assignment) => {
      const permissionSet =
        permissionMap.get(assignment.userId) || new Set<string>();
      if (assignment.allow) {
        permissionSet.add(assignment.permission.key);
      } else {
        permissionSet.delete(assignment.permission.key);
      }
      permissionMap.set(assignment.userId, permissionSet);
    });

    return { permissionMap, roleKeyMap };
  }

  private isOperationalMarketingUser(
    permissionSet: Set<string>,
    roleSet: Set<string>,
  ) {
    const blockingPermissions = [
      "dashboard.marketing_leader",
      "dashboard.executives",
      "kpi.marketing.manage",
      "team.manage",
      "permission.assign",
    ];
    const hasBlockingPermission = blockingPermissions.some((key) =>
      permissionSet.has(key),
    );
    const hasBlockingRole = ["TENANT_ADMIN", "TEAM_LEAD"].some((key) =>
      roleSet.has(key),
    );
    const hasMarketingSignal =
      permissionSet.has("dashboard.marketing") ||
      permissionSet.has("kpi.marketing.read") ||
      roleSet.has("MARKETING");

    return hasMarketingSignal && !hasBlockingPermission && !hasBlockingRole;
  }

  private async listEligibleUsersForTeam(
    tenantId: string,
    teamId: string,
    teamCode: string,
    referenceDate: Date,
  ) {
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        tenantId,
        teamId,
        status: "ACTIVE",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            status: true,
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    const userIds = memberships.map((membership) => membership.userId);
    if (userIds.length === 0) {
      return [];
    }

    const { permissionMap, roleKeyMap } = await this.getEffectiveAccessMaps(
      tenantId,
      teamId,
      userIds,
    );
    const activeAssignments =
      await this.prisma.marketingKpiUserCategoryAssignment.findMany({
        where: {
          tenantId,
          teamCode,
          userId: { in: userIds },
          startDate: { lte: referenceDate },
          OR: [{ endDate: null }, { endDate: { gte: referenceDate } }],
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      });

    const currentCategoryMap = new Map<string, MarketingKpiCategory>();
    activeAssignments.forEach((assignment) => {
      if (!currentCategoryMap.has(assignment.userId)) {
        currentCategoryMap.set(assignment.userId, assignment.category);
      }
    });

    return memberships
      .filter((membership) => {
        const permissionSet =
          permissionMap.get(membership.userId) || new Set<string>();
        const roleSet = roleKeyMap.get(membership.userId) || new Set<string>();
        return this.isOperationalMarketingUser(permissionSet, roleSet);
      })
      .map((membership) => ({
        id: membership.user.id,
        name: this.buildUserDisplayName(membership.user),
        email: membership.user.email,
        employeeId: membership.user.employeeId,
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        currentCategory: currentCategoryMap.get(membership.userId) || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private async ensureOperationalTeamUser(
    tenantId: string,
    teamId: string,
    teamCode: string,
    userId: string,
    referenceDate: Date,
  ) {
    const eligibleUsers = await this.listEligibleUsersForTeam(
      tenantId,
      teamId,
      teamCode,
      referenceDate,
    );
    const matched = eligibleUsers.find((user) => user.id === userId);
    if (!matched) {
      throw new BadRequestException(
        "Target user must be an operational marketing user in the selected team",
      );
    }
    return matched;
  }

  private serializeTarget(
    row: {
      id: string;
      scopeType: MarketingKpiScopeType;
      teamCode: string;
      userId: string | null;
      category: MarketingKpiCategory | null;
      metricKey: MarketingKpiMetricKey;
      targetValue: unknown;
      startDate: Date;
      endDate: Date | null;
      createdAt: Date;
    },
    userMap: Map<string, TeamUserSummary>,
  ) {
    return {
      id: row.id,
      scopeType: row.scopeType,
      teamCode: row.teamCode,
      userId: row.userId,
      userName: row.userId ? userMap.get(row.userId)?.name || row.userId : null,
      category: row.category,
      metricKey: row.metricKey,
      label: METRIC_LABELS[row.metricKey],
      direction: METRIC_DIRECTIONS[row.metricKey],
      format: METRIC_FORMATS[row.metricKey],
      targetValue: this.toNumber(row.targetValue),
      startDate: this.formatDate(row.startDate),
      endDate: this.formatDate(row.endDate),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async getTargetRowsOverlappingRange(params: {
    tenantId: string;
    teamCode: string;
    scopeType: MarketingKpiScopeType;
    metricKeys: readonly MarketingKpiMetricKey[];
    start: Date;
    end: Date;
    userId?: string;
    category?: MarketingKpiCategory;
  }) {
    return this.prisma.marketingKpiTarget.findMany({
      where: {
        tenantId: params.tenantId,
        teamCode: params.teamCode,
        scopeType: params.scopeType,
        metricKey: { in: [...params.metricKeys] },
        ...(params.userId !== undefined ? { userId: params.userId } : {}),
        ...(params.category !== undefined ? { category: params.category } : {}),
        startDate: { lte: params.end },
        OR: [{ endDate: null }, { endDate: { gte: params.start } }],
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
  }

  private buildDailyTargetByMetric(
    metricKeys: readonly MarketingKpiMetricKey[],
    dateKeys: string[],
    targetRows: Array<{
      metricKey: MarketingKpiMetricKey;
      targetValue: unknown;
      startDate: Date;
      endDate: Date | null;
    }>,
  ) {
    const dateObjects = new Map<string, Date>(
      dateKeys.map((dateKey) => [
        dateKey,
        new Date(`${dateKey}T00:00:00.000Z`),
      ]),
    );
    const result = new Map<MarketingKpiMetricKey, Map<string, number | null>>();

    metricKeys.forEach((metricKey) => {
      const rowsForMetric = targetRows.filter(
        (row) => row.metricKey === metricKey,
      );
      const perDateTarget = new Map<string, number | null>();

      dateKeys.forEach((dateKey) => {
        const dateObject = dateObjects.get(dateKey)!;
        const matchedRow = rowsForMetric.find((row) => {
          const startsOnOrBefore =
            row.startDate.getTime() <= dateObject.getTime();
          const endsOnOrAfter =
            !row.endDate || row.endDate.getTime() >= dateObject.getTime();
          return startsOnOrBefore && endsOnOrAfter;
        });
        perDateTarget.set(
          dateKey,
          matchedRow ? this.toNumber(matchedRow.targetValue) : null,
        );
      });

      result.set(metricKey, perDateTarget);
    });

    return result;
  }

  private mergeDailyTargetsByPriority(
    metricKeys: readonly MarketingKpiMetricKey[],
    dateKeys: string[],
    primaryTargets: Map<MarketingKpiMetricKey, Map<string, number | null>>,
    fallbackTargets: Map<MarketingKpiMetricKey, Map<string, number | null>>,
  ) {
    const result = new Map<MarketingKpiMetricKey, Map<string, number | null>>();

    metricKeys.forEach((metricKey) => {
      const merged = new Map<string, number | null>();
      const primaryMap = primaryTargets.get(metricKey);
      const fallbackMap = fallbackTargets.get(metricKey);

      dateKeys.forEach((dateKey) => {
        const primaryValue = primaryMap?.get(dateKey);
        const fallbackValue = fallbackMap?.get(dateKey);
        merged.set(
          dateKey,
          primaryValue !== null && primaryValue !== undefined
            ? primaryValue
            : (fallbackValue ?? null),
        );
      });

      result.set(metricKey, merged);
    });

    return result;
  }

  private computeRangeTarget(
    metricKey: MarketingKpiMetricKey,
    dateKeys: string[],
    dailyTargetByDate: Map<string, number | null> | undefined,
  ): number | null {
    if (!dailyTargetByDate) return null;

    const values = dateKeys
      .map((dateKey) => dailyTargetByDate.get(dateKey))
      .filter(
        (value): value is number => value !== null && value !== undefined,
      );

    if (values.length === 0) return null;

    if (ADDITIVE_TARGET_METRICS.has(metricKey)) {
      return values.reduce((sum, value) => sum + value, 0);
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private async getCurrentCategoryAssignment(
    tenantId: string,
    teamCode: string,
    userId: string,
    referenceDate: Date,
  ) {
    const activeAssignment =
      await this.prisma.marketingKpiUserCategoryAssignment.findFirst({
        where: {
          tenantId,
          teamCode,
          userId,
          startDate: { lte: referenceDate },
          OR: [{ endDate: null }, { endDate: { gte: referenceDate } }],
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      });

    if (activeAssignment) {
      return activeAssignment;
    }

    // User category assignment no longer accepts date input.
    // Fallback to the latest assignment so historical KPI targets can still resolve by category template dates.
    return this.prisma.marketingKpiUserCategoryAssignment.findFirst({
      where: {
        tenantId,
        teamCode,
        userId,
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
  }

  private computeTeamMetricsFromRows(
    rows: Array<{
      spend: unknown;
      codPos: unknown;
      canceledCodPos: unknown;
      restockingCodPos: unknown;
      abandonedCodPos: unknown;
    }>,
  ): TeamMetricSeries {
    const spend = rows.reduce((sum, row) => sum + this.toNumber(row.spend), 0);
    const revenueRaw = rows.reduce(
      (sum, row) => sum + this.toNumber(row.codPos),
      0,
    );
    const canceledCod = rows.reduce(
      (sum, row) => sum + this.toNumber(row.canceledCodPos),
      0,
    );
    const restockingCod = rows.reduce(
      (sum, row) => sum + this.toNumber(row.restockingCodPos),
      0,
    );
    const abandonedCod = rows.reduce(
      (sum, row) => sum + this.toNumber(row.abandonedCodPos),
      0,
    );
    const revenue = Math.max(
      0,
      revenueRaw - canceledCod - restockingCod - abandonedCod,
    );
    const ar = revenue > 0 ? (spend / revenue) * 100 : 0;

    return {
      [MarketingKpiMetricKey.TEAM_AD_SPEND]: spend,
      [MarketingKpiMetricKey.TEAM_AR_PCT]: ar,
    };
  }

  private async computeTeamMetricsForRange(
    tenantId: string,
    teamCode: string,
    start: Date,
    end: Date,
  ) {
    const rows = await this.prisma.reconcileMarketing.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
      },
      select: {
        date: true,
        teamCode: true,
        spend: true,
        codPos: true,
        canceledCodPos: true,
        restockingCodPos: true,
        abandonedCodPos: true,
      },
    });

    const normalizedTeamCode = this.normalize(teamCode);
    const filteredRows = rows.filter(
      (row) => this.normalize(row.teamCode) === normalizedTeamCode,
    );
    const totals = this.computeTeamMetricsFromRows(filteredRows);
    const dateKeys = this.buildDateKeys(start, end);
    const rowsByDate = new Map<string, typeof filteredRows>();

    filteredRows.forEach((row) => {
      const key = this.formatDate(row.date)!;
      const bucket = rowsByDate.get(key) || [];
      bucket.push(row);
      rowsByDate.set(key, bucket);
    });

    const dailyProgress = dateKeys.reduce<
      Record<(typeof TEAM_METRICS)[number], DailyProgressPoint[]>
    >(
      (acc, dateKey) => {
        const rowsForDate = rowsByDate.get(dateKey) || [];
        const metrics = this.computeTeamMetricsFromRows(rowsForDate);
        acc[MarketingKpiMetricKey.TEAM_AD_SPEND].push({
          date: dateKey,
          actualValue: metrics[MarketingKpiMetricKey.TEAM_AD_SPEND],
          achievementPct: null,
        });
        acc[MarketingKpiMetricKey.TEAM_AR_PCT].push({
          date: dateKey,
          actualValue: metrics[MarketingKpiMetricKey.TEAM_AR_PCT],
          achievementPct: null,
        });
        return acc;
      },
      {
        [MarketingKpiMetricKey.TEAM_AD_SPEND]: [],
        [MarketingKpiMetricKey.TEAM_AR_PCT]: [],
      },
    );

    return { totals, dailyProgress };
  }

  private async computeUserMetricsForRange(
    tenantId: string,
    teamCode: string,
    user: {
      employeeId: string | null;
      firstName: string | null;
      lastName: string | null;
    },
    start: Date,
    end: Date,
  ) {
    const associateKeys = this.buildAssociateKeysForUser(user);
    const dateKeys = this.buildDateKeys(start, end);
    if (associateKeys.length === 0) {
      return {
        totals: {
          [MarketingKpiMetricKey.USER_CREATIVES_CREATED]: 0,
          [MarketingKpiMetricKey.USER_AR_PCT]: 0,
        } as UserMetricSeries,
        dailyProgress: {
          [MarketingKpiMetricKey.USER_CREATIVES_CREATED]: dateKeys.map(
            (date) => ({
              date,
              actualValue: 0,
              achievementPct: null,
            }),
          ),
          [MarketingKpiMetricKey.USER_AR_PCT]: dateKeys.map((date) => ({
            date,
            actualValue: 0,
            achievementPct: null,
          })),
        } as Record<MarketingKpiMetricKey, DailyProgressPoint[]>,
      };
    }

    const matchingRows = await this.prisma.reconcileMarketing.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
        OR: associateKeys.map((key) => ({
          marketingAssociate: { equals: key, mode: "insensitive" as const },
        })),
      },
      select: {
        date: true,
        teamCode: true,
        spend: true,
        codPos: true,
        canceledCodPos: true,
        restockingCodPos: true,
        abandonedCodPos: true,
      },
    });

    const normalizedTeamCode = this.normalize(teamCode);
    const filteredRows = matchingRows.filter(
      (row) => this.normalize(row.teamCode) === normalizedTeamCode,
    );
    const arMetrics = this.computeTeamMetricsFromRows(filteredRows);

    const createdRows = await this.prisma.reconcileMarketing.findMany({
      where: {
        tenantId,
        dateCreated: {
          gte: start,
          lte: new Date(`${this.formatDate(end)}T23:59:59.999Z`),
        },
        OR: associateKeys.map((key) => ({
          marketingAssociate: { equals: key, mode: "insensitive" as const },
        })),
      },
      select: {
        adId: true,
        dateCreated: true,
      },
    });

    const filteredCreatedRows = createdRows.filter(
      (row) =>
        row.adId &&
        row.dateCreated,
    );
    const creativeIds = new Set(
      filteredCreatedRows.map((row) => row.adId).filter(Boolean),
    );

    const rowsByDate = new Map<string, typeof filteredRows>();
    filteredRows.forEach((row) => {
      const key = this.formatDate(row.date)!;
      const bucket = rowsByDate.get(key) || [];
      bucket.push(row);
      rowsByDate.set(key, bucket);
    });

    const creativeSetsByDate = new Map<string, Set<string>>();
    filteredCreatedRows.forEach((row) => {
      const key = row.dateCreated
        ? row.dateCreated.toISOString().slice(0, 10)
        : null;
      if (!key || !row.adId) return;
      if (!creativeSetsByDate.has(key)) {
        creativeSetsByDate.set(key, new Set<string>());
      }
      creativeSetsByDate.get(key)!.add(row.adId);
    });

    return {
      totals: {
        [MarketingKpiMetricKey.USER_CREATIVES_CREATED]: creativeIds.size,
        [MarketingKpiMetricKey.USER_AR_PCT]:
          arMetrics[MarketingKpiMetricKey.TEAM_AR_PCT],
      } as UserMetricSeries,
      dailyProgress: {
        [MarketingKpiMetricKey.USER_CREATIVES_CREATED]: dateKeys.map(
          (date) => ({
            date,
            actualValue: creativeSetsByDate.get(date)?.size || 0,
            achievementPct: null,
          }),
        ),
        [MarketingKpiMetricKey.USER_AR_PCT]: dateKeys.map((date) => ({
          date,
          actualValue: this.computeTeamMetricsFromRows(
            rowsByDate.get(date) || [],
          )[MarketingKpiMetricKey.TEAM_AR_PCT],
          achievementPct: null,
        })),
      } as Record<MarketingKpiMetricKey, DailyProgressPoint[]>,
    };
  }

  private buildDashboardCard(
    metricKey: MarketingKpiMetricKey,
    targetValue: number | null,
    actualValue: number,
    dailyProgress: DailyProgressPoint[],
    startDate: string,
    endDate: string,
    dailyTargetByDate?: Map<string, number | null>,
  ): DashboardCard {
    const achievementPct = this.computeAchievementPct(
      metricKey,
      targetValue,
      actualValue,
    );
    return {
      metricKey,
      label: METRIC_LABELS[metricKey],
      targetValue,
      actualValue,
      achievementPct,
      status: this.buildStatus(achievementPct),
      direction: METRIC_DIRECTIONS[metricKey],
      format: METRIC_FORMATS[metricKey],
      startDate,
      endDate,
      dailyProgress: dailyProgress.map((point) => ({
        ...point,
        achievementPct: this.computeAchievementPct(
          metricKey,
          dailyTargetByDate?.get(point.date) ?? targetValue,
          point.actualValue,
        ),
      })),
    };
  }

  private async buildExecutiveMemberRow(params: {
    tenantId: string;
    teamCode: string;
    user: TeamUserSummary;
    start: Date;
    end: Date;
    startDate: string;
    endDate: string;
    dateKeys: string[];
    userTargetRows: Array<{
      metricKey: MarketingKpiMetricKey;
      targetValue: unknown;
      startDate: Date;
      endDate: Date | null;
    }>;
    categoryTargetRows: Array<{
      metricKey: MarketingKpiMetricKey;
      targetValue: unknown;
      startDate: Date;
      endDate: Date | null;
    }>;
  }) {
    const actuals = await this.computeUserMetricsForRange(
      params.tenantId,
      params.teamCode,
      params.user,
      params.start,
      params.end,
    );
    const userDailyTargets = this.buildDailyTargetByMetric(
      USER_METRICS,
      params.dateKeys,
      params.userTargetRows,
    );
    const categoryDailyTargets = this.buildDailyTargetByMetric(
      USER_METRICS,
      params.dateKeys,
      params.categoryTargetRows,
    );
    const effectiveDailyTargets = this.mergeDailyTargetsByPriority(
      USER_METRICS,
      params.dateKeys,
      userDailyTargets,
      categoryDailyTargets,
    );

    return {
      userId: params.user.id,
      name: params.user.name,
      email: params.user.email,
      employeeId: params.user.employeeId,
      currentCategory: params.user.currentCategory,
      cards: USER_METRICS.map((metricKey) => {
        const targetByDate = effectiveDailyTargets.get(metricKey);
        return this.buildDashboardCard(
          metricKey,
          this.computeRangeTarget(metricKey, params.dateKeys, targetByDate),
          actuals.totals[metricKey],
          actuals.dailyProgress[metricKey],
          params.startDate,
          params.endDate,
          targetByDate,
        );
      }),
    };
  }

  async getOverview(params: {
    teamCode?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { start, end, startDate, endDate, referenceDate } =
      this.buildDateRange(params.startDate, params.endDate);
    const { context, teams, selectedTeam } = await this.resolveTeamSelection(
      params.teamCode,
    );
    if (!selectedTeam) {
      return {
        selected: { startDate, endDate, teamCode: null, teamId: null },
        teamOptions: [],
        categories: Object.values(MarketingKpiCategory),
        teamTargets: [],
        categoryTargets: [],
        userCategoryAssignments: [],
        userTargets: [],
        eligibleUsers: [],
      };
    }

    const overlapWhere = {
      tenantId: context.tenantId,
      teamCode: selectedTeam.teamCode,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    };

    const [targetRows, assignmentRows, eligibleUsers] = await Promise.all([
      this.prisma.marketingKpiTarget.findMany({
        where: overlapWhere,
        orderBy: [
          { scopeType: "asc" },
          { startDate: "desc" },
          { createdAt: "desc" },
        ],
      }),
      this.prisma.marketingKpiUserCategoryAssignment.findMany({
        where: overlapWhere,
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      }),
      this.listEligibleUsersForTeam(
        context.tenantId,
        selectedTeam.id,
        selectedTeam.teamCode,
        referenceDate,
      ),
    ]);

    const allUserIds = Array.from(
      new Set(
        [
          ...targetRows.map((row) => row.userId),
          ...assignmentRows.map((row) => row.userId),
        ].filter(Boolean) as string[],
      ),
    );

    const userMap = new Map<string, TeamUserSummary>(
      eligibleUsers.map((user) => [user.id, user]),
    );

    if (allUserIds.length > 0) {
      const missingUserIds = allUserIds.filter(
        (userId) => !userMap.has(userId),
      );
      if (missingUserIds.length > 0) {
        const users = await this.prisma.user.findMany({
          where: { tenantId: context.tenantId, id: { in: missingUserIds } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        });
        users.forEach((user) => {
          userMap.set(user.id, {
            id: user.id,
            name: this.buildUserDisplayName(user),
            email: user.email,
            employeeId: user.employeeId,
            firstName: user.firstName,
            lastName: user.lastName,
            currentCategory: null,
          });
        });
      }
    }

    return {
      selected: {
        startDate,
        endDate,
        teamCode: selectedTeam.teamCode,
        teamId: selectedTeam.id,
      },
      teamOptions: teams,
      categories: Object.values(MarketingKpiCategory),
      teamTargets: targetRows
        .filter((row) => row.scopeType === MarketingKpiScopeType.TEAM)
        .map((row) => this.serializeTarget(row, userMap)),
      categoryTargets: targetRows
        .filter((row) => row.scopeType === MarketingKpiScopeType.CATEGORY)
        .map((row) => this.serializeTarget(row, userMap)),
      userTargets: targetRows
        .filter((row) => row.scopeType === MarketingKpiScopeType.USER)
        .map((row) => this.serializeTarget(row, userMap)),
      userCategoryAssignments: assignmentRows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: userMap.get(row.userId)?.name || row.userId,
        category: row.category,
        startDate: this.formatDate(row.startDate),
        endDate: this.formatDate(row.endDate),
        createdAt: row.createdAt.toISOString(),
      })),
      eligibleUsers,
    };
  }

  async createTeamTargets(dto: CreateMarketingTeamTargetDto, actor: any) {
    const { context } = await this.getAccessibleTeams();
    if (!context.isAdmin) {
      throw new ForbiddenException(
        "Only tenant-wide managers can assign team KPI targets",
      );
    }

    const { selectedTeam } = await this.resolveTeamSelection(dto.teamCode);
    if (!selectedTeam) {
      throw new NotFoundException("Team not found");
    }

    const startDate = this.parseDate(dto.startDate);
    const endDate = dto.endDate ? this.parseDate(dto.endDate) : null;
    if (endDate && startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException(
        "startDate must be before or equal to endDate",
      );
    }

    const actorId = actor.userId || actor.id;
    const previousDate = this.previousDate(startDate);
    let createdCount = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const metric of dto.metrics) {
        await tx.marketingKpiTarget.deleteMany({
          where: {
            tenantId: context.tenantId,
            scopeType: MarketingKpiScopeType.TEAM,
            teamCode: selectedTeam.teamCode,
            userId: null,
            category: null,
            metricKey: metric.metricKey,
            startDate,
          },
        });

        await tx.marketingKpiTarget.updateMany({
          where: {
            tenantId: context.tenantId,
            scopeType: MarketingKpiScopeType.TEAM,
            teamCode: selectedTeam.teamCode,
            userId: null,
            category: null,
            metricKey: metric.metricKey,
            startDate: { lt: startDate },
            OR: [{ endDate: null }, { endDate: { gte: startDate } }],
          },
          data: {
            endDate: previousDate,
            updatedByUserId: actorId,
          },
        });

        await tx.marketingKpiTarget.create({
          data: {
            tenantId: context.tenantId,
            scopeType: MarketingKpiScopeType.TEAM,
            teamCode: selectedTeam.teamCode,
            metricKey: metric.metricKey,
            targetValue: metric.targetValue,
            startDate,
            endDate,
            createdByUserId: actorId,
          },
        });
        createdCount += 1;
      }
    });

    return {
      success: true,
      message: `Saved ${createdCount} team KPI target(s) for ${selectedTeam.teamCode}`,
    };
  }

  async createCategoryTargets(
    dto: CreateMarketingCategoryTargetDto,
    actor: any,
  ) {
    const { context, selectedTeam } = await this.resolveTeamSelection(
      dto.teamCode,
    );
    if (!selectedTeam) {
      throw new NotFoundException("Team not found");
    }

    const startDate = this.parseDate(dto.startDate);
    const endDate = dto.endDate ? this.parseDate(dto.endDate) : null;
    if (endDate && startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException(
        "startDate must be before or equal to endDate",
      );
    }

    const actorId = actor.userId || actor.id;
    const previousDate = this.previousDate(startDate);
    let createdCount = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const metric of dto.metrics) {
        await tx.marketingKpiTarget.deleteMany({
          where: {
            tenantId: context.tenantId,
            scopeType: MarketingKpiScopeType.CATEGORY,
            teamCode: selectedTeam.teamCode,
            userId: null,
            category: dto.category as MarketingKpiCategory,
            metricKey: metric.metricKey,
            startDate,
          },
        });

        await tx.marketingKpiTarget.updateMany({
          where: {
            tenantId: context.tenantId,
            scopeType: MarketingKpiScopeType.CATEGORY,
            teamCode: selectedTeam.teamCode,
            userId: null,
            category: dto.category as MarketingKpiCategory,
            metricKey: metric.metricKey,
            startDate: { lt: startDate },
            OR: [{ endDate: null }, { endDate: { gte: startDate } }],
          },
          data: {
            endDate: previousDate,
            updatedByUserId: actorId,
          },
        });

        await tx.marketingKpiTarget.create({
          data: {
            tenantId: context.tenantId,
            scopeType: MarketingKpiScopeType.CATEGORY,
            teamCode: selectedTeam.teamCode,
            category: dto.category as MarketingKpiCategory,
            metricKey: metric.metricKey,
            targetValue: metric.targetValue,
            startDate,
            endDate,
            createdByUserId: actorId,
          },
        });
        createdCount += 1;
      }
    });

    return {
      success: true,
      message: `Saved ${createdCount} category KPI target(s) for ${dto.category}`,
    };
  }

  async createUserCategoryAssignment(
    dto: CreateMarketingUserCategoryAssignmentDto,
    actor: any,
  ) {
    const { context, selectedTeam } = await this.resolveTeamSelection(
      dto.teamCode,
    );
    if (!selectedTeam) {
      throw new NotFoundException("Team not found");
    }

    const startDate = this.parseDate(
      undefined,
      new Date().toISOString().slice(0, 10),
    );
    const endDate: Date | null = null;

    const actorId = actor.userId || actor.id;
    if (dto.userId === actorId && !context.isAdmin) {
      throw new ForbiddenException(
        "Team leaders cannot assign KPI category to themselves",
      );
    }

    await this.ensureOperationalTeamUser(
      context.tenantId,
      selectedTeam.id,
      selectedTeam.teamCode,
      dto.userId,
      startDate,
    );

    const previousDate = this.previousDate(startDate);
    await this.prisma.$transaction(async (tx) => {
      await tx.marketingKpiUserCategoryAssignment.deleteMany({
        where: {
          tenantId: context.tenantId,
          teamCode: selectedTeam.teamCode,
          userId: dto.userId,
          startDate,
        },
      });

      await tx.marketingKpiUserCategoryAssignment.updateMany({
        where: {
          tenantId: context.tenantId,
          teamCode: selectedTeam.teamCode,
          userId: dto.userId,
          startDate: { lt: startDate },
          OR: [{ endDate: null }, { endDate: { gte: startDate } }],
        },
        data: {
          endDate: previousDate,
          updatedByUserId: actorId,
        },
      });

      await tx.marketingKpiUserCategoryAssignment.create({
        data: {
          tenantId: context.tenantId,
          teamCode: selectedTeam.teamCode,
          userId: dto.userId,
          category: dto.category as MarketingKpiCategory,
          startDate,
          endDate,
          createdByUserId: actorId,
        },
      });
    });

    return {
      success: true,
      message: `Assigned ${dto.category} category to the selected user`,
    };
  }

  async createUserTargets(dto: CreateMarketingUserTargetDto, actor: any) {
    const { context, selectedTeam } = await this.resolveTeamSelection(
      dto.teamCode,
    );
    if (!selectedTeam) {
      throw new NotFoundException("Team not found");
    }

    const startDate = this.parseDate(dto.startDate);
    const endDate = dto.endDate ? this.parseDate(dto.endDate) : null;
    if (endDate && startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException(
        "startDate must be before or equal to endDate",
      );
    }

    const actorId = actor.userId || actor.id;
    if (dto.userId === actorId && !context.isAdmin) {
      throw new ForbiddenException(
        "Team leaders cannot assign KPI overrides to themselves",
      );
    }

    await this.ensureOperationalTeamUser(
      context.tenantId,
      selectedTeam.id,
      selectedTeam.teamCode,
      dto.userId,
      startDate,
    );

    const previousDate = this.previousDate(startDate);
    let createdCount = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const metric of dto.metrics) {
        await tx.marketingKpiTarget.deleteMany({
          where: {
            tenantId: context.tenantId,
            scopeType: MarketingKpiScopeType.USER,
            teamCode: selectedTeam.teamCode,
            userId: dto.userId,
            category: null,
            metricKey: metric.metricKey,
            startDate,
          },
        });

        await tx.marketingKpiTarget.updateMany({
          where: {
            tenantId: context.tenantId,
            scopeType: MarketingKpiScopeType.USER,
            teamCode: selectedTeam.teamCode,
            userId: dto.userId,
            category: null,
            metricKey: metric.metricKey,
            startDate: { lt: startDate },
            OR: [{ endDate: null }, { endDate: { gte: startDate } }],
          },
          data: {
            endDate: previousDate,
            updatedByUserId: actorId,
          },
        });

        await tx.marketingKpiTarget.create({
          data: {
            tenantId: context.tenantId,
            scopeType: MarketingKpiScopeType.USER,
            teamCode: selectedTeam.teamCode,
            userId: dto.userId,
            metricKey: metric.metricKey,
            targetValue: metric.targetValue,
            startDate,
            endDate,
            createdByUserId: actorId,
          },
        });
        createdCount += 1;
      }
    });

    return {
      success: true,
      message: `Saved ${createdCount} direct KPI override(s) for the selected user`,
    };
  }

  async getMyDashboard(params: {
    startDate?: string;
    endDate?: string;
    actor: any;
  }) {
    const { context, selectedTeam } = await this.resolveTeamSelection(null);
    const { start, end, startDate, endDate, referenceDate } =
      this.buildDateRange(params.startDate, params.endDate);
    const dateKeys = this.buildDateKeys(start, end);

    if (!selectedTeam) {
      return {
        selected: { startDate, endDate, teamCode: null },
        category: null,
        cards: [],
      };
    }

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: context.tenantId,
        id: params.actor.userId || params.actor.id,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeId: true,
      },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const categoryAssignment = await this.getCurrentCategoryAssignment(
      context.tenantId,
      selectedTeam.teamCode,
      user.id,
      referenceDate,
    );

    const [userTargetRows, categoryTargetRows, actuals] = await Promise.all([
      this.getTargetRowsOverlappingRange({
        tenantId: context.tenantId,
        teamCode: selectedTeam.teamCode,
        scopeType: MarketingKpiScopeType.USER,
        metricKeys: USER_METRICS,
        start,
        end,
        userId: user.id,
      }),
      categoryAssignment
        ? this.getTargetRowsOverlappingRange({
            tenantId: context.tenantId,
            teamCode: selectedTeam.teamCode,
            scopeType: MarketingKpiScopeType.CATEGORY,
            metricKeys: USER_METRICS,
            start,
            end,
            category: categoryAssignment.category,
          })
        : Promise.resolve([]),
      this.computeUserMetricsForRange(
        context.tenantId,
        selectedTeam.teamCode,
        user,
        start,
        end,
      ),
    ]);

    const userDailyTargets = this.buildDailyTargetByMetric(
      USER_METRICS,
      dateKeys,
      userTargetRows,
    );
    const categoryDailyTargets = this.buildDailyTargetByMetric(
      USER_METRICS,
      dateKeys,
      categoryTargetRows,
    );
    const effectiveDailyTargets = this.mergeDailyTargetsByPriority(
      USER_METRICS,
      dateKeys,
      userDailyTargets,
      categoryDailyTargets,
    );

    const cards = USER_METRICS.map((metricKey) => {
      const targetByDate = effectiveDailyTargets.get(metricKey);
      const targetValue = this.computeRangeTarget(
        metricKey,
        dateKeys,
        targetByDate,
      );
      return this.buildDashboardCard(
        metricKey,
        targetValue,
        actuals.totals[metricKey],
        actuals.dailyProgress[metricKey],
        startDate,
        endDate,
        targetByDate,
      );
    });

    return {
      selected: { startDate, endDate, teamCode: selectedTeam.teamCode },
      category: categoryAssignment?.category || null,
      cards,
    };
  }

  async getTeamDashboard(params: {
    startDate?: string;
    endDate?: string;
    teamCode?: string;
  }) {
    const { context, selectedTeam } = await this.resolveTeamSelection(
      params.teamCode,
    );
    const { start, end, startDate, endDate } = this.buildDateRange(
      params.startDate,
      params.endDate,
    );
    const dateKeys = this.buildDateKeys(start, end);

    if (!selectedTeam) {
      return {
        selected: { startDate, endDate, teamCode: null },
        cards: [],
      };
    }

    const [teamTargetRows, actuals] = await Promise.all([
      this.getTargetRowsOverlappingRange({
        tenantId: context.tenantId,
        teamCode: selectedTeam.teamCode,
        scopeType: MarketingKpiScopeType.TEAM,
        metricKeys: TEAM_METRICS,
        start,
        end,
      }),
      this.computeTeamMetricsForRange(
        context.tenantId,
        selectedTeam.teamCode,
        start,
        end,
      ),
    ]);

    const dailyTargets = this.buildDailyTargetByMetric(
      TEAM_METRICS,
      dateKeys,
      teamTargetRows,
    );

    const cards = TEAM_METRICS.map((metricKey) =>
      this.buildDashboardCard(
        metricKey,
        this.computeRangeTarget(
          metricKey,
          dateKeys,
          dailyTargets.get(metricKey),
        ),
        actuals.totals[metricKey],
        actuals.dailyProgress[metricKey],
        startDate,
        endDate,
        dailyTargets.get(metricKey),
      ),
    );

    return {
      selected: {
        startDate,
        endDate,
        teamCode: selectedTeam.teamCode,
        teamName: selectedTeam.name,
      },
      cards,
    };
  }

  async getExecutiveDashboard(params: {
    startDate?: string;
    endDate?: string;
    teamCode?: string;
  }) {
    const { context, teams, selectedTeam } = await this.resolveTeamSelection(
      params.teamCode,
    );
    if (!context.isAdmin) {
      throw new ForbiddenException(
        "Executive KPI view requires tenant-wide access",
      );
    }

    const { start, end, startDate, endDate } = this.buildDateRange(
      params.startDate,
      params.endDate,
    );
    const dateKeys = this.buildDateKeys(start, end);

    const teamsToShow =
      params.teamCode && selectedTeam ? [selectedTeam] : teams;

    if (teamsToShow.length === 0) {
      return {
        selected: { startDate, endDate, teamCode: null },
        rows: [],
        summary: {
          teamCount: 0,
          onTrackCount: 0,
          atRiskCount: 0,
          missedCount: 0,
        },
      };
    }

    const [
      targetRows,
      memberTargetRows,
      reconcileRows,
      teamMembersByCodeEntries,
    ] = await Promise.all([
      this.prisma.marketingKpiTarget.findMany({
        where: {
          tenantId: context.tenantId,
          scopeType: MarketingKpiScopeType.TEAM,
          teamCode: { in: teamsToShow.map((team) => team.teamCode) },
          metricKey: { in: [...TEAM_METRICS] },
          startDate: { lte: end },
          OR: [{ endDate: null }, { endDate: { gte: start } }],
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.marketingKpiTarget.findMany({
        where: {
          tenantId: context.tenantId,
          scopeType: {
            in: [MarketingKpiScopeType.USER, MarketingKpiScopeType.CATEGORY],
          },
          teamCode: { in: teamsToShow.map((team) => team.teamCode) },
          metricKey: { in: [...USER_METRICS] },
          startDate: { lte: end },
          OR: [{ endDate: null }, { endDate: { gte: start } }],
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.reconcileMarketing.findMany({
        where: {
          tenantId: context.tenantId,
          date: { gte: start, lte: end },
        },
        select: {
          date: true,
          teamCode: true,
          spend: true,
          codPos: true,
          canceledCodPos: true,
          restockingCodPos: true,
          abandonedCodPos: true,
        },
      }),
      Promise.all(
        teamsToShow.map(
          async (team) =>
            [
              team.teamCode,
              await this.listEligibleUsersForTeam(
                context.tenantId,
                team.id,
                team.teamCode,
                end,
              ),
            ] as const,
        ),
      ),
    ]);
    const teamMembersByCode = new Map(teamMembersByCodeEntries);

    const rows = await Promise.all(
      teamsToShow.map(async (team) => {
        const normalizedTeamCode = this.normalize(team.teamCode);
        const filteredRows = reconcileRows.filter(
          (row) => this.normalize(row.teamCode) === normalizedTeamCode,
        );
        const teamTargetRows = targetRows.filter(
          (row) => this.normalize(row.teamCode) === normalizedTeamCode,
        );
        const dailyTargets = this.buildDailyTargetByMetric(
          TEAM_METRICS,
          dateKeys,
          teamTargetRows,
        );
        const totals = this.computeTeamMetricsFromRows(filteredRows);
        const cards = TEAM_METRICS.map((metricKey) =>
          this.buildDashboardCard(
            metricKey,
            this.computeRangeTarget(
              metricKey,
              dateKeys,
              dailyTargets.get(metricKey),
            ),
            totals[metricKey],
            [],
            startDate,
            endDate,
            dailyTargets.get(metricKey),
          ),
        );
        const teamMembers = teamMembersByCode.get(team.teamCode) || [];
        const teamMemberTargetRows = memberTargetRows.filter(
          (row) => this.normalize(row.teamCode) === normalizedTeamCode,
        );
        const members = await Promise.all(
          teamMembers.map((user) =>
            this.buildExecutiveMemberRow({
              tenantId: context.tenantId,
              teamCode: team.teamCode,
              user,
              start,
              end,
              startDate,
              endDate,
              dateKeys,
              userTargetRows: teamMemberTargetRows.filter(
                (row) =>
                  row.scopeType === MarketingKpiScopeType.USER &&
                  row.userId === user.id,
              ),
              categoryTargetRows: user.currentCategory
                ? teamMemberTargetRows.filter(
                    (row) =>
                      row.scopeType === MarketingKpiScopeType.CATEGORY &&
                      row.category === user.currentCategory,
                  )
                : [],
            }),
          ),
        );

        return {
          teamCode: team.teamCode,
          teamName: team.name,
          cards,
          members,
        };
      }),
    );

    const allCards = rows.flatMap((row) => row.cards);
    const summary = {
      teamCount: rows.length,
      onTrackCount: allCards.filter((card) => card.status === "ON_TRACK")
        .length,
      atRiskCount: allCards.filter((card) => card.status === "AT_RISK").length,
      missedCount: allCards.filter((card) => card.status === "MISSED").length,
    };

    return {
      selected: {
        startDate,
        endDate,
        teamCode: params.teamCode || null,
      },
      rows,
      summary,
    };
  }
}
