import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request, Patch, BadRequestException, UnauthorizedException, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, UpdateProfileDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { PermissionWorkspaceQueryDto } from '../../common/dto/permission-workspace-query.dto';
import {
  normalizePermissionWorkspace,
  roleBelongsToWorkspace,
  type PermissionWorkspace,
} from '../../common/rbac/permission-workspace';
import { EffectiveAccessService } from '../../common/services/effective-access.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly effectiveAccessService: EffectiveAccessService,
  ) {}

  /**
   * Register a new tenant and admin user
   * POST /api/v1/auth/register
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Request() req) {
    return this.authService.login(loginDto, req);
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  /**
   * Logout current user session
   * POST /api/v1/auth/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req) {
    return this.authService.logout(req.user, req);
  }

  /**
   * Get current user
   * GET /api/v1/auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return {
      user: req.user,
    };
  }

  /**
   * Update current user's profile (name, avatar, optional password)
   * PATCH /api/v1/auth/profile
   */
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() body: UpdateProfileDto) {
    const userId = req.user.userId || req.user.id;
    const tenantId = req.user.tenantId;
    if (!userId) {
      throw new UnauthorizedException('User not found in token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || (tenantId && user.tenantId !== tenantId)) {
      throw new UnauthorizedException('User not found');
    }

    const updateData: any = {};

    if (body.firstName !== undefined) {
      updateData.firstName = body.firstName.trim();
    }
    if (body.lastName !== undefined) {
      updateData.lastName = body.lastName.trim();
    }
    if (body.avatar !== undefined) {
      updateData.avatar = body.avatar?.trim() || null;
    }
    if (body.employeeId !== undefined) {
      updateData.employeeId = body.employeeId?.trim() || null;
    }

    if (body.newPassword !== undefined) {
      if (!body.currentPassword) {
        throw new BadRequestException('Current password is required to set a new password');
      }
      const isCurrentValid = await bcrypt.compare(body.currentPassword, user.password);
      if (!isCurrentValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      updateData.password = await bcrypt.hash(body.newPassword, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const { password, ...sanitized } = updated;
    return { user: sanitized };
  }

  /**
   * Get current user's effective permissions
   * GET /api/v1/auth/permissions
   */
  @Get('permissions')
  @UseGuards(JwtAuthGuard)
  async getPermissions(@Request() req, @Query() query: PermissionWorkspaceQueryDto) {
    const user = req.user;
    const userId = user.userId || user.id;
    const tenantId = user.tenantId;
    const workspace = normalizePermissionWorkspace(query.workspace);
    const headerTeamId = req.headers['x-team-id'] as string | undefined;
    const requestedTeamIds = headerTeamId
      ? headerTeamId
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    if (!userId || (!tenantId && workspace !== 'wms')) {
      return { permissions: [] };
    }

    const access = await this.effectiveAccessService.resolveUserAccess({
      userId,
      ...(tenantId ? { tenantId } : {}),
      basePermissions: Array.isArray(user.permissions) ? user.permissions : [],
      requestedTeamIds,
      workspace,
    });

    return {
      permissions: access.permissions,
    };
  }

  /**
   * Get current user's roles (tenant-scoped)
   * GET /api/v1/auth/my-role
   */
  @Get('my-role')
  @UseGuards(JwtAuthGuard)
  async getMyRole(@Request() req, @Query() query: PermissionWorkspaceQueryDto) {
    const userId = req.user.userId || req.user.id;
    const tenantId = req.user.tenantId;

    const workspace: PermissionWorkspace = query.workspace
      ? normalizePermissionWorkspace(query.workspace)
      : 'all';

    if (!userId || (!tenantId && workspace !== 'wms')) {
      return { roles: [] };
    }

    const access = await this.effectiveAccessService.resolveUserAccess({
      userId,
      ...(tenantId ? { tenantId } : {}),
      basePermissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      workspace,
    });

    const roles = access.roles
      .filter((role) => roleBelongsToWorkspace(role, workspace))
      .map((role) => ({ id: role.id, key: role.key, name: role.name, scope: role.scope }));

    return { roles };
  }
}
