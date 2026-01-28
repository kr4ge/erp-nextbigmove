import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

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

  async list() {
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
    return roles.map((r) => ({
      ...r,
      permissions: r.rolePermissions.map((rp) => rp.permission.key),
      rolePermissions: undefined,
    }));
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async create(dto: CreateRoleDto) {
    const { tenantId, role } = this.getContext();
    const isSystem = dto.isSystem ?? false;

    if (isSystem && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only platform administrators can create system roles');
    }

    const targetTenantId = isSystem ? null : tenantId;

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
      permissions: created.rolePermissions.map((rp) => rp.permission.key),
      rolePermissions: undefined,
    };
  }

  async update(id: string, dto: UpdateRoleDto) {
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
      permissions: updated.rolePermissions.map((rp) => rp.permission.key),
      rolePermissions: undefined,
    };
  }

  async remove(id: string) {
    const { tenantId, role } = this.getContext();
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }
    if (existing.tenantId && existing.tenantId !== tenantId && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot delete role from another tenant');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.userRoleAssignment.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
    });

    return { success: true };
  }
}
