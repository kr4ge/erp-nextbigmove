import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient, RbacWorkspace, RoleScope } from '@prisma/client';
import * as bcrypt from 'bcrypt';

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), '../../.env'));

const prisma = new PrismaClient();

type RoleDef = {
  key: string;
  name: string;
  description?: string;
  scope: RoleScope;
  permissions: string[];
  workspace?: RbacWorkspace;
  isSystem?: boolean;
};

const WMS_PERMISSION_KEYS = [
  'wms.core.read',
  'wms.purchasing.read',
  'wms.purchasing.write',
  'wms.purchasing.edit',
  'wms.purchasing.delete',
  'wms.purchasing.post_receiving',
  'wms.warehouses.read',
  'wms.warehouses.write',
  'wms.warehouses.edit',
  'wms.warehouses.delete',
  'wms.products.read',
  'wms.products.write',
  'wms.products.edit',
  'wms.products.delete',
  'wms.products.sync',
  'wms.receiving.read',
  'wms.receiving.write',
  'wms.receiving.edit',
  'wms.receiving.delete',
  'wms.receiving.manual_input',
  'wms.receiving.print_labels',
  'wms.inventory.read',
  'wms.inventory.write',
  'wms.inventory.edit',
  'wms.inventory.delete',
  'wms.inventory.print_labels',
  'wms.inventory.transfer',
  'wms.inventory.adjust',
  'wms.fulfillment.read',
  'wms.fulfillment.write',
  'wms.fulfillment.edit',
  'wms.fulfillment.delete',
  'wms.fulfillment.override',
  'wms.dispatch.read',
  'wms.dispatch.write',
  'wms.dispatch.edit',
  'wms.dispatch.delete',
  'wms.dispatch.override',
  'wms.rts.read',
  'wms.rts.write',
  'wms.rts.edit',
  'wms.rts.delete',
  'wms.rts.disposition',
  'wms.forecast.read',
  'wms.forecast.write',
  'wms.forecast.edit',
  'wms.forecast.delete',
] as const;

