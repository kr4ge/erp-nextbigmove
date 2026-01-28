import { Injectable, ForbiddenException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Get user's team memberships for the current tenant
   */
  async getUserTeamMemberships(userId: string, tenantId: string): Promise<string[]> {
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        userId,
        tenantId,
        status: 'ACTIVE',
      },
      select: {
        teamId: true,
      },
    });

    return memberships.map((m) => m.teamId);
  }

  /**
   * Check if user has tenant-wide admin access via dynamic roles
   */
  async checkTenantWideAccess(userId: string, tenantId: string): Promise<boolean> {
    const adminPermKeys = new Set(['team.manage', 'permission.assign', 'user.manage', 'team.read_all']);

    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, tenantId, teamId: null },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    for (const a of assignments) {
      for (const rp of a.role.rolePermissions) {
        if (adminPermKeys.has(rp.permission.key)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Validate that a user can access a specific team
   * Returns true if:
   * - User is a tenant-wide admin, OR
   * - User is a member of the specified team, OR
   * - User is SUPER_ADMIN
   */
  async canAccessTeam(userId: string, tenantId: string, teamId: string | null): Promise<boolean> {
    const role = this.cls.get('userRole');

    // SUPER_ADMIN bypasses all checks
    if (role === 'SUPER_ADMIN') {
      return true;
    }

    // If no team specified, check tenant-wide access
    if (!teamId) {
      return this.checkTenantWideAccess(userId, tenantId);
    }

    // Check tenant-wide admin access first
    const isAdmin = await this.checkTenantWideAccess(userId, tenantId);
    if (isAdmin) {
      return true;
    }

    // Check team membership
    const userTeams = await this.getUserTeamMemberships(userId, tenantId);
    return userTeams.includes(teamId);
  }

  /**
   * Get context with team validation
   * Returns: { tenantId, teamId, userId, isAdmin, userTeams }
   */
  async getContext() {
    const tenantId = this.cls.get('tenantId');
    const teamId = this.cls.get('teamId');
    const teamIds: string[] | undefined = this.cls.get('teamIds');
    const userId = this.cls.get('userId');
    const role = this.cls.get('userRole');
    const isSuperAdmin = role === 'SUPER_ADMIN';

    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    // SUPER_ADMIN is always admin
    if (isSuperAdmin) {
      return {
        tenantId,
        teamId,
        teamIds: teamIds || [],
        userId,
        role,
        isAdmin: true,
        userTeams: [],
      };
    }

    // Check if user has tenant-wide admin access via dynamic roles
    let hasTenantWideAccess = false;
    let userTeams: string[] = [];

    if (userId) {
      hasTenantWideAccess = await this.checkTenantWideAccess(userId, tenantId);
      userTeams = await this.getUserTeamMemberships(userId, tenantId);
    }

    const isAdmin = hasTenantWideAccess;

    return {
      tenantId,
      teamId,
      teamIds: teamIds || [],
      userId,
      role,
      isAdmin,
      userTeams,
    };
  }

  /**
   * Validate and get effective team ID
   * - For admins: allow any team or null
   * - For team members: only allow their teams
   */
  async validateAndGetTeamId(payloadTeamId: string | undefined | null): Promise<string | null> {
    const { tenantId, teamId, teamIds, userId, isAdmin, userTeams } = await this.getContext();

    const candidate = payloadTeamId !== undefined ? payloadTeamId : teamId;

    // Admins can use any team or null
    if (isAdmin) {
      return candidate || null;
    }

    // Non-admins must have team context
    if (!candidate) {
      throw new ForbiddenException('Team context is required');
    }

    if (!userTeams.includes(candidate)) {
      throw new ForbiddenException('You do not have access to this team');
    }

    return candidate;
  }

  /**
   * Build where clause for team-scoped queries
   */
  async buildTeamWhereClause(additionalWhere: any = {}, allowedTeamIds?: string[]): Promise<any> {
    const { tenantId, teamId, teamIds, isAdmin, userTeams } = await this.getContext();

    const where: any = {
      tenantId,
      ...additionalWhere,
    };

    if (Array.isArray(allowedTeamIds) && allowedTeamIds.length > 0) {
      where.teamId = allowedTeamIds.length === 1 ? allowedTeamIds[0] : { in: allowedTeamIds };
      return where;
    }

    // When multiple teamIds are set in context (header), respect them
    if (Array.isArray(teamIds) && teamIds.length > 0) {
      where.teamId = teamIds.length === 1 ? teamIds[0] : { in: teamIds };
      return where;
    }

    if (isAdmin) {
      return where;
    }

    // Non-admins only see their teams
    if (userTeams.length === 0) {
      where.teamId = 'impossible-team-id';
    } else if (userTeams.length === 1) {
      where.teamId = userTeams[0];
    } else {
      where.teamId = { in: userTeams };
    }

    return where;
  }

  /**
   * For analytics modules, expand effective teams with shares.
   */
  async getAnalyticsTeamIds(scope: 'sales' | 'marketing' | 'both'): Promise<string[] | null> {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.getContext();

    // Admin without explicit scope: no restriction needed
    if (isAdmin && (!teamIds || teamIds.length === 0)) {
      return null;
    }

    const baseTeams = (Array.isArray(teamIds) && teamIds.length > 0 ? teamIds : userTeams) || [];
    if (baseTeams.length === 0) {
      return [];
    }

    const scopes = scope === 'both' ? ['BOTH', 'SALES', 'MARKETING'] : [scope.toUpperCase(), 'BOTH'];
    const shares = await this.prisma.analyticsShare.findMany({
      where: {
        tenantId,
        targetTeamId: { in: baseTeams },
        scope: { in: scopes as any },
      },
      select: { ownerTeamId: true },
    });

    const ownerIds = shares.map((s) => s.ownerTeamId);
    const all = Array.from(new Set([...baseTeams, ...ownerIds]));
    return all;
  }
}
