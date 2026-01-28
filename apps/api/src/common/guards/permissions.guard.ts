import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No permissions required
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Only SUPER_ADMIN (platform administrators) bypass permission checks
    // All tenant users must have appropriate permissions
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    const tenantId = this.cls.get('tenantId') || user.tenantId;
    const teamId = this.cls.get('teamId') || null;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const effective = new Set<string>();

    // User.permissions array (legacy)
    if (Array.isArray(user.permissions)) {
      user.permissions.forEach((p: string) => effective.add(p));
    }

    // Role-based permissions via assignments
    const roleAssignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        userId: user.userId || user.id,
        OR: [
          { tenantId, teamId: teamId || undefined },
          { tenantId, teamId: null },
        ],
      },
      select: { roleId: true },
    });
    const roleIds = roleAssignments.map((ra) => ra.roleId);
    if (roleIds.length > 0) {
      const rolePerms = await this.prisma.rolePermission.findMany({
        where: { roleId: { in: roleIds } },
        include: { permission: true },
      });
      rolePerms.forEach((rp) => effective.add(rp.permission.key));
    }

    // User permission overrides
    const userPerms = await this.prisma.userPermissionAssignment.findMany({
      where: {
        userId: user.userId || user.id,
        OR: [
          { tenantId, teamId: teamId || undefined },
          { tenantId, teamId: null },
        ],
      },
      include: { permission: true },
    });
    userPerms.forEach((up) => {
      if (up.allow) {
        effective.add(up.permission.key);
      } else {
        effective.delete(up.permission.key);
      }
    });

    const hasAny = required.some((perm) => effective.has(perm));
    if (!hasAny) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
