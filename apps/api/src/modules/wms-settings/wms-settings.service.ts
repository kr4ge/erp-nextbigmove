import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RbacWorkspace, RoleScope, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWmsSettingsRoleDto, UpdateWmsSettingsRoleDto } from './dto/wms-settings-role.dto';
import { CreateWmsSettingsUserDto, UpdateWmsSettingsUserDto } from './dto/wms-settings-user.dto';

type WmsSettingsUser = {
  id?: string;
  userId?: string;
  role?: string;
  tenantId?: string | null;
};

type WmsSettingsScope = {
  isPlatformAdmin: boolean;
  tenantId: string | null;
};

type WmsSettingsRoleRecord = Prisma.RoleGetPayload<{
  include: {
    tenant: {
      select: {
        id: true;
        name: true;
        slug: true;
      };
    };
    rolePermissions: {
      include: {
        permission: true;
      };
    };
    _count: {
      select: {
        userAssignments: true;
      };
    };
  };
}>;

@Injectable()
export class WmsSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(user: WmsSettingsUser, request?: Request) {
    const scope = this.resolveScope(user, request);
    const roleAssignmentScope: Prisma.UserRoleAssignmentWhereInput = {
      workspace: RbacWorkspace.WMS,
      tenantId: null,
    };

    const users = await this.prisma.user.findMany({
      where: {
        tenantId: null,
        userRoleAssignments: {
          some: roleAssignmentScope,
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        role: true,
        status: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        lastLoginAt: true,
        createdAt: true,
        userRoleAssignments: {
          where: roleAssignmentScope,
          select: {
            id: true,
            workspace: true,
            tenantId: true,
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            role: {
              select: {
                id: true,
                key: true,
                name: true,
                scope: true,
                workspace: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: {
                        key: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        userPermissionAssignments: {
          where: {
            permission: {
              key: {
                startsWith: 'wms.',
              },
            },
            tenantId: null,
          },
          select: {
            allow: true,
            tenantId: true,
            permission: {
              select: {
                key: true,
                description: true,
              },
            },
          },
        },
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
        { email: 'asc' },
      ],
    });

    return {
      scope,
      users: users.map((record) => ({
        id: record.id,
        email: record.email,
        firstName: record.firstName,
        lastName: record.lastName,
        displayName: this.getDisplayName(record),
        employeeId: record.employeeId,
        platformRole: record.role,
        status: record.status,
        tenant: record.tenant,
        lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
        wmsRoles: record.userRoleAssignments.map((assignment) => ({
          assignmentId: assignment.id,
          tenant: assignment.tenant,
          role: {
            id: assignment.role.id,
            key: assignment.role.key,
            name: assignment.role.name,
            scope: assignment.role.scope,
            workspace: assignment.role.workspace,
            permissionCount: assignment.role.rolePermissions.length,
          },
        })),
        directPermissions: record.userPermissionAssignments
          .map((assignment) => ({
            key: assignment.permission.key,
            description: assignment.permission.description,
            allow: assignment.allow,
            tenantId: assignment.tenantId,
          }))
          .sort((left, right) => left.key.localeCompare(right.key)),
      })),
    };
  }

  async listRoles(user: WmsSettingsUser, request?: Request) {
    const scope = this.resolveScope(user, request);
    const roleWhere: Prisma.RoleWhereInput = {
      workspace: RbacWorkspace.WMS,
      tenantId: null,
    };

    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany({
        where: roleWhere,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          rolePermissions: {
            include: {
              permission: true,
            },
          },
          _count: {
            select: {
              userAssignments: true,
            },
          },
        },
        orderBy: [
          { isSystem: 'desc' },
          { name: 'asc' },
        ],
      }),
      this.prisma.permission.findMany({
        where: {
          key: {
            startsWith: 'wms.',
          },
        },
        orderBy: {
          key: 'asc',
        },
      }),
    ]);

    return {
      scope,
      roles: roles.map((role) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        scope: role.scope,
        workspace: role.workspace,
        isSystem: role.isSystem,
        tenant: role.tenant,
        permissionCount: role.rolePermissions.length,
        assignedUserCount: role._count.userAssignments,
        permissions: role.rolePermissions
          .map((rolePermission) => ({
            key: rolePermission.permission.key,
            description: rolePermission.permission.description,
          }))
          .sort((left, right) => left.key.localeCompare(right.key)),
      })),
      permissions: permissions.map((permission) => ({
        id: permission.id,
        key: permission.key,
        description: permission.description,
      })),
    };
  }

