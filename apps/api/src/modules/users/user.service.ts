import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenant() {
    const tenantId = this.cls.get('tenantId');
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return tenantId;
  }

  async create(dto: CreateUserDto) {
    const tenantId = this.getTenant();

    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, tenantId },
    });
    if (existing) {
      throw new ConflictException('Email already exists in this tenant');
    }

    // Check if roleId is TENANT_ADMIN
    let isTenantAdmin = false;
    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
        select: { key: true },
      });
      isTenantAdmin = role?.key === 'TENANT_ADMIN';
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    // If TENANT_ADMIN, don't assign defaultTeamId
    const finalTeamId = isTenantAdmin ? null : (dto.teamId || null);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashed,
        firstName: dto.firstName,
        lastName: dto.lastName,
        // Default new tenant users to legacy USER role; dynamic permissions are assigned via roleId
        role: 'USER',
        status: 'ACTIVE',
        tenantId,
        defaultTeamId: finalTeamId,
      },
    });

    // Only create team membership if not TENANT_ADMIN and teamId is provided
    if (!isTenantAdmin && dto.teamId) {
      await this.prisma.teamMembership.upsert({
        where: {
          tenantId_userId_teamId: { tenantId, userId: user.id, teamId: dto.teamId },
        },
        update: {
          status: 'ACTIVE',
          isDefault: true,
        },
        create: {
          tenantId,
          teamId: dto.teamId,
          userId: user.id,
          status: 'ACTIVE',
          isDefault: true,
        },
      });
    }

    // Tenant-scoped role assignment (dynamic roles table)
    if (dto.roleId) {
      // Remove any existing tenant-level assignments and then add the selected one
      await this.prisma.userRoleAssignment.deleteMany({
        where: { userId: user.id, tenantId, teamId: null },
      });
      await this.prisma.userRoleAssignment.create({
        data: {
          userId: user.id,
          roleId: dto.roleId,
          tenantId,
          teamId: null,
        },
      });
    }

    // Team-scoped role assignment
    if (dto.teamRoleId && dto.teamId) {
      await this.prisma.userRoleAssignment.upsert({
        where: {
          userId_roleId_tenantId_teamId: {
            userId: user.id,
            roleId: dto.teamRoleId,
            tenantId,
            teamId: dto.teamId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: dto.teamRoleId,
          tenantId,
          teamId: dto.teamId,
        },
      });
    }

    return user;
  }

  async findAll() {
    const tenantId = this.getTenant();
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        defaultTeamId: true,
        createdAt: true,
        lastLoginAt: true,
        userRoleAssignments: {
          select: {
            roleId: true,
            teamId: true,
            role: { select: { id: true, name: true, key: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const tenantId = this.getTenant();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if roleId is being set to TENANT_ADMIN
    let isTenantAdmin = false;
    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
        select: { key: true },
      });
      isTenantAdmin = role?.key === 'TENANT_ADMIN';
    }

    // If assigning TENANT_ADMIN role, automatically clear defaultTeamId
    const finalDefaultTeamId = isTenantAdmin
      ? null
      : (dto.defaultTeamId !== undefined ? dto.defaultTeamId : undefined);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.role !== undefined ? { role: dto.role as any } : {}),
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
        ...(finalDefaultTeamId !== undefined ? { defaultTeamId: finalDefaultTeamId } : {}),
      },
    });

    // Handle team membership changes
    if (!isTenantAdmin && dto.defaultTeamId !== undefined) {
      if (dto.defaultTeamId) {
        // Deactivate all existing team memberships for this user (except the new one)
        await this.prisma.teamMembership.updateMany({
          where: {
            tenantId,
            userId: id,
            teamId: { not: dto.defaultTeamId },
            status: 'ACTIVE',
          },
          data: {
            status: 'INACTIVE',
            isDefault: false,
          },
        });

        // Create or activate the new team membership
        await this.prisma.teamMembership.upsert({
          where: {
            tenantId_userId_teamId: { tenantId, userId: id, teamId: dto.defaultTeamId },
          },
          update: {
            status: 'ACTIVE',
            isDefault: true,
          },
          create: {
            tenantId,
            teamId: dto.defaultTeamId,
            userId: id,
            status: 'ACTIVE',
            isDefault: true,
          },
        });
      } else {
        // If defaultTeamId is null/empty, deactivate all team memberships
        await this.prisma.teamMembership.updateMany({
          where: {
            tenantId,
            userId: id,
            status: 'ACTIVE',
          },
          data: {
            status: 'INACTIVE',
            isDefault: false,
          },
        });
      }
    }

    // Update tenant-scoped role assignment if provided
    if (dto.roleId !== undefined) {
      // Clear existing tenant-scoped assignments
      await this.prisma.userRoleAssignment.deleteMany({
        where: { userId: id, tenantId, teamId: null },
      });
      if (dto.roleId) {
        await this.prisma.userRoleAssignment.create({
          data: {
            userId: id,
            roleId: dto.roleId,
            tenantId,
            teamId: null,
          },
        });
      }
    }

    // Update team-scoped role assignment if provided alongside teamId
    if (dto.teamRoleId && dto.teamId) {
      await this.prisma.userRoleAssignment.upsert({
        where: {
          userId_roleId_tenantId_teamId: {
            userId: id,
            roleId: dto.teamRoleId,
            tenantId,
            teamId: dto.teamId,
          },
        },
        update: {},
        create: {
          userId: id,
          roleId: dto.teamRoleId,
          tenantId,
          teamId: dto.teamId,
        },
      });
    }

    return updated;
  }

  async remove(id: string) {
    const tenantId = this.getTenant();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }
}
