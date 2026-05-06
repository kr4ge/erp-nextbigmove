import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ClsService } from 'nestjs-cls';
import { EffectiveAccessService } from '../services/effective-access.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private cls: ClsService,
    private effectiveAccessService: EffectiveAccessService,
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

    const access = await this.effectiveAccessService.resolveUserAccess({
      userId: user.userId || user.id,
      tenantId,
      basePermissions: Array.isArray(user.permissions) ? user.permissions : [],
      requestedTeamIds: teamId ? [teamId] : [],
    });

    const effectivePermissionSet = new Set(access.permissions);
    const hasAny = required.some((perm) => effectivePermissionSet.has(perm));
    if (!hasAny) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
