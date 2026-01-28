import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new tenant with admin user from admin panel
   */
  async createTenant(createTenantDto: CreateTenantDto) {
    const {
      tenantName,
      tenantSlug,
      email,
      password,
      firstName,
      lastName,
      planType,
      status,
      maxUsers,
      maxIntegrations,
      trialDays,
    } = createTenantDto;

    // Check if tenant slug already exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant slug already exists');
    }

    // Check if user email already exists (across all tenants)
    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate per-tenant encryption key
    const encryptionKey = crypto.randomBytes(32).toString('hex');

    // Create tenant and admin user in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug: tenantSlug,
          encryptionKey,
          status: status as any,
          planType,
          maxUsers,
          maxIntegrations,
        },
      });

      // Create tenant ADMIN user (not SUPER_ADMIN)
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          tenantId: tenant.id,
          role: 'ADMIN', // Tenant admin, not platform SUPER_ADMIN
          status: 'ACTIVE',
        },
      });

      // Assign TENANT_ADMIN role to the owner user
      const tenantAdminRole = await tx.role.findFirst({
        where: { key: 'TENANT_ADMIN', tenantId: null },
      });

      if (tenantAdminRole) {
        await tx.userRoleAssignment.create({
          data: {
            userId: user.id,
            roleId: tenantAdminRole.id,
            tenantId: tenant.id,
            teamId: null,
          },
        });
      }

      return { tenant, user };
    });

    return {
      tenant: this.sanitizeTenant(result.tenant),
      user: this.sanitizeUser(result.user),
    };
  }

  /**
   * Get all tenants with user and integration counts
   */
  async findAll() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            integrations: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tenants.map((tenant) => this.sanitizeTenant(tenant));
  }

  /**
   * Get a single tenant by ID
   */
  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            integrations: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.sanitizeTenant(tenant);
  }

  /**
   * Update a tenant
   */
  async update(id: string, updateTenantDto: UpdateTenantDto) {
    // Check if tenant exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      throw new NotFoundException('Tenant not found');
    }

    // If slug is being updated, check for conflicts
    if (updateTenantDto.slug && updateTenantDto.slug !== existingTenant.slug) {
      const slugConflict = await this.prisma.tenant.findUnique({
        where: { slug: updateTenantDto.slug },
      });

      if (slugConflict) {
        throw new ConflictException('Tenant slug already exists');
      }
    }

    // Update tenant
    const updatedTenant = await this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto as any,
      include: {
        _count: {
          select: {
            users: true,
            integrations: true,
          },
        },
      },
    });

    return this.sanitizeTenant(updatedTenant);
  }

  /**
   * Delete a tenant (soft delete by setting status to CANCELLED)
   */
  async remove(id: string) {
    // Check if tenant exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      throw new NotFoundException('Tenant not found');
    }

    // For now, we'll do a soft delete by setting status to CANCELLED
    // In production, you might want to actually delete or archive the data
    const deletedTenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });

    return this.sanitizeTenant(deletedTenant);
  }

  /**
   * Get tenant statistics
   */
  async getStats() {
    const [total, active, trial, suspended, cancelled] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tenant.count({ where: { status: 'TRIAL' } }),
      this.prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.tenant.count({ where: { status: 'CANCELLED' } }),
    ]);

    return {
      total,
      active,
      trial,
      suspended,
      cancelled,
    };
  }

  /**
   * Remove sensitive data from tenant object
   */
  private sanitizeTenant(tenant: any) {
    const { encryptionKey, ...sanitized } = tenant;
    return sanitized;
  }

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}
