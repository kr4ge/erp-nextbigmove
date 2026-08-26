/**
 * Grants the Advertising role its integrations, workflows, and reports access.
 *
 * This exists instead of running the full seed. The seed treats seed.ts as the
 * complete truth and DELETES any role permission absent from it, which on a
 * live database revokes permissions that were granted after the file was last
 * updated. A local run showed Tenant Admin dropping 60 -> 43 that way.
 *
 * This script only ever adds, only ever to CREATIVE_REVIEWER, and prints what
 * it would change before writing. Dry run by default; pass --apply to commit.
 */
import { PrismaClient } from '@prisma/client';

const ROLE_KEY = 'CREATIVE_REVIEWER';

const GRANTS = [
  'integration.create',
  'integration.read',
  'integration.update',
  'integration.test',
  'integration.share',
  'pos.read',
  'meta.read',
  'workflow.create',
  'workflow.read',
  'workflow.update',
  'workflow.execute',
  'workflow.view_executions',
  'reports.pos_orders.read',
];

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findFirst({
      where: { key: ROLE_KEY, tenantId: null },
      select: { id: true, name: true },
    });
    if (!role) throw new Error(`System role ${ROLE_KEY} not found`);

    const permissions = await prisma.permission.findMany({
      where: { key: { in: GRANTS } },
      select: { id: true, key: true },
    });
    const missingKeys = GRANTS.filter((key) => !permissions.some((p) => p.key === key));
    if (missingKeys.length) {
      throw new Error(`Permissions absent from this database: ${missingKeys.join(', ')}`);
    }

    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    });
    const held = new Set(existing.map((row) => row.permissionId));
    const toAdd = permissions.filter((p) => !held.has(p.id));

    console.log(`role: ${role.name} (${ROLE_KEY})`);
    console.log(`currently holds ${held.size} permission(s)`);
    if (!toAdd.length) {
      console.log('nothing to add — already granted');
      return;
    }
    console.log(`will ADD ${toAdd.length}:`);
    toAdd.forEach((p) => console.log('  +', p.key));
    console.log('will REMOVE 0 (this script never revokes)');

    if (!apply) {
      console.log('\ndry run — re-run with --apply to write');
      return;
    }

    await prisma.rolePermission.createMany({
      data: toAdd.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    console.log(`\napplied. role now holds ${held.size + toAdd.length} permission(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
