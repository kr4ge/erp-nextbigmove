import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient, RbacWorkspace, UserRole } from '@prisma/client';

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

async function backfillTenantAdmins() {
  const tenantAdminRole = await prisma.role.findFirst({
    where: {
      tenantId: null,
      key: 'TENANT_ADMIN',
      workspace: RbacWorkspace.ERP,
    },
    select: { id: true },
  });

  if (!tenantAdminRole) {
    throw new Error('TENANT_ADMIN system role is missing. Run the catalog seed first.');
  }

  const legacyAdmins = await prisma.user.findMany({
    where: {
      tenantId: { not: null },
      role: UserRole.ADMIN,
    },
    select: {
      id: true,
      tenantId: true,
    },
  });

  let createdCount = 0;

  for (const user of legacyAdmins) {
    if (!user.tenantId) {
      continue;
    }

    const existingTenantRole = await prisma.userRoleAssignment.findFirst({
      where: {
        userId: user.id,
        tenantId: user.tenantId,
        teamId: null,
        workspace: RbacWorkspace.ERP,
      },
      select: { id: true },
    });

    if (existingTenantRole) {
      continue;
    }

    await prisma.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId: tenantAdminRole.id,
        workspace: RbacWorkspace.ERP,
        tenantId: user.tenantId,
        teamId: null,
      },
    });
    createdCount += 1;
  }

  console.log(`✓ Backfilled ${createdCount} missing TENANT_ADMIN assignments`);
}

async function normalizeLegacyTenantRoles() {
  const result = await prisma.user.updateMany({
    where: {
      tenantId: { not: null },
      role: {
        in: [UserRole.ADMIN, UserRole.VIEWER],
      },
    },
    data: {
      role: UserRole.USER,
    },
  });

  console.log(`✓ Normalized ${result.count} tenant users to legacy USER role`);
}

async function main() {
  console.log('Starting RBAC bootstrap...');
  await backfillTenantAdmins();
  await normalizeLegacyTenantRoles();
  console.log('RBAC bootstrap completed successfully!');
}

main()
  .catch((error) => {
    console.error('Error during RBAC bootstrap:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
