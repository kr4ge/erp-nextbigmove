import { PrismaClient, RoleScope } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type RoleDef = {
  key: string;
  name: string;
  description?: string;
  scope: RoleScope;
  permissions: string[];
  isSystem?: boolean;
};

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
  { key: 'dashboard.marketing', description: 'View marketing dashboard (my stats)' },
  { key: 'dashboard.marketing_leader', description: 'View marketing leader dashboard' },
  { key: 'dashboard.executives', description: 'View executives dashboard (sales overview)' },
  { key: 'dashboard.sales', description: 'View sales dashboard (my stats)' },
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
      'dashboard.executives',
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
      'dashboard.marketing_leader',
    ],
    isSystem: true,
  },
  {
    key: 'TEAM_MEMBER',
    name: 'Team Member',
    description: 'Baseline access for team members',
    scope: RoleScope.TEAM,
    permissions: [
      'integration.read',
      'workflow.read',
      'workflow.execute',
      'workflow.view_executions',
      'pos.read',
      'meta.read',
      'analytics.marketing',
      'analytics.sales',
      'analytics.sales_performance',
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
    permissions: ['pos.read', 'analytics.sales', 'analytics.sales_performance', 'dashboard.sales'],
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
];

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
      select: { permissionId: true },
    });
    const existing = new Set(existingRolePerms.map((rp) => rp.permissionId));
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

async function assignRolesToUsers() {
  // Map enum roles to dynamic roles
  const roleMap: Record<string, string> = {
    SUPER_ADMIN: 'TENANT_OWNER', // Platform-level still uses enum; keep assignment for tenant context
    ADMIN: 'TENANT_ADMIN',
    USER: 'TEAM_MEMBER',
    VIEWER: 'TEAM_MEMBER',
  };

  const roles = await prisma.role.findMany({
    where: { tenantId: null, key: { in: Object.values(roleMap) } },
    select: { id: true, key: true },
  });
  const roleIdByKey = roles.reduce<Record<string, string>>((acc, r) => {
    acc[r.key] = r.id;
    return acc;
  }, {});

  const tenants = await prisma.tenant.findMany({
    select: { id: true },
  });

  for (const tenant of tenants) {
    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, role: true, defaultTeamId: true },
    });

    for (const user of users) {
      const dynamicRoleKey = roleMap[user.role] || 'TEAM_MEMBER';
      const roleId = roleIdByKey[dynamicRoleKey];
      if (!roleId) {
        continue;
      }

      // Assign tenant-scoped role
      const existingTenantRole = await prisma.userRoleAssignment.findFirst({
        where: {
          userId: user.id,
          roleId,
          tenantId: tenant.id,
          teamId: null,
        },
      });
      if (!existingTenantRole) {
        await prisma.userRoleAssignment.create({
          data: {
            userId: user.id,
            roleId,
            tenantId: tenant.id,
            teamId: null,
          },
        });
      }

      // Assign team-scoped role for default team
      if (user.defaultTeamId) {
        const existingTeamRole = await prisma.userRoleAssignment.findFirst({
          where: {
            userId: user.id,
            roleId,
            tenantId: tenant.id,
            teamId: user.defaultTeamId,
          },
        });
        if (!existingTeamRole) {
          await prisma.userRoleAssignment.create({
            data: {
              userId: user.id,
              roleId,
              tenantId: tenant.id,
              teamId: user.defaultTeamId,
            },
          });
        }
      }
    }
  }

  console.log('✓ Assigned dynamic roles to users based on existing enum roles');
}

async function main() {
  console.log('Starting database seed...');
  await ensureSuperAdmin();
  await seedPermissions();
  await seedRoles();
  await ensureDefaultTeamsAndBackfill();
  await assignRolesToUsers();
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
