import { CanActivate, ExecutionContext, Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { validate as uuidValidate } from 'uuid';

@Injectable()
export class TeamGuard implements CanActivate {
  constructor(
    private readonly cls: ClsService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context is required');
    }

    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const userId = user.userId || user.id;

    // SUPER_ADMIN bypass
    if (isSuperAdmin) {
      this.cls.set('teamId', null);
      return true;
    }

    const tenantId = this.cls.get('tenantId') || user.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    // Check if user has tenant-wide access via permissions (no legacy role fallback)
    const adminPermKeys = new Set(['team.manage', 'permission.assign', 'user.manage', 'team.read_all']);
    let hasTenantWideAccess = false;

    if (Array.isArray(user.permissions)) {
      hasTenantWideAccess = user.permissions.some((p: string) => adminPermKeys.has(p));
    }

    if (!hasTenantWideAccess) {
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
            hasTenantWideAccess = true;
            break;
          }
        }
        if (hasTenantWideAccess) break;
      }
    }

    // Accept teamId from header, body, or query
    const headerTeamId = request.headers['x-team-id'] as string | undefined;
    const bodyTeamId = request.body?.teamId as string | undefined;
    const queryTeamId = request.query?.teamId as string | undefined;
    const defaultTeamId = user.defaultTeamId as string | undefined;
    const raw = headerTeamId || bodyTeamId || queryTeamId || defaultTeamId;
    const teamIds = raw
      ? raw.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

    // ADMIN: allow no teamId (cross-team). If provided, validate and set CLS.
    if (hasTenantWideAccess && teamIds.length === 0) {
      this.cls.set('teamId', null);
      this.cls.set('teamIds', []);
      return true;
    }

    // If still missing, pick the first active membership (helps non-admins without a stored team)
    if (teamIds.length === 0) {
      const membership = await this.prisma.teamMembership.findFirst({
        where: {
          tenantId,
          userId: user.userId || user.id,
          status: 'ACTIVE',
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      if (membership) {
        teamIds.push(membership.teamId);
      }
    }

    if (teamIds.length === 0) {
      throw new BadRequestException('Team ID is required (provide X-Team-ID header or teamId param)');
    }

    for (const id of teamIds) {
      if (!uuidValidate(id)) {
        throw new BadRequestException('Team ID must be a valid UUID');
      }
    }

    // Tenant admins can access any team in the tenant
    if (hasTenantWideAccess) {
      const count = await this.prisma.team.count({
        where: { id: { in: teamIds }, tenantId },
      });
      if (count !== teamIds.length) {
        throw new ForbiddenException('One or more teams not found for this tenant');
      }
      this.cls.set('teamId', teamIds[0] || null);
      this.cls.set('teamIds', teamIds);
      return true;
    }

    // Verify membership for other roles
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        teamId: { in: teamIds },
        tenantId,
        userId: user.userId || user.id,
        status: 'ACTIVE',
      },
    });

    // If requested teams don't match memberships, try fallback to any valid membership
    if (memberships.length !== teamIds.length) {
      // Find any active membership as fallback (handles stale localStorage team IDs)
      const fallbackMembership = await this.prisma.teamMembership.findFirst({
        where: {
          tenantId,
          userId: user.userId || user.id,
          status: 'ACTIVE',
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });

      if (fallbackMembership) {
        // Use fallback team instead of throwing error
        this.cls.set('teamId', fallbackMembership.teamId);
        this.cls.set('teamIds', [fallbackMembership.teamId]);
        return true;
      }

      throw new ForbiddenException('You are not a member of any team');
    }

    this.cls.set('teamId', teamIds[0]);
    this.cls.set('teamIds', teamIds);
    return true;
  }
}