  async getRoleOptions(user: WmsSettingsUser, request?: Request) {
    const scope = this.resolveScope(user, request);
    const permissions = await this.prisma.permission.findMany({
        where: {
          key: {
            startsWith: 'wms.',
          },
        },
        orderBy: { key: 'asc' },
      });

    return {
      scope,
      permissions: permissions.map((permission) => ({
        id: permission.id,
        key: permission.key,
        description: permission.description,
      })),
    };
  }

  async getRole(user: WmsSettingsUser, id: string, request?: Request) {
    const scope = this.resolveScope(user, request);
    const role = await this.findWmsRoleRecordForScope(id, scope);
    return { role: this.mapRoleRecord(role) };
  }

  async createRole(user: WmsSettingsUser, dto: CreateWmsSettingsRoleDto, request?: Request) {
    this.resolveScope(user, request);
    const key = this.normalizeWmsRoleKey(dto.key);
    const permissionKeys = await this.resolveWmsPermissionKeys(dto.permissionKeys);

    const existing = await this.prisma.role.findFirst({
      where: {
        tenantId: null,
        workspace: RbacWorkspace.WMS,
        key,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('WMS role key already exists');
    }

    const role = await this.prisma.role.create({
      data: {
        tenantId: null,
        key,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        scope: RoleScope.GLOBAL,
        workspace: RbacWorkspace.WMS,
        isSystem: false,
        rolePermissions: {
          create: permissionKeys.map((permissionKey) => ({
            permission: {
              connect: { key: permissionKey },
            },
          })),
        },
      },
      include: this.roleInclude(),
    });

    return { role: this.mapRoleRecord(role) };
  }

  async updateRole(
    user: WmsSettingsUser,
    id: string,
    dto: UpdateWmsSettingsRoleDto,
    request?: Request,
  ) {
    const scope = this.resolveScope(user, request);
    const existing = await this.findWmsRoleRecordForScope(id, scope);
    this.assertCustomRoleMutable(existing);

    const key = dto.key !== undefined ? this.normalizeWmsRoleKey(dto.key) : undefined;
    const permissionKeys = dto.permissionKeys !== undefined
      ? await this.resolveWmsPermissionKeys(dto.permissionKeys)
      : null;

    if (key && key !== existing.key) {
      const duplicate = await this.prisma.role.findFirst({
        where: {
          id: { not: id },
          tenantId: null,
          workspace: RbacWorkspace.WMS,
          key,
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException('WMS role key already exists');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(key !== undefined ? { key } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          scope: RoleScope.GLOBAL,
        },
      });

      if (permissionKeys !== null) {
        const permissions = await tx.permission.findMany({
          where: { key: { in: permissionKeys } },
          select: { id: true, key: true },
        });
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        for (const permission of permissions) {
          await tx.rolePermission.create({
            data: {
              roleId: id,
              permissionId: permission.id,
            },
          });
        }
      }

      return tx.role.findUniqueOrThrow({
        where: { id },
        include: this.roleInclude(),
      });
    });

    return { role: this.mapRoleRecord(updated) };
  }

  async deleteRole(user: WmsSettingsUser, id: string, request?: Request) {
    const scope = this.resolveScope(user, request);
    const existing = await this.findWmsRoleRecordForScope(id, scope);
    this.assertCustomRoleMutable(existing);

    if (existing._count.userAssignments > 0) {
      throw new ForbiddenException('Cannot delete a WMS role while users still use it');
    }

    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }

  async getUserOptions(user: WmsSettingsUser, request?: Request) {
    const scope = this.resolveScope(user, request);
    const roleWhere: Prisma.RoleWhereInput = {
      workspace: RbacWorkspace.WMS,
      tenantId: null,
    };

    const roles = await this.prisma.role.findMany({
        where: roleWhere,
        select: {
          id: true,
          tenantId: true,
          key: true,
          name: true,
          scope: true,
          isSystem: true,
        },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      });

    return {
      scope,
      roles,
      statuses: Object.values(UserStatus),
    };
  }

  async getUser(user: WmsSettingsUser, id: string, request?: Request) {
    const scope = this.resolveScope(user, request);
    const record = await this.findWmsUserForScope(id, scope);
    return { user: this.mapUserRecord(record) };
  }

  async createUser(user: WmsSettingsUser, dto: CreateWmsSettingsUserDto, request?: Request) {
    const scope = this.resolveScope(user, request);
    const email = dto.email.trim().toLowerCase();
    const [existing, role] = await Promise.all([
      this.prisma.user.findFirst({
        where: { email, tenantId: null },
        select: { id: true },
      }),
      this.findWmsRole(dto.roleId),
    ]);

    if (existing) {
      throw new ConflictException('Email already exists in WMS staff accounts');
    }

    const password = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          password,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          employeeId: dto.employeeId?.trim() || null,
          tenantId: null,
          role: 'USER',
          status: (dto.status as UserStatus | undefined) ?? UserStatus.ACTIVE,
        },
      });

