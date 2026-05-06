import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ClsService } from 'nestjs-cls';
import { EffectiveAccessService } from '../services/effective-access.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private cls: ClsService,
    private effectiveAccessService: EffectiveAccessService,
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

    // Only SUPER_ADMIN remains a legacy platform-level bypass.
    const hasLegacyRole = user.role === 'SUPER_ADMIN' && requiredRoles.includes('SUPER_ADMIN');
    if (hasLegacyRole) {
      return true;
    }

    // Check dynamic roles from UserRoleAssignment
    const tenantId = this.cls.get('tenantId') || user.tenantId;
    const userId = user.userId || user.id;

    const access = await this.effectiveAccessService.resolveUserAccess({
      userId,
      tenantId,
      basePermissions: Array.isArray(user.permissions) ? user.permissions : [],
      workspace: 'all',
    });

    // Check if any assigned role matches required roles (by key or name)
    const hasDynamicRole = access.roles.some((role) =>
      requiredRoles.includes(role.key) || requiredRoles.includes(role.name),
    );

    if (!hasDynamicRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
