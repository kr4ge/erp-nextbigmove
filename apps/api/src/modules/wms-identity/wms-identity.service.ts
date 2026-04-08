import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWmsRoleDto } from './dto/create-wms-role.dto';
import { CreateWmsUserDto } from './dto/create-wms-user.dto';
import { UpdateWmsRoleDto } from './dto/update-wms-role.dto';
import { UpdateWmsUserDto } from './dto/update-wms-user.dto';

@Injectable()
export class WmsIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({
      where: { tenantId: null },
      orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        userRoleAssignments: {
          where: {
            tenantId: null,
            teamId: null,
            role: {
              scope: 'GLOBAL',
            },
          },
          select: {
            role: {
              select: {
                id: true,
                key: true,
                name: true,
                isSystem: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    return users.map((user) => ({
      ...user,
      assignedRole: user.userRoleAssignments[0]?.role || null,
      userRoleAssignments: undefined,
    }));
  }

  private async assertGlobalRole(roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId: null,
        scope: 'GLOBAL',
      },
      select: {
        id: true,
        key: true,
        name: true,
      },
    });

    if (!role) {
      throw new NotFoundException('Global WMS role not found');
    }

    return role;
  }

  async createUser(dto: CreateWmsUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    if (!dto.roleId) {
      throw new ForbiddenException('Role selection is required');
    }

    await this.assertGlobalRole(dto.roleId);
    const password = await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: 'USER',
          status: (dto.status as any) || 'ACTIVE',
          tenantId: null,
          emailVerified: true,
        },
      });

      await tx.userRoleAssignment.create({
        data: {
          userId: user.id,
          roleId: dto.roleId!,
          tenantId: null,
          teamId: null,
        },
      });

      return user.id;
    });

    const users = await this.listUsers();
    const createdUser = users.find((user) => user.id === created);
    if (!createdUser) {
      throw new NotFoundException('Created user could not be loaded');
    }
    return createdUser;
  }

  async updateUser(id: string, dto: UpdateWmsUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId: null },
      select: { id: true, role: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (dto.email) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      const duplicate = await this.prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException('Email already exists');
      }
    }

    if (dto.roleId) {
      await this.assertGlobalRole(dto.roleId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
          ...(dto.status !== undefined ? { status: dto.status as any } : {}),
          ...(dto.password ? { password: await bcrypt.hash(dto.password, 10) } : {}),
        },
      });

      if (dto.roleId !== undefined && existing.role !== 'SUPER_ADMIN') {
        await tx.userRoleAssignment.deleteMany({
          where: {
            userId: id,
            tenantId: null,
            teamId: null,
          },
        });

        if (dto.roleId) {
          await tx.userRoleAssignment.create({
            data: {
              userId: id,
              roleId: dto.roleId,
              tenantId: null,
              teamId: null,
            },
          });
        }
      }
    });

    const users = await this.listUsers();
    const updatedUser = users.find((user) => user.id === id);
    if (!updatedUser) {
      throw new NotFoundException('Updated user could not be loaded');
    }
    return updatedUser;
  }

  async removeUser(id: string, actingUserId: string) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId: null },
      select: { id: true, role: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (existing.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('SuperAdmin accounts cannot be removed here');
    }

    if (existing.id === actingUserId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({
        where: {
          userId: id,
          tenantId: null,
          teamId: null,
        },
      });
      await tx.user.delete({ where: { id } });
    });

    return { success: true };
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      where: {
        tenantId: null,
        scope: 'GLOBAL',
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.rolePermissions.map((item) => item.permission.key),
    }));
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      where: {
        key: {
          startsWith: 'wms.',
        },
      },
      orderBy: { key: 'asc' },
    });
  }

  async createRole(dto: CreateWmsRoleDto) {
    const key = dto.key.trim().toUpperCase();
    const existing = await this.prisma.role.findFirst({
      where: { tenantId: null, key },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Role key already exists');
    }

    await this.prisma.role.create({
      data: {
        tenantId: null,
        scope: 'GLOBAL',
        isSystem: false,
        key,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        rolePermissions: dto.permissionKeys?.length
          ? {
              create: dto.permissionKeys.map((permissionKey) => ({
                permission: {
                  connect: { key: permissionKey },
                },
              })),
            }
          : undefined,
      },
    });

    const roles = await this.listRoles();
    const createdRole = roles.find((role) => role.key === key);
    if (!createdRole) {
      throw new NotFoundException('Created role could not be loaded');
    }
    return createdRole;
  }

  async updateRole(id: string, dto: UpdateWmsRoleDto) {
    const existing = await this.prisma.role.findFirst({
      where: {
        id,
        tenantId: null,
        scope: 'GLOBAL',
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        },
      });

      if (dto.permissionKeys) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        for (const permissionKey of dto.permissionKeys) {
          const permission = await tx.permission.findUnique({
            where: { key: permissionKey },
            select: { id: true },
          });
          if (permission) {
            await tx.rolePermission.create({
              data: {
                roleId: id,
                permissionId: permission.id,
              },
            });
          }
        }
      }
    });

    const roles = await this.listRoles();
    const updatedRole = roles.find((role) => role.id === id);
    if (!updatedRole) {
      throw new NotFoundException('Updated role could not be loaded');
    }
    return updatedRole;
  }

  async removeRole(id: string) {
    const existing = await this.prisma.role.findFirst({
      where: {
        id,
        tenantId: null,
        scope: 'GLOBAL',
      },
      select: { id: true, isSystem: true },
    });

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    if (existing.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.userRoleAssignment.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
    });

    return { success: true };
  }
}
