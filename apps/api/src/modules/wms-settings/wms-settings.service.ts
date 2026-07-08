import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RbacWorkspace, RoleScope, UserStatus, WmsStaffAssignmentTaskType } from '@prisma/client';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MediaAssetsService, type UploadedImageFile } from '../../common/services/media-assets.service';
import { CreateWmsSettingsRoleDto, UpdateWmsSettingsRoleDto } from './dto/wms-settings-role.dto';
import { CreateWmsSettingsUserDto, UpdateWmsSettingsUserDto } from './dto/wms-settings-user.dto';
import {
  UpdateWmsInvoiceSettingsDto,
  UpdateWmsInvoiceTenantBillingDto,
} from './dto/update-wms-invoice-settings.dto';

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

const GLOBAL_WMS_INVOICE_SETTINGS_SCOPE = 'GLOBAL';

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

const WMS_PICK_ASSIGNMENT_PERMISSIONS = [
  'wms.fulfillment.write',
  'wms.fulfillment.edit',
  'wms.fulfillment.override',
] as const;

const WMS_PACK_ASSIGNMENT_PERMISSIONS = [
  'wms.dispatch.write',
  'wms.dispatch.edit',
  'wms.dispatch.override',
] as const;

const WMS_INVENTORY_ASSIGNMENT_PERMISSIONS = [
  'wms.inventory.transfer',
  'wms.inventory.edit',
  'wms.inventory.write',
  'wms.receiving.edit',
  'wms.receiving.write',
] as const;