const PERMISSIONS: { key: string; description: string }[] = [
  { key: 'tenant.manage', description: 'Manage tenant settings' },
  { key: 'team.manage', description: 'Create/update teams' },
  { key: 'team.read', description: 'Read teams' },
  { key: 'team.read_all', description: 'View all teams and their data' },
  { key: 'user.manage', description: 'Manage users within tenant' },
  { key: 'user.read', description: 'Read users within tenant' },
  { key: 'permission.assign', description: 'Assign roles and permissions' },
  { key: 'role.read', description: 'Read roles and permissions' },
  { key: 'integration.create', description: 'Create integrations' },
  { key: 'integration.read', description: 'Read integrations' },
  { key: 'integration.update', description: 'Update integrations' },
  { key: 'integration.webhook.read', description: 'Read Pancake webhook settings' },
  { key: 'integration.webhook.update', description: 'Manage Pancake webhook settings' },
  { key: 'integration.webhook.rotate', description: 'Rotate Pancake webhook API key' },
  { key: 'integration.delete', description: 'Delete integrations' },
  { key: 'integration.test', description: 'Test integrations' },
  { key: 'integration.share', description: 'Share integrations with other teams' },
  { key: 'workflow.create', description: 'Create workflows' },
  { key: 'workflow.read', description: 'Read workflows' },
  { key: 'workflow.update', description: 'Update workflows' },
  { key: 'workflow.delete', description: 'Delete workflows' },
  { key: 'workflow.execute', description: 'Execute workflows' },
  { key: 'workflow.view_executions', description: 'View workflow executions' },
  { key: 'workflow.share', description: 'Share workflows with other teams' },
  { key: 'pos.read', description: 'Read POS stores/orders/products' },
  { key: 'pos.cogs.manage', description: 'Manage POS COGS' },
  { key: 'meta.read', description: 'Read Meta ads/accounts/insights' },
  { key: 'analytics.marketing', description: 'Read marketing analytics dashboards' },
  { key: 'analytics.sales', description: 'Read sales analytics dashboards' },
  { key: 'analytics.sales_performance', description: 'Read sales performance analytics dashboards' },
  { key: 'analytics.share', description: 'Share analytics data with other teams' },
  { key: 'stock_request.read', description: 'Read ERP stock requests and WMS response queue' },
  { key: 'stock_request.write', description: 'Create ERP stock requests and respond to WMS revisions' },
  { key: 'reports.pos_orders.read', description: 'Read tenant-wide POS orders reports' },
  { key: 'dashboard.marketing', description: 'View marketing dashboard (my stats)' },
  { key: 'dashboard.marketing_leader', description: 'View marketing leader dashboard' },
  { key: 'dashboard.executives', description: 'View executives dashboard (sales overview)' },
  { key: 'dashboard.sales', description: 'View sales dashboard (my stats)' },
  { key: 'kpi.marketing.read', description: 'Read marketing KPI pages and widgets' },
  { key: 'kpi.marketing.manage', description: 'Manage marketing KPI targets and assignments' },
  { key: 'kpi.funnel.read', description: 'Read funnel KPI placeholder pages' },
  { key: 'kpi.sales.read', description: 'Read sales KPI placeholder pages' },
  { key: 'wms.core.read', description: 'Access the WMS workspace shell and stock-truth foundation' },
  { key: 'wms.purchasing.read', description: 'Read WMS purchasing batches and requests' },
  { key: 'wms.purchasing.write', description: 'Create WMS purchasing batches and requests' },
  { key: 'wms.purchasing.edit', description: 'Edit WMS purchasing batches and requests' },
  { key: 'wms.purchasing.delete', description: 'Delete WMS purchasing batches and requests' },
  { key: 'wms.purchasing.post_receiving', description: 'Post purchasing batches into stock receiving' },
  { key: 'wms.warehouses.read', description: 'Read WMS warehouses and locations' },
  { key: 'wms.warehouses.write', description: 'Create WMS warehouses and locations' },
  { key: 'wms.warehouses.edit', description: 'Edit WMS warehouses and locations' },
  { key: 'wms.warehouses.delete', description: 'Delete WMS warehouses and locations' },
  { key: 'wms.products.read', description: 'Read WMS product profiles' },
  { key: 'wms.products.write', description: 'Create WMS product profiles' },
  { key: 'wms.products.edit', description: 'Edit WMS product profiles' },
  { key: 'wms.products.delete', description: 'Delete WMS product profiles' },
  { key: 'wms.products.sync', description: 'Sync WMS product profiles from connected stores' },
  { key: 'wms.receiving.read', description: 'Read WMS receiving batches' },
  { key: 'wms.receiving.write', description: 'Create WMS receiving batches' },
  { key: 'wms.receiving.edit', description: 'Edit WMS receiving batches' },
  { key: 'wms.receiving.delete', description: 'Delete WMS receiving batches' },
  { key: 'wms.receiving.manual_input', description: 'Create manual stock input in WMS receiving' },
  { key: 'wms.receiving.print_labels', description: 'Print and reprint WMS receiving batch labels' },
  { key: 'wms.inventory.read', description: 'Read WMS inventory units and stock views' },
  { key: 'wms.inventory.write', description: 'Create WMS inventory records' },
  { key: 'wms.inventory.edit', description: 'Edit WMS inventory records' },
  { key: 'wms.inventory.delete', description: 'Delete WMS inventory records' },
  { key: 'wms.inventory.print_labels', description: 'Print and reprint WMS unit labels' },
  { key: 'wms.inventory.transfer', description: 'Transfer WMS inventory between locations' },
  { key: 'wms.inventory.adjust', description: 'Adjust WMS inventory balances and unit states' },
  { key: 'wms.fulfillment.read', description: 'Read WMS fulfillment workflows' },
  { key: 'wms.fulfillment.write', description: 'Create WMS fulfillment workflows' },
  { key: 'wms.fulfillment.edit', description: 'Edit WMS fulfillment workflows' },
  { key: 'wms.fulfillment.delete', description: 'Delete WMS fulfillment workflows' },
  { key: 'wms.fulfillment.override', description: 'Override WMS fulfillment workflow states' },
  { key: 'wms.dispatch.read', description: 'Read WMS dispatch workflows' },
  { key: 'wms.dispatch.write', description: 'Create WMS dispatch workflows' },
  { key: 'wms.dispatch.edit', description: 'Edit WMS dispatch workflows' },
  { key: 'wms.dispatch.delete', description: 'Delete WMS dispatch workflows' },
  { key: 'wms.dispatch.override', description: 'Override WMS dispatch workflow states' },
  { key: 'wms.rts.read', description: 'Read WMS RTS workflows' },
  { key: 'wms.rts.write', description: 'Create WMS RTS workflows' },
  { key: 'wms.rts.edit', description: 'Edit WMS RTS workflows' },
  { key: 'wms.rts.delete', description: 'Delete WMS RTS workflows' },
  { key: 'wms.rts.disposition', description: 'Apply RTS disposition actions in WMS' },
  { key: 'wms.forecast.read', description: 'Read WMS forecast adapter views' },
  { key: 'wms.forecast.write', description: 'Create WMS forecast adapter records' },
  { key: 'wms.forecast.edit', description: 'Edit WMS forecast adapter records' },
  { key: 'wms.forecast.delete', description: 'Delete WMS forecast adapter records' },
];

