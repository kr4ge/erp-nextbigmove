import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request, Patch, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, UpdateProfileDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
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
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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
  @UseGuards(JwtAuthGuard, TenantGuard)
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
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getPermissions(@Request() req) {
    const user = req.user;
    const userId = user.userId || user.id;
    const tenantId = user.tenantId;

    if (!userId || !tenantId) {
      return { permissions: [] };
    }

    const effectivePerms = new Set<string>();

    // Legacy permissions from user.permissions array
    if (Array.isArray(user.permissions)) {
      user.permissions.forEach((p: string) => effectivePerms.add(p));
    }

    // Role-based permissions via UserRoleAssignment
    const roleAssignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        userId,
        tenantId,
        teamId: null, // Only tenant-wide roles for admin pages
      },
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

    roleAssignments.forEach((assignment) => {
      assignment.role.rolePermissions.forEach((rp) => {
        effectivePerms.add(rp.permission.key);
      });
    });

    // User permission overrides
    const userPerms = await this.prisma.userPermissionAssignment.findMany({
      where: {
        userId,
        tenantId,
        teamId: null,
      },
      include: { permission: true },
    });

    userPerms.forEach((up) => {
      if (up.allow) {
        effectivePerms.add(up.permission.key);
      } else {
        effectivePerms.delete(up.permission.key);
      }
    });

    return {
      permissions: Array.from(effectivePerms),
    };
  }

  /**
   * Get current user's roles (tenant-scoped)
   * GET /api/v1/auth/my-role
   */
  @Get('my-role')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getMyRole(@Request() req) {
    const userId = req.user.userId || req.user.id;
    const tenantId = req.user.tenantId;
    if (!userId || !tenantId) {
      return { roles: [] };
    }

    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, tenantId },
      include: { role: true },
    });

    const roles = assignments
      .map((a) => a.role)
      .filter(Boolean)
      .map((r) => ({ id: r.id, key: r.key, name: r.name, scope: r.scope }));

    return { roles };
  }
}
