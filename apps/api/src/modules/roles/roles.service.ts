import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import {
  AssignablePermissionWorkspace,
  filterPermissionKeysByWorkspace,
  permissionKeysMatchWorkspace,
  roleBelongsToWorkspace,
  rolePrimaryWorkspace,
  type PermissionWorkspace,
} from '../../common/rbac/permission-workspace';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  private getContext() {
    const tenantId = this.cls.get('tenantId');
    const role = this.cls.get('userRole');
    const userId = this.cls.get('userId');
    if (!tenantId && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Tenant context is required');
    }
    return { tenantId, role, userId };
  }

  private assertPermissionKeysWorkspace(
    permissionKeys: string[] | undefined,
    workspace: AssignablePermissionWorkspace,
  ) {
    if (!permissionKeys?.length) {
      return;
    }

    if (!permissionKeysMatchWorkspace(permissionKeys, workspace)) {
      throw new ForbiddenException(
        `Role permissions must stay inside the ${workspace.toUpperCase()} workspace`,
      );
    }
  }

  private assertWorkspaceAccess(workspace: PermissionWorkspace) {
    const { role } = this.getContext();

    if (workspace !== 'erp' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('WMS roles are managed outside the ERP workspace');
    }
  }

  async list(workspace: PermissionWorkspace = 'erp') {
    this.assertWorkspaceAccess(workspace);
    const { tenantId, role } = this.getContext();
    // SUPER_ADMIN sees all, otherwise system + tenant-specific
    const where =
      role === 'SUPER_ADMIN'
        ? {}
        : {
            OR: [{ tenantId: null }, { tenantId }],
          };
    const roles = await this.prisma.role.findMany({
      where,
      orderBy: [{ tenantId: 'asc' }, { createdAt: 'desc' }],
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    return roles
      .filter((roleRecord) => roleBelongsToWorkspace(roleRecord, workspace))
      .map((roleRecord) => ({
        ...roleRecord,
        workspace: rolePrimaryWorkspace(roleRecord),
        permissions: filterPermissionKeysByWorkspace(
          roleRecord.rolePermissions.map((rolePermission) => rolePermission.permission.key),
          workspace,
        ),
        rolePermissions: undefined,
      }));
  }

  async listPermissions(workspace: PermissionWorkspace = 'erp') {
    this.assertWorkspaceAccess(workspace);
    const permissions = await this.prisma.permission.findMany({
      orderBy: { key: 'asc' },
    });

    return permissions.filter((permission) =>
      filterPermissionKeysByWorkspace([permission.key], workspace).length > 0,
    );
  }

  async create(dto: CreateRoleDto, workspace: AssignablePermissionWorkspace) {
    this.assertWorkspaceAccess(workspace);
    const { tenantId, role } = this.getContext();
    const isSystem = dto.isSystem ?? false;

    if (isSystem && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only platform administrators can create system roles');
    }

    const targetTenantId = isSystem ? null : tenantId;
    this.assertPermissionKeysWorkspace(dto.permissionKeys, workspace);

    const created = await this.prisma.role.create({
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description || null,
        isSystem,
        scope: 'TENANT',
        tenantId: targetTenantId,
        rolePermissions: dto.permissionKeys?.length
          ? {
              create: dto.permissionKeys.map((permKey) => ({
                permission: {
                  connect: { key: permKey },
                },
              })),
            }
          : undefined,
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    return {
      ...created,
      workspace: rolePrimaryWorkspace(created),
      permissions: filterPermissionKeysByWorkspace(
        created.rolePermissions.map((rolePermission) => rolePermission.permission.key),
        workspace,
      ),
      rolePermissions: undefined,
    };
  }

  async update(id: string, dto: UpdateRoleDto, workspace: AssignablePermissionWorkspace) {
    this.assertWorkspaceAccess(workspace);
    const { tenantId, role } = this.getContext();

    const existing = await this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }
    if (existing.tenantId && existing.tenantId !== tenantId && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot modify role from another tenant');
    }
    if (!roleBelongsToWorkspace(existing, workspace)) {
      throw new ForbiddenException('Cannot modify a role from another workspace');
    }
    this.assertPermissionKeysWorkspace(dto.permissionKeys, workspace);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
        },
      });

      if (dto.permissionKeys) {
        // Reset and reattach permissions
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        for (const permKey of dto.permissionKeys) {
          const perm = await tx.permission.findUnique({ where: { key: permKey } });
          if (perm) {
            await tx.rolePermission.create({
              data: { roleId: id, permissionId: perm.id },
            });
          }
        }
      }

      const finalRole = await tx.role.findUnique({
        where: { id },
        include: { rolePermissions: { include: { permission: true } } },
      });

      return finalRole!;
    });

    return {
      ...updated,
      workspace: rolePrimaryWorkspace(updated),
      permissions: filterPermissionKeysByWorkspace(
        updated.rolePermissions.map((rolePermission) => rolePermission.permission.key),
        workspace,
      ),
      rolePermissions: undefined,
    };
  }

  async remove(id: string, workspace: AssignablePermissionWorkspace) {
    this.assertWorkspaceAccess(workspace);
    const { tenantId, role } = this.getContext();
    const existing = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }
    if (existing.tenantId && existing.tenantId !== tenantId && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot delete role from another tenant');
    }
    if (!roleBelongsToWorkspace(existing, workspace)) {
      throw new ForbiddenException('Cannot delete a role from another workspace');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.userRoleAssignment.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
    });

    return { success: true };
  }
}