const ROLES: RoleDef[] = [
  {
    key: 'TENANT_ADMIN',
    name: 'Tenant Admin',
    description: 'Admin across all teams',
    scope: RoleScope.TENANT,
    permissions: [
      'tenant.manage',
      'team.manage',
      'team.read',
      'team.read_all',
      'user.manage',
      'user.read',
      'permission.assign',
      'role.read',
      'integration.create',
      'integration.read',
      'integration.update',
      'integration.webhook.read',
      'integration.webhook.update',
      'integration.delete',
      'integration.test',
      'integration.share',
      'workflow.create',
      'workflow.read',
      'workflow.update',
      'workflow.delete',
      'workflow.execute',
      'workflow.view_executions',
      'workflow.share',
      'pos.read',
      'pos.cogs.manage',
      'meta.read',
      'analytics.marketing',
      'analytics.sales',
      'analytics.sales_performance',
      'analytics.share',
      'stock_request.read',
      'stock_request.write',
      'reports.pos_orders.read',
      'dashboard.executives',
      'kpi.marketing.read',
      'kpi.marketing.manage',
      'kpi.funnel.read',
      'kpi.sales.read',
    ],
    isSystem: true,
  },
  {
    key: 'TEAM_LEAD',
    name: 'Team Lead',
    description: 'Manage team members and data for their team',
    scope: RoleScope.TEAM,
    permissions: [
      'team.manage',
      'team.read',
      'user.manage',
      'user.read',
      'permission.assign',
      'role.read',
      'integration.create',
      'integration.read',
      'integration.update',
      'integration.webhook.read',
      'integration.webhook.update',
      'integration.test',
      'integration.share',
      'workflow.create',
      'workflow.read',
      'workflow.update',
      'workflow.delete',
      'workflow.execute',
      'workflow.view_executions',
      'workflow.share',
      'pos.read',
      'pos.cogs.manage',
      'meta.read',
      'analytics.marketing',
      'analytics.sales',
      'analytics.sales_performance',
      'stock_request.read',
      'stock_request.write',
      'dashboard.marketing_leader',
      'kpi.marketing.read',
      'kpi.marketing.manage',
    ],
    isSystem: true,
  },
  {
    key: 'MARKETING',
    name: 'Marketing',
    description: 'Marketing-focused access',
    scope: RoleScope.TEAM,
    permissions: [
      'integration.create',
      'integration.read',
      'integration.update',
      'integration.test',
      'workflow.create',
      'workflow.read',
      'workflow.update',
      'workflow.delete',
      'workflow.execute',
      'workflow.view_executions',
      'pos.read',
      'pos.cogs.manage',
      'meta.read',
      'dashboard.marketing',
    ],
    isSystem: true,
  },
  {
    key: 'SALES',
    name: 'Sales',
    description: 'Sales-focused access',
    scope: RoleScope.TEAM,
    permissions: ['dashboard.sales'],
    isSystem: true,
  },
  {
    key: 'WMS_ADMIN',
    name: 'WMS Admin',
    description: 'Full access to warehouse management operations',
    scope: RoleScope.TENANT,
    permissions: [...WMS_PERMISSION_KEYS],
    isSystem: true,
  },
  {
    key: 'WMS_OPERATOR',
    name: 'WMS Operator',
    description: 'Operational WMS access for daily warehouse workflows',
    scope: RoleScope.TENANT,
    permissions: [
      'wms.core.read',
      'wms.purchasing.read',
      'wms.purchasing.edit',
      'wms.purchasing.post_receiving',
      'wms.warehouses.read',
      'wms.warehouses.edit',
      'wms.products.read',
      'wms.products.edit',
      'wms.products.sync',
      'wms.receiving.read',
      'wms.receiving.write',
      'wms.receiving.edit',
      'wms.receiving.manual_input',
      'wms.receiving.print_labels',
      'wms.inventory.read',
      'wms.inventory.write',
      'wms.inventory.edit',
      'wms.inventory.print_labels',
      'wms.inventory.transfer',
      'wms.inventory.adjust',
      'wms.fulfillment.read',
      'wms.fulfillment.write',
      'wms.fulfillment.edit',
      'wms.dispatch.read',
      'wms.dispatch.write',
      'wms.dispatch.edit',
      'wms.rts.read',
      'wms.rts.write',
      'wms.rts.edit',
      'wms.rts.disposition',
      'wms.forecast.read',
    ],
    isSystem: true,
  },
  {
    key: 'WMS_VIEWER',
    name: 'WMS Viewer',
    description: 'Read-only WMS access',
    scope: RoleScope.TENANT,
    permissions: [
      'wms.core.read',
      'wms.purchasing.read',
      'wms.warehouses.read',
      'wms.products.read',
      'wms.receiving.read',
      'wms.inventory.read',
      'wms.fulfillment.read',
      'wms.dispatch.read',
      'wms.rts.read',
      'wms.forecast.read',
    ],
    isSystem: true,
  },
  {
    key: 'FUNNEL',
    name: 'Funnel',
    description: 'Funnel/analytics view',
    scope: RoleScope.TEAM,
    permissions: [
      'integration.create',
      'integration.read',
      'integration.update',
      'integration.webhook.read',
      'integration.webhook.update',
      'integration.test',
      'workflow.create',
      'workflow.read',
      'workflow.update',
      'workflow.delete',
      'workflow.execute',
      'workflow.view_executions',
      'pos.read',
      'pos.cogs.manage',
      'meta.read',
      'dashboard.marketing',
      'kpi.funnel.read',
      'integration.share',
      'team.manage',
    ],
    isSystem: true,
  },
];