      await tx.userRoleAssignment.create({
        data: {
          userId: newUser.id,
          roleId: role.id,
          workspace: RbacWorkspace.WMS,
          tenantId: null,
        },
      });

      return newUser;
    });

    const record = await this.findWmsUserForScope(created.id, scope);
    return { user: this.mapUserRecord(record) };
  }

  async updateUser(
    user: WmsSettingsUser,
    id: string,
    dto: UpdateWmsSettingsUserDto,
    request?: Request,
  ) {
    const scope = this.resolveScope(user, request);
    await this.findWmsUserForScope(id, scope);

    const role = dto.roleId ? await this.findWmsRole(dto.roleId) : null;
    const password = dto.password ? await bcrypt.hash(dto.password, 10) : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
          ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId?.trim() || null } : {}),
          ...(dto.status !== undefined ? { status: dto.status as UserStatus } : {}),
          ...(password ? { password } : {}),
        },
      });

      if (role) {
        await tx.userRoleAssignment.deleteMany({
          where: {
            userId: id,
            workspace: RbacWorkspace.WMS,
          },
        });

        await tx.userRoleAssignment.create({
          data: {
            userId: id,
            roleId: role.id,
            workspace: RbacWorkspace.WMS,
            tenantId: null,
          },
        });
      }

    });

    const record = await this.findWmsUserForScope(id, scope);
    return { user: this.mapUserRecord(record) };
  }

  async deactivateUser(user: WmsSettingsUser, id: string, request?: Request) {
    const scope = this.resolveScope(user, request);
    await this.findWmsUserForScope(id, scope);

    await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.INACTIVE,
      },
    });

    const record = await this.findWmsUserForScope(id, scope);
    return { user: this.mapUserRecord(record) };
  }

  private resolveScope(user: WmsSettingsUser, _request?: Request): WmsSettingsScope {
    const isPlatformAdmin = user.role === 'SUPER_ADMIN';

    return {
      isPlatformAdmin,
      tenantId: null,
    };
  }

  private getDisplayName(user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  }) {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fullName || user.email;
  }

  private roleInclude() {
    return {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      rolePermissions: {
        include: {
          permission: true,
        },
      },
      _count: {
        select: {
          userAssignments: true,
        },
      },
    } satisfies Prisma.RoleInclude;
  }

  private async findWmsRoleRecordForScope(id: string, scope: WmsSettingsScope) {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        workspace: RbacWorkspace.WMS,
        tenantId: null,
      },
      include: this.roleInclude(),
    });

    if (!role) {
      throw new NotFoundException('WMS role not found');
    }

    return role;
  }

  private mapRoleRecord(role: WmsSettingsRoleRecord) {
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      scope: role.scope,
      workspace: role.workspace,
      isSystem: role.isSystem,
      tenant: role.tenant,
      permissionCount: role.rolePermissions.length,
      assignedUserCount: role._count.userAssignments,
      permissions: role.rolePermissions
        .map((rolePermission) => ({
          key: rolePermission.permission.key,
          description: rolePermission.permission.description,
        }))
        .sort((left, right) => left.key.localeCompare(right.key)),
    };
  }

  private assertCustomRoleMutable(role: WmsSettingsRoleRecord) {
    if (role.isSystem) {
      throw new ForbiddenException('System WMS roles are managed by code and cannot be changed here');
    }
  }

  private normalizeWmsRoleKey(key: string) {
    const normalized = key
      .trim()
      .toUpperCase()
      .replace(/-/g, '_')
      .replace(/_+/g, '_');

    return normalized.startsWith('WMS_') ? normalized : `WMS_${normalized}`;
  }

  private async resolveWmsPermissionKeys(permissionKeys: string[]) {
    const uniqueKeys = Array.from(new Set(permissionKeys.map((key) => key.trim()).filter(Boolean))).sort();
    if (uniqueKeys.length === 0) {
      throw new ForbiddenException('At least one WMS permission is required');
    }

    if (uniqueKeys.some((key) => !key.startsWith('wms.'))) {
      throw new ForbiddenException('Role permissions must stay inside the WMS workspace');
    }

    const existingPermissions = await this.prisma.permission.findMany({
      where: {
        key: {
          in: uniqueKeys,
        },
      },
      select: {
        key: true,
      },
    });

    if (existingPermissions.length !== uniqueKeys.length) {
      throw new NotFoundException('One or more WMS permissions were not found');
    }

    return uniqueKeys;
  }

  private async findWmsRole(roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        workspace: RbacWorkspace.WMS,
        tenantId: null,
      },
      select: {
        id: true,
      },
    });

    if (!role) {
      throw new NotFoundException('WMS role not found');
    }

    return role;
  }

  private async findWmsUserForScope(id: string, scope: WmsSettingsScope) {
    const roleAssignmentScope: Prisma.UserRoleAssignmentWhereInput = {
      workspace: RbacWorkspace.WMS,
      tenantId: null,
    };

    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId: null,
        userRoleAssignments: {
          some: roleAssignmentScope,
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        role: true,
        status: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        lastLoginAt: true,
        createdAt: true,
        userRoleAssignments: {
          where: roleAssignmentScope,
          select: {
            id: true,
            workspace: true,
            tenantId: true,
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            role: {
              select: {
                id: true,
                key: true,
                name: true,
                scope: true,
                workspace: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: {
                        key: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        userPermissionAssignments: {
          where: {
            permission: {
              key: {
                startsWith: 'wms.',
              },
            },
            tenantId: null,
          },
          select: {
            allow: true,
            tenantId: true,
            permission: {
              select: {
                key: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('WMS staff user not found');
    }

    return user;
  }

  private mapUserRecord(record: Awaited<ReturnType<WmsSettingsService['findWmsUserForScope']>>) {
    return {
      id: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      displayName: this.getDisplayName(record),
      employeeId: record.employeeId,
      platformRole: record.role,
      status: record.status,
      tenant: record.tenant,
      lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      wmsRoles: record.userRoleAssignments.map((assignment) => ({
        assignmentId: assignment.id,
        tenant: assignment.tenant,
        role: {
          id: assignment.role.id,
          key: assignment.role.key,
          name: assignment.role.name,
          scope: assignment.role.scope,
          workspace: assignment.role.workspace,
          permissionCount: assignment.role.rolePermissions.length,
        },
      })),
      directPermissions: record.userPermissionAssignments
        .map((assignment) => ({
          key: assignment.permission.key,
          description: assignment.permission.description,
          allow: assignment.allow,
          tenantId: assignment.tenantId,
        }))
        .sort((left, right) => left.key.localeCompare(right.key)),
    };
  }
}
