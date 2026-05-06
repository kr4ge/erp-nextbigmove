import { Injectable } from '@nestjs/common';
import type { RoleScope, RbacWorkspace, TeamMembershipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  filterPermissionKeysByWorkspace,
  normalizePermissionWorkspace,
  roleBelongsToWorkspace,
  type PermissionWorkspace,
} from '../rbac/permission-workspace';

type ResolveUserAccessParams = {
  userId: string;
  tenantId?: string | null;
  basePermissions?: string[];
  requestedTeamIds?: string[];
  workspace?: PermissionWorkspace;
};

export type EffectiveAccessRole = {
  id: string;
  key: string;
  name: string;
  scope: RoleScope;
  workspace: RbacWorkspace;
  tenantId: string | null;
  teamId: string | null;
};

export type EffectiveTeamMembership = {
  teamId: string;
  teamName: string;
  teamCode: string | null;
  status: TeamMembershipStatus;
  isDefault: boolean;
  role: {
    id: string;
    key: string;
    name: string;
    workspace: RbacWorkspace;
  } | null;
};

@Injectable()
export class EffectiveAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveUserAccess(params: ResolveUserAccessParams) {
    const {
      userId,
      tenantId,
      basePermissions = [],
      requestedTeamIds = [],
      workspace = 'all',
    } = params;

    const normalizedWorkspace = normalizePermissionWorkspace(workspace);
    const effectivePermissions = new Set<string>(basePermissions);

    const roleAssignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        userId,
        ...(tenantId ? { tenantId } : {}),
        ...(requestedTeamIds.length > 0
          ? {
              OR: [
                { teamId: null },
                { teamId: { in: requestedTeamIds } },
              ],
            }
          : {}),
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    roleAssignments.forEach((assignment) => {
      assignment.role.rolePermissions.forEach((rolePermission) => {
        effectivePermissions.add(rolePermission.permission.key);
      });
    });

    const userPermissionAssignments = await this.prisma.userPermissionAssignment.findMany({
      where: {
        userId,
        ...(tenantId ? { tenantId } : {}),
        ...(requestedTeamIds.length > 0
          ? {
              OR: [
                { teamId: null },
                { teamId: { in: requestedTeamIds } },
              ],
            }
          : {}),
      },
      include: {
        permission: true,
      },
    });

    userPermissionAssignments.forEach((assignment) => {
      if (assignment.allow) {
        effectivePermissions.add(assignment.permission.key);
      } else {
        effectivePermissions.delete(assignment.permission.key);
      }
    });

    const filteredRoles = roleAssignments
      .map((assignment) => assignment)
      .filter((assignment) => roleBelongsToWorkspace(assignment.role, normalizedWorkspace))
      .map<EffectiveAccessRole>((assignment) => ({
        id: assignment.role.id,
        key: assignment.role.key,
        name: assignment.role.name,
        scope: assignment.role.scope,
        workspace: assignment.role.workspace,
        tenantId: assignment.tenantId,
        teamId: assignment.teamId,
      }));

    return {
      permissions: filterPermissionKeysByWorkspace(
        Array.from(effectivePermissions).sort((left, right) => left.localeCompare(right)),
        normalizedWorkspace,
      ),
      roles: filteredRoles,
    };
  }

  async getActiveTeamMemberships(userId: string, tenantId: string) {
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        userId,
        tenantId,
        status: 'ACTIVE',
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            teamCode: true,
            status: true,
          },
        },
        role: {
          select: {
            id: true,
            key: true,
            name: true,
            workspace: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships
      .map<EffectiveTeamMembership>((membership) => ({
        teamId: membership.team.id,
        teamName: membership.team.name,
        teamCode: membership.team.teamCode ?? null,
        status: membership.status,
        isDefault: membership.isDefault,
        role: membership.role
          ? {
              id: membership.role.id,
              key: membership.role.key,
              name: membership.role.name,
              workspace: membership.role.workspace,
            }
          : null,
      }))
      .sort((left, right) => {
        if (left.isDefault !== right.isDefault) {
          return left.isDefault ? -1 : 1;
        }

        return left.teamName.localeCompare(right.teamName);
      });
  }
}