function getRoleWorkspace(role: RoleDef): RbacWorkspace {
  if (role.workspace) {
    return role.workspace;
  }

  if (role.key.startsWith('WMS_') || role.permissions.every((permissionKey) => permissionKey.startsWith('wms.'))) {
    return RbacWorkspace.WMS;
  }

  return RbacWorkspace.ERP;
}

async function ensureSuperAdmin() {
  // Use environment variables for production, fallback to dev defaults
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'superadmin@platform.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'SuperAdmin123!';
  const adminFirstName = process.env.SEED_ADMIN_FIRST_NAME || 'Platform';
  const adminLastName = process.env.SEED_ADMIN_LAST_NAME || 'Administrator';

  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: 'SUPER_ADMIN',
      email: adminEmail,
    },
  });

  if (existingSuperAdmin) {
    console.log('SUPER_ADMIN user already exists. Skipping creation.');
    return existingSuperAdmin;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const superAdmin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  console.log('✓ Created SUPER_ADMIN user:');
  console.log(`  Email: ${adminEmail}`);
  console.log('  Password: [hidden]');
  return superAdmin;
}

async function seedPermissions() {
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: { key: perm.key, description: perm.description },
    });
  }
  console.log(`✓ Ensured ${PERMISSIONS.length} permissions`);
}

async function seedRoles() {
  // Remove deprecated TENANT_OWNER role if present
  const tenantOwner = await prisma.role.findFirst({ where: { key: 'TENANT_OWNER' } });
  if (tenantOwner) {
    await prisma.rolePermission.deleteMany({ where: { roleId: tenantOwner.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { roleId: tenantOwner.id } });
    await prisma.role.delete({ where: { id: tenantOwner.id } });
    console.log('✓ Removed deprecated TENANT_OWNER role');
  }

  for (const role of ROLES) {
    let createdRole = await prisma.role.findFirst({
      where: {
        tenantId: null,
        key: role.key,
      },
    });

    if (!createdRole) {
      createdRole = await prisma.role.create({
        data: {
          tenantId: null,
          key: role.key,
          name: role.name,
          description: role.description,
          scope: role.scope,
          workspace: getRoleWorkspace(role),
          isSystem: role.isSystem ?? false,
        },
      });
    } else {
      // Keep role attributes in sync
      createdRole = await prisma.role.update({
        where: { id: createdRole.id },
        data: {
          name: role.name,
          description: role.description,
          scope: role.scope,
          workspace: getRoleWorkspace(role),
          isSystem: role.isSystem ?? false,
        },
      });
    }

    // Sync permissions for the role
    const permRecords = await prisma.permission.findMany({
      where: { key: { in: role.permissions } },
      select: { id: true, key: true },
    });

    const existingRolePerms = await prisma.rolePermission.findMany({
      where: { roleId: createdRole.id },
      include: {
        permission: {
          select: {
            id: true,
            key: true,
          },
        },
      },
    });
    const existing = new Set(existingRolePerms.map((rp) => rp.permissionId));
    const desiredPermissionIds = new Set(permRecords.map((perm) => perm.id));

    const stalePermissionIds = existingRolePerms
      .filter((rolePermission) => !desiredPermissionIds.has(rolePermission.permissionId))
      .map((rolePermission) => rolePermission.permissionId);

    if (stalePermissionIds.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: createdRole.id,
          permissionId: { in: stalePermissionIds },
        },
      });
    }

    for (const perm of permRecords) {
      if (!existing.has(perm.id)) {
        await prisma.rolePermission.create({
          data: {
            roleId: createdRole.id,
            permissionId: perm.id,
          },
        });
      }
    }
  }

  console.log(`✓ Ensured ${ROLES.length} roles and their permissions`);
}

async function ensureDefaultTeamsAndBackfill() {
  // Default team creation/backfill disabled per request
  console.log('✓ Skipped default team creation/backfill (per request)');
}

async function main() {
  console.log('Starting database seed...');
  await ensureSuperAdmin();
  await seedPermissions();
  await seedRoles();
  await ensureDefaultTeamsAndBackfill();
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
