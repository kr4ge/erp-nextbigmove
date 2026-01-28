import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check legacy role field first (SUPER_ADMIN, ADMIN, USER, VIEWER)
    const hasLegacyRole = requiredRoles.some((role) => user.role === role);
    if (hasLegacyRole) {
      return true;
    }

    // Check dynamic roles from UserRoleAssignment
    const tenantId = this.cls.get('tenantId') || user.tenantId;
    const userId = user.userId || user.id;

    // Fetch user's assigned roles (both tenant and team scoped)
    const roleAssignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        userId,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        role: {
          select: { key: true, name: true },
        },
      },
    });

    // Check if any assigned role matches required roles (by key or name)
    const hasDynamicRole = roleAssignments.some((assignment) =>
      requiredRoles.includes(assignment.role.key) || requiredRoles.includes(assignment.role.name),
    );

    if (!hasDynamicRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