@Injectable()
export class WmsSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaAssetsService: MediaAssetsService,
  ) {}

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
        wmsStaffAssignment: {
          select: {
            id: true,
            taskType: true,
            createdAt: true,
            updatedAt: true,
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
        taskAssignment: record.wmsStaffAssignment
          ? {
              id: record.wmsStaffAssignment.id,
              taskType: record.wmsStaffAssignment.taskType,
              createdAt: record.wmsStaffAssignment.createdAt.toISOString(),
              updatedAt: record.wmsStaffAssignment.updatedAt.toISOString(),
            }
          : null,
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
      taskAssignmentTypes: Object.values(WmsStaffAssignmentTaskType),
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
    const taskAssignmentType = this.normalizeTaskAssignmentType(dto.taskAssignmentType);
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

    this.assertTaskAssignmentSupported(
      taskAssignmentType,
      this.getRolePermissionKeys(role),
      [],
    );

    const password = await bcrypt.hash(dto.password, 10);
    const actorId = user.userId ?? user.id ?? null;
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

      if (taskAssignmentType) {
        await tx.wmsStaffAssignment.create({
          data: {
            userId: newUser.id,
            taskType: taskAssignmentType,
            assignedById: actorId,
          },
        });
      }

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
    const existing = await this.findWmsUserForScope(id, scope);

    const role = dto.roleId ? await this.findWmsRole(dto.roleId) : null;
    const password = dto.password ? await bcrypt.hash(dto.password, 10) : null;
    const nextRole = role ?? this.findAssignedWmsRole(existing);
    const directPermissionAssignments = existing.userPermissionAssignments.map((assignment) => ({
      key: assignment.permission.key,
      allow: assignment.allow,
    }));
    const requestedTaskAssignmentType = Object.prototype.hasOwnProperty.call(dto, 'taskAssignmentType')
      ? this.normalizeTaskAssignmentType(dto.taskAssignmentType)
      : undefined;
    let nextTaskAssignmentType = requestedTaskAssignmentType ?? existing.wmsStaffAssignment?.taskType ?? null;

    if (nextTaskAssignmentType && !this.canUseTaskAssignment(
      nextTaskAssignmentType,
      this.getRolePermissionKeys(nextRole),
      directPermissionAssignments,
    )) {
      if (requestedTaskAssignmentType !== undefined) {
        throw new ForbiddenException(
          `Selected WMS role does not allow ${nextTaskAssignmentType.toLowerCase()} assignment`,
        );
      }

      nextTaskAssignmentType = null;
    }

    const actorId = user.userId ?? user.id ?? null;

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

      if (nextTaskAssignmentType) {
        await tx.wmsStaffAssignment.upsert({
          where: { userId: id },
          create: {
            userId: id,
            taskType: nextTaskAssignmentType,
            assignedById: actorId,
          },
          update: {
            taskType: nextTaskAssignmentType,
            assignedById: actorId,
          },
        });
      } else {
        await tx.wmsStaffAssignment.deleteMany({
          where: { userId: id },
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

  async getInvoiceSettings(
    user: WmsSettingsUser,
    _requestedTenantId?: string,
    request?: Request,
  ) {
    const scope = this.resolveScope(user, request);
    const settings = await this.prisma.wmsInvoiceSettings.findUnique({
      where: { scopeKey: GLOBAL_WMS_INVOICE_SETTINGS_SCOPE },
      include: {
        logoAsset: {
          select: {
            id: true,
            objectKey: true,
            contentType: true,
            byteSize: true,
            width: true,
            height: true,
            originalFileName: true,
          },
        },
      },
    });

    return {
      scope,
      settings: {
        companyName: settings?.companyName ?? null,
        companyAddress: settings?.companyAddress ?? null,
        logoAsset: settings?.logoAsset
          ? {
              id: settings.logoAsset.id,
              imageUrl: await this.mediaAssetsService.createSignedAssetUrl(settings.logoAsset),
              contentType: settings.logoAsset.contentType,
              byteSize: settings.logoAsset.byteSize,
              width: settings.logoAsset.width ?? null,
              height: settings.logoAsset.height ?? null,
              originalFileName: settings.logoAsset.originalFileName ?? null,
            }
          : null,
        invoicePrefix: settings?.invoicePrefix ?? 'INV',
        bankName: settings?.bankName ?? null,
        bankAccountName: settings?.bankAccountName ?? null,
        bankAccountNumber: settings?.bankAccountNumber ?? null,
        bankAccountType: settings?.bankAccountType ?? null,
        bankBranch: settings?.bankBranch ?? null,
        paymentInstructions: settings?.paymentInstructions ?? null,
        footerNotes: settings?.footerNotes ?? null,
      },
    };
  }

  async listInvoicePartners(user: WmsSettingsUser, request?: Request) {
    const scope = this.resolveScope(user, request);
    const tenants = await this.prisma.tenant.findMany({
      where: scope.tenantId ? { id: scope.tenantId } : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        billingCompanyName: true,
        billingAddress: true,
      },
      orderBy: [
        { name: 'asc' },
        { slug: 'asc' },
      ],
    });

    return {
      scope,
      partners: tenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        billingCompanyName: tenant.billingCompanyName ?? null,
        billingAddress: tenant.billingAddress ?? null,
      })),
    };
  }

  async updateInvoiceSettings(
    user: WmsSettingsUser,
    dto: UpdateWmsInvoiceSettingsDto,
    _requestedTenantId?: string,
    request?: Request,
  ) {
    const scope = this.resolveScope(user, request);
    const actorId = user.userId ?? user.id ?? null;

    const logoAsset = dto.logoAssetId !== undefined && dto.logoAssetId !== null
      ? await this.mediaAssetsService.assertGlobalInvoiceLogoAsset(dto.logoAssetId)
      : null;

    const updated = await this.prisma.wmsInvoiceSettings.upsert({
      where: { scopeKey: GLOBAL_WMS_INVOICE_SETTINGS_SCOPE },
      update: {
        companyName:
          dto.companyName !== undefined ? this.cleanOptionalText(dto.companyName) : undefined,
        companyAddress:
          dto.companyAddress !== undefined ? this.cleanOptionalText(dto.companyAddress) : undefined,
        logoAssetId:
          dto.logoAssetId !== undefined ? (logoAsset?.id ?? null) : undefined,
        invoicePrefix:
          dto.invoicePrefix !== undefined
            ? this.normalizeInvoicePrefix(dto.invoicePrefix)
            : undefined,
        bankName:
          dto.bankName !== undefined ? this.cleanOptionalText(dto.bankName) : undefined,
        bankAccountName:
          dto.bankAccountName !== undefined
            ? this.cleanOptionalText(dto.bankAccountName)
            : undefined,
        bankAccountNumber:
          dto.bankAccountNumber !== undefined
            ? this.cleanOptionalText(dto.bankAccountNumber)
            : undefined,
        bankAccountType:
          dto.bankAccountType !== undefined
            ? this.cleanOptionalText(dto.bankAccountType)
            : undefined,
        bankBranch:
          dto.bankBranch !== undefined ? this.cleanOptionalText(dto.bankBranch) : undefined,
        paymentInstructions:
          dto.paymentInstructions !== undefined
            ? this.cleanOptionalText(dto.paymentInstructions)
            : undefined,
        footerNotes:
          dto.footerNotes !== undefined ? this.cleanOptionalText(dto.footerNotes) : undefined,
        updatedById: actorId,
      },
      create: {
        scopeKey: GLOBAL_WMS_INVOICE_SETTINGS_SCOPE,
        companyName: this.cleanOptionalText(dto.companyName),
        companyAddress: this.cleanOptionalText(dto.companyAddress),
        logoAssetId: logoAsset?.id ?? null,
        invoicePrefix: this.normalizeInvoicePrefix(dto.invoicePrefix),
        bankName: this.cleanOptionalText(dto.bankName),
        bankAccountName: this.cleanOptionalText(dto.bankAccountName),
        bankAccountNumber: this.cleanOptionalText(dto.bankAccountNumber),
        bankAccountType: this.cleanOptionalText(dto.bankAccountType),
        bankBranch: this.cleanOptionalText(dto.bankBranch),
        paymentInstructions: this.cleanOptionalText(dto.paymentInstructions),
        footerNotes: this.cleanOptionalText(dto.footerNotes),
        createdById: actorId,
        updatedById: actorId,
      },
      include: {
        logoAsset: {
          select: {
            id: true,
            objectKey: true,
            contentType: true,
            byteSize: true,
            width: true,
            height: true,
            originalFileName: true,
          },
        },
      },
    });

    return {
      scope,
      settings: {
        companyName: updated.companyName ?? null,
        companyAddress: updated.companyAddress ?? null,
        logoAsset: updated.logoAsset
          ? {
              id: updated.logoAsset.id,
              imageUrl: await this.mediaAssetsService.createSignedAssetUrl(updated.logoAsset),
              contentType: updated.logoAsset.contentType,
              byteSize: updated.logoAsset.byteSize,
              width: updated.logoAsset.width ?? null,
              height: updated.logoAsset.height ?? null,
              originalFileName: updated.logoAsset.originalFileName ?? null,
            }
          : null,
        invoicePrefix: updated.invoicePrefix,
        bankName: updated.bankName ?? null,
        bankAccountName: updated.bankAccountName ?? null,
        bankAccountNumber: updated.bankAccountNumber ?? null,
        bankAccountType: updated.bankAccountType ?? null,
        bankBranch: updated.bankBranch ?? null,
        paymentInstructions: updated.paymentInstructions ?? null,
        footerNotes: updated.footerNotes ?? null,
      },
    };
  }

  async updateInvoicePartnerBilling(
    user: WmsSettingsUser,
    tenantId: string,
    dto: UpdateWmsInvoiceTenantBillingDto,
    request?: Request,
  ) {
    const scope = this.resolveScope(user, request);
    if (scope.tenantId && scope.tenantId !== tenantId) {
      throw new ForbiddenException('Selected partner is outside your WMS scope');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        billingCompanyName:
          dto.billingCompanyName !== undefined
            ? this.cleanOptionalText(dto.billingCompanyName)
            : undefined,
        billingAddress:
          dto.billingAddress !== undefined
            ? this.cleanOptionalText(dto.billingAddress)
            : undefined,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        billingCompanyName: true,
        billingAddress: true,
      },
    });

    return {
      partner: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        billingCompanyName: updated.billingCompanyName ?? null,
        billingAddress: updated.billingAddress ?? null,
      },
    };
  }

  async uploadInvoiceLogo(
    user: WmsSettingsUser,
    file: UploadedImageFile | undefined,
    _requestedTenantId?: string,
    request?: Request,
  ) {
    this.resolveScope(user, request);

    return {
      asset: await this.mediaAssetsService.uploadInvoiceLogoImage(file, null),
    };
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

  private normalizeInvoicePrefix(value?: string | null) {
    const normalized = value?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return normalized || 'INV';
  }

  private cleanOptionalText(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
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
        wmsStaffAssignment: {
          select: {
            id: true,
            taskType: true,
            createdAt: true,
            updatedAt: true,
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
      taskAssignment: record.wmsStaffAssignment
        ? {
            id: record.wmsStaffAssignment.id,
            taskType: record.wmsStaffAssignment.taskType,
            createdAt: record.wmsStaffAssignment.createdAt.toISOString(),
            updatedAt: record.wmsStaffAssignment.updatedAt.toISOString(),
          }
        : null,
    };
  }

  private findAssignedWmsRole(record: Awaited<ReturnType<WmsSettingsService['findWmsUserForScope']>>) {
    const assignedRole = record.userRoleAssignments[0]?.role;
    if (!assignedRole) {
      throw new NotFoundException('WMS role assignment was not found');
    }

    return assignedRole;
  }

  private getRolePermissionKeys(role: {
    rolePermissions: Array<{
      permission: {
        key: string;
      };
    }>;
  }) {
    return role.rolePermissions.map((rolePermission) => rolePermission.permission.key);
  }

  private canUseTaskAssignment(
    taskType: WmsStaffAssignmentTaskType,
    rolePermissionKeys: string[],
    directAssignments: Array<{ key: string; allow: boolean }>,
  ) {
    const effectivePermissions = new Set(rolePermissionKeys.filter((key) => key.startsWith('wms.')));

    directAssignments.forEach((assignment) => {
      if (assignment.allow) {
        effectivePermissions.add(assignment.key);
      } else {
        effectivePermissions.delete(assignment.key);
      }
    });

    const requiredPermissions = taskType === WmsStaffAssignmentTaskType.PICK
      ? WMS_PICK_ASSIGNMENT_PERMISSIONS
      : taskType === WmsStaffAssignmentTaskType.PACK
        ? WMS_PACK_ASSIGNMENT_PERMISSIONS
        : WMS_INVENTORY_ASSIGNMENT_PERMISSIONS;

    return requiredPermissions.some((permission) => effectivePermissions.has(permission));
  }

  private assertTaskAssignmentSupported(
    taskType: WmsStaffAssignmentTaskType | string | null,
    rolePermissionKeys: string[],
    directAssignments: Array<{ key: string; allow: boolean }>,
  ) {
    if (!taskType) {
      return;
    }

    if (!this.canUseTaskAssignment(taskType as WmsStaffAssignmentTaskType, rolePermissionKeys, directAssignments)) {
      throw new ForbiddenException(`Selected WMS role does not allow ${String(taskType).toLowerCase()} assignment`);
    }
  }

  private normalizeTaskAssignmentType(
    taskType: string | WmsStaffAssignmentTaskType | null | undefined,
  ): WmsStaffAssignmentTaskType | null {
    if (
      taskType === WmsStaffAssignmentTaskType.PICK
      || taskType === WmsStaffAssignmentTaskType.PACK
      || taskType === WmsStaffAssignmentTaskType.INVENTORY
    ) {
      return taskType;
    }

    return null;
  }
}
