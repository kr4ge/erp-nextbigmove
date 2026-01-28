import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

      // Create admin user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          tenantId: tenant.id,
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: false,
        },
      });

      return { tenant, user };
    });

    // Generate tokens
    const tokens = await this.generateTokens(result.user.id, result.tenant.id, result.user.role);

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
  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const { password } = loginDto;

    // Find user by email (across all tenants)
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Check tenant status (skip for SUPER_ADMIN platform administrators)
    if (user.role !== 'SUPER_ADMIN') {
      if (!user.tenant || (user.tenant.status !== 'ACTIVE' && user.tenant.status !== 'TRIAL')) {
        throw new UnauthorizedException('Tenant account is not active');
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.tenantId, user.role);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
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

      // Check tenant status (skip for SUPER_ADMIN platform administrators)
      if (user.role !== 'SUPER_ADMIN') {
        if (!user.tenant || (user.tenant.status !== 'ACTIVE' && user.tenant.status !== 'TRIAL')) {
          throw new UnauthorizedException('Tenant account is not active');
        }
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id, user.tenantId, user.role);

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

    // Check tenant status (skip for SUPER_ADMIN platform administrators)
    if (user.role !== 'SUPER_ADMIN') {
      if (!user.tenant || (user.tenant.status !== 'ACTIVE' && user.tenant.status !== 'TRIAL')) {
        throw new UnauthorizedException('Tenant account is not active');
      }
    }

    return user;
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(userId: string, tenantId: string | null, role: string) {
    const payload = {
      userId,
      tenantId,
      role,
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
    };
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
}
