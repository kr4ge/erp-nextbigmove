import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { validate as uuidValidate } from 'uuid';

@Injectable()
export class TenantGuard implements CanActivate {
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

    // Platform administrators still need the selected tenant for tenant-scoped services.
    if (user.role === 'SUPER_ADMIN') {
      const selectedTenantId = this.readRequestedTenantId(request);
      if (selectedTenantId) {
        await this.assertActiveTenant(selectedTenantId);
        this.cls.set('tenantId', selectedTenantId);
      }
      this.cls.set('userId', user.userId);
      this.cls.set('userRole', user.role);
      this.cls.set('userPermissions', user.permissions || []);
      this.cls.set('sessionId', user.sessionId || null);
      return true;
    }

    // For non-SUPER_ADMIN users, tenant context is required
    if (!user.tenantId || !uuidValidate(user.tenantId)) {
      throw new ForbiddenException('Tenant context is required');
    }

    // Set tenant context in CLS
    this.cls.set('tenantId', user.tenantId);
    this.cls.set('userId', user.userId);
    this.cls.set('userRole', user.role);
    this.cls.set('userPermissions', user.permissions || []);
    this.cls.set('sessionId', user.sessionId || null);

    // Verify tenant is active
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
      throw new ForbiddenException('Tenant account is not active');
    }

    return true;
  }

  private readRequestedTenantId(request: {
    headers?: Record<string, unknown>;
  }) {
    const rawTenantId = request.headers?.['x-tenant-id'];
    const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;

    if (tenantId === null || tenantId === undefined || tenantId === '') {
      return null;
    }

    if (typeof tenantId !== 'string' || !uuidValidate(tenantId)) {
      throw new ForbiddenException('Invalid tenant context');
    }

    return tenantId;
  }

  private async assertActiveTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    if (tenant.status !== TenantStatus.ACTIVE && tenant.status !== TenantStatus.TRIAL) {
      throw new ForbiddenException('Tenant account is not active');
    }
  }
}
