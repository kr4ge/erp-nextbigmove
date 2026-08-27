import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { Request } from 'express';
import { WmsStaffActivityOutcome } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';
import { toStoredPermissionWorkspace } from '../../common/rbac/permission-workspace';
import { WmsStaffActivityService } from '../../common/services/wms-staff-activity.service';
import { EffectiveAccessService } from '../../common/services/effective-access.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly wmsStaffActivityService: WmsStaffActivityService,
    private readonly effectiveAccessService: EffectiveAccessService,
  ) {}

  /**
   * Register a new tenant and admin user
   */
  async register(registerDto: RegisterDto) {
    const { password, firstName, lastName, tenantName, tenantSlug } = registerDto;
    const email = registerDto.email.trim().toLowerCase();

    // Check if email already exists in any tenant
    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Check if tenant slug is available
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant slug already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate per-tenant encryption key (32 bytes = 64 hex chars)
    const encryptionKey = crypto.randomBytes(32).toString('hex');

    // Create tenant and admin user in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug: tenantSlug,
          encryptionKey,
          status: 'TRIAL',
          settings: {},
          metadata: {},
          features: [],
          maxUsers: 10,
          maxIntegrations: 5,
          planType: 'trial',
        },
      });

      const tenantAdminRole = await tx.role.findFirst({
        where: { key: 'TENANT_ADMIN', tenantId: null },
        select: { id: true },
      });

      if (!tenantAdminRole) {
        throw new BadRequestException('TENANT_ADMIN system role is missing. Run the RBAC seed first.');
      }

      // Create tenant owner user. The legacy role stays USER; tenant access comes from dynamic RBAC.
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          tenantId: tenant.id,
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: false,
        },
      });

      await tx.userRoleAssignment.create({
        data: {
          userId: user.id,
          roleId: tenantAdminRole.id,
          workspace: toStoredPermissionWorkspace('erp'),
          tenantId: tenant.id,
          teamId: null,
        },
      });

      return { tenant, user };
    });

    // Generate tokens
    const tokens = await this.generateTokens(
      result.user.id,
      result.tenant.id,
      result.user.role,
      crypto.randomUUID(),
    );

    // Update last login
    await this.prisma.user.update({
      where: { id: result.user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: this.sanitizeUser(result.user),
      tenant: this.sanitizeTenant(result.tenant),
      ...tokens,
    };
  }

  /**
   * Login user
   */
  async login(loginDto: LoginDto, request?: Request) {
    const email = loginDto.email.trim().toLowerCase();
    const { password } = loginDto;

    // Find user by email (across all tenants)
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      await this.wmsStaffActivityService.recordFromRequest({
        request,
        actionType: 'LOGIN',
        resourceType: 'AUTH_SESSION',
        outcome: WmsStaffActivityOutcome.REJECTED,
        reasonCode: 'INVALID_CREDENTIALS',
        metadata: {
          email,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.wmsStaffActivityService.recordFromRequest({
        request,
        tenantId: user.tenantId,
        actorId: user.id,
        actionType: 'LOGIN',
        resourceType: 'AUTH_SESSION',
        outcome: WmsStaffActivityOutcome.REJECTED,
        reasonCode: 'INVALID_CREDENTIALS',
        metadata: {
          email,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      await this.wmsStaffActivityService.recordFromRequest({
        request,
        tenantId: user.tenantId,
        actorId: user.id,
        actionType: 'LOGIN',
        resourceType: 'AUTH_SESSION',
        outcome: WmsStaffActivityOutcome.REJECTED,
        reasonCode: 'ACCOUNT_INACTIVE',
      });
      throw new UnauthorizedException('Account is not active');
    }

    // ERP users are tenant-scoped. WMS staff are tenantless and authorized by WMS role assignments.
    if (user.role !== 'SUPER_ADMIN') {
      if (!user.tenantId) {
        const hasWmsAccess = await this.hasWmsWorkspaceAccess(user.id);
        if (!hasWmsAccess) {
          await this.wmsStaffActivityService.recordFromRequest({
            request,
            actorId: user.id,
            actionType: 'LOGIN',
            resourceType: 'AUTH_SESSION',
            outcome: WmsStaffActivityOutcome.REJECTED,
            reasonCode: 'NO_WORKSPACE_ACCESS',
          });
          throw new UnauthorizedException('Account has no workspace access');
        }
      } else if (!user.tenant || (user.tenant.status !== 'ACTIVE' && user.tenant.status !== 'TRIAL')) {
        await this.wmsStaffActivityService.recordFromRequest({
          request,
          tenantId: user.tenantId,
          actorId: user.id,
          actionType: 'LOGIN',
          resourceType: 'AUTH_SESSION',
          outcome: WmsStaffActivityOutcome.REJECTED,
          reasonCode: 'TENANT_INACTIVE',
        });
        throw new UnauthorizedException('Tenant account is not active');
      }
    }

    // Generate tokens
    const sessionId = crypto.randomUUID();
    const tokens = await this.generateTokens(user.id, user.tenantId, user.role, sessionId);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.wmsStaffActivityService.recordFromRequest({
      request,
      tenantId: user.tenantId,
      actorId: user.id,
      sessionId,
      actionType: 'LOGIN',
      resourceType: 'AUTH_SESSION',
      resourceId: sessionId,
      metadata: {
        email,
      },
    });

    return {
      user: this.sanitizeUser(user),
      tenant: user.tenant ? this.sanitizeTenant(user.tenant) : null,
      ...tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      // Verify user still exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        include: { tenant: true },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User not found or inactive');
      }

      if (user.role !== 'SUPER_ADMIN') {
        if (!user.tenantId) {
          const hasWmsAccess = await this.hasWmsWorkspaceAccess(user.id);
          if (!hasWmsAccess) {
            throw new UnauthorizedException('Account has no workspace access');
          }
        } else if (!user.tenant || (user.tenant.status !== 'ACTIVE' && user.tenant.status !== 'TRIAL')) {
          throw new UnauthorizedException('Tenant account is not active');
        }
      }

      // Generate new tokens
      const tokens = await this.generateTokens(
        user.id,
        user.tenantId,
        user.role,
        typeof payload.sessionId === 'string' && payload.sessionId.trim().length > 0
          ? payload.sessionId
          : crypto.randomUUID(),
      );

      return {
        user: this.sanitizeUser(user),
        tenant: user.tenant ? this.sanitizeTenant(user.tenant) : null,
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active');
    }

    if (user.role !== 'SUPER_ADMIN') {
      if (!user.tenantId) {
        const hasWmsAccess = await this.hasWmsWorkspaceAccess(user.id);
        if (!hasWmsAccess) {
          throw new UnauthorizedException('Account has no workspace access');
        }
      } else if (!user.tenant || (user.tenant.status !== 'ACTIVE' && user.tenant.status !== 'TRIAL')) {
        throw new UnauthorizedException('Tenant account is not active');
      }
    }

    return user;
  }

  async logout(
    user: {
      userId?: string;
      id?: string;
      tenantId?: string | null;
      sessionId?: string | null;
    },
    request?: Request,
  ) {
    await this.wmsStaffActivityService.recordFromRequest({
      request,
      tenantId: user.tenantId ?? null,
      actorId: user.userId ?? user.id ?? null,
      sessionId: user.sessionId ?? null,
      actionType: 'LOGOUT',
      resourceType: 'AUTH_SESSION',
      resourceId: user.sessionId ?? null,
    });

    return {
      success: true,
    };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    userId: string,
    tenantId: string | null,
    role: string,
    sessionId: string,
    impersonation?: { impersonatedBy: string; originalSessionId: string | null },
  ) {
    const payload = {
      userId,
      tenantId,
      role,
      sessionId,
      // Present only while viewing as someone else. The real actor travels
      // inside the token so returning does not depend on the client holding on
      // to the admin's own token.
      ...(impersonation ?? {}),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      sessionId,
    };
  }

  /**
   * Issue a token that acts as another user in the same tenant.
   *
   * Permissions are resolved server-side from the token's userId on every
   * request, so a token minted for the target grants exactly their access —
   * no module needs to know impersonation exists. What the token adds is the
   * real actor, so writes can be attributed and the session can be handed back.
   */
  async impersonate(actor: { userId: string; tenantId: string | null; sessionId: string | null; impersonatedBy?: string }, targetUserId: string, request?: any) {
    if (actor.impersonatedBy) {
      throw new ForbiddenException('Already viewing as another user');
    }
    if (actor.userId === targetUserId) {
      throw new BadRequestException('You are already signed in as this user');
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId: actor.tenantId },
      include: { tenant: true },
    });
    if (!target) {
      throw new NotFoundException('User not found in this tenant');
    }
    if (target.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot view as a deactivated user');
    }
    // SUPER_ADMIN bypasses every permission check, so impersonating one would
    // escalate a tenant admin to platform-wide access.
    if (target.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('This user cannot be impersonated');
    }

    const targetAccess = await this.effectiveAccessService.resolveUserAccess({
      userId: target.id,
      tenantId: actor.tenantId,
      basePermissions: [],
    });
    // Blocked both ways round: chaining through another admin would put every
    // account in the tenant one hop away from a single compromised session.
    if (targetAccess.permissions.includes('user.impersonate')) {
      throw new ForbiddenException('Cannot view as a user who can impersonate others');
    }

    const sessionId = crypto.randomUUID();
    const tokens = await this.generateTokens(
      target.id,
      target.tenantId,
      target.role,
      sessionId,
      { impersonatedBy: actor.userId, originalSessionId: actor.sessionId },
    );

    await this.recordImpersonationAudit(request, {
      tenantId: actor.tenantId,
      actorId: actor.userId,
      action: 'IMPERSONATION_STARTED',
      targetUserId: target.id,
      sessionId,
    });

    return {
      user: this.sanitizeUser(target),
      tenant: target.tenant ? this.sanitizeTenant(target.tenant) : null,
      impersonatedBy: actor.userId,
      ...tokens,
    };
  }

  /** Hand the session back to the admin who started it. */
  async stopImpersonation(actor: { userId: string; tenantId: string | null; impersonatedBy?: string }, request?: any) {
    if (!actor.impersonatedBy) {
      throw new BadRequestException('This session is not viewing as another user');
    }

    const admin = await this.prisma.user.findFirst({
      where: { id: actor.impersonatedBy },
      include: { tenant: true },
    });
    if (!admin || admin.status !== 'ACTIVE') {
      throw new UnauthorizedException('The original session is no longer valid');
    }

    const sessionId = crypto.randomUUID();
    const tokens = await this.generateTokens(admin.id, admin.tenantId, admin.role, sessionId);

    await this.recordImpersonationAudit(request, {
      tenantId: admin.tenantId,
      actorId: admin.id,
      action: 'IMPERSONATION_ENDED',
      targetUserId: actor.userId,
      sessionId,
    });

    return {
      user: this.sanitizeUser(admin),
      tenant: admin.tenant ? this.sanitizeTenant(admin.tenant) : null,
      ...tokens,
    };
  }

  private async recordImpersonationAudit(request: any, params: {
    tenantId: string | null;
    actorId: string;
    action: string;
    targetUserId: string;
    sessionId: string;
  }) {
    if (!params.tenantId) return;
    await this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.actorId,
        action: params.action,
        resource: 'user',
        resourceId: params.targetUserId,
        changes: { targetUserId: params.targetUserId, sessionId: params.sessionId },
        ipAddress: request?.ip ?? null,
        userAgent: request?.headers?.['user-agent'] ?? null,
      },
    });
  }

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Remove sensitive data from tenant object
   */
  private sanitizeTenant(tenant: any) {
    const { encryptionKey, ...sanitized } = tenant;
    return sanitized;
  }

  private async hasWmsWorkspaceAccess(userId: string) {
    const assignment = await this.prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        workspace: 'WMS',
      },
      select: { id: true },
    });

    return Boolean(assignment);
  }
}
