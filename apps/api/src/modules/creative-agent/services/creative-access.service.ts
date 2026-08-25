import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { EffectiveAccessService } from '../../../common/services/effective-access.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import type { CreativeAccessContext, CreativeActor } from '../types/creative-actor.type';

@Injectable()
export class CreativeAccessService {
  constructor(
    private readonly cls: ClsService,
    private readonly effectiveAccess: EffectiveAccessService,
  ) {}

  async resolve(actor: CreativeActor): Promise<CreativeAccessContext> {
    const tenantId = this.cls.get<string>('tenantId') || actor.tenantId;
    const userId = actor.userId || actor.id;
    if (!tenantId || !userId) {
      throw new ForbiddenException('Tenant and user context are required');
    }

    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    if (isSuperAdmin) {
      return { tenantId, userId, isSuperAdmin, permissions: new Set(Object.values(CREATIVE_AGENT_PERMISSIONS)) };
    }

    const access = await this.effectiveAccess.resolveUserAccess({
      userId,
      tenantId,
      basePermissions: Array.isArray(actor.permissions) ? actor.permissions : [],
      workspace: 'erp',
    });

    return {
      tenantId,
      userId,
      isSuperAdmin: false,
      permissions: new Set(access.permissions),
    };
  }

  has(context: CreativeAccessContext, permission: string): boolean {
    return context.isSuperAdmin || context.permissions.has(permission);
  }

  require(context: CreativeAccessContext, ...permissions: string[]): void {
    if (!permissions.some((permission) => this.has(context, permission))) {
      throw new ForbiddenException('Insufficient creative workspace permissions');
    }
  }

  requireReadable(context: CreativeAccessContext): void {
    this.require(context, CREATIVE_AGENT_PERMISSIONS.READ, CREATIVE_AGENT_PERMISSIONS.READ_ALL);
  }

  canReadAll(context: CreativeAccessContext): boolean {
    return this.has(context, CREATIVE_AGENT_PERMISSIONS.READ_ALL);
  }

  canEdit(context: CreativeAccessContext, createdById: string): boolean {
    return this.has(context, CREATIVE_AGENT_PERMISSIONS.EDIT_ALL)
      || (createdById === context.userId && this.has(context, CREATIVE_AGENT_PERMISSIONS.EDIT));
  }
}
