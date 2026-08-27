import { PrismaService } from '../../../common/prisma/prisma.service';

export type CreativeStoreOptionRow = { value: string; label: string };

export type CreativeStoreFilterOptions = {
  stores: CreativeStoreOptionRow[];
  /**
   * When a tenant has exactly one usable store there is nothing to choose
   * between, so the UI pins that store instead of offering "All stores" —
   * a filter with one possible outcome is a control with no purpose.
   */
  defaultStoreId: string | null;
};

/**
 * Store options for the Creative and Advertising workspaces.
 *
 * Only stores that actually carry creatives are offered: the tenant may have
 * hundreds of POS stores, but a store with no creative in it can never change
 * what either workspace displays.
 *
 * `scopeToCreator` narrows further to the stores one creator has worked in,
 * so a Creative user is not offered stores they have never posted to.
 */
export async function loadCreativeStoreOptions(
  prisma: PrismaService,
  tenantId: string,
  scopeToCreator?: string | null,
): Promise<CreativeStoreFilterOptions> {
  const grouped = await prisma.creative.groupBy({
    by: ['storeConfigId'],
    where: {
      tenantId,
      ...(scopeToCreator ? { createdById: scopeToCreator } : {}),
    },
    _count: { _all: true },
  });
  const configIds = grouped.map((row) => row.storeConfigId);
  if (configIds.length === 0) return { stores: [], defaultStoreId: null };

  const configs = await prisma.creativeStoreConfig.findMany({
    where: { tenantId, id: { in: configIds }, storeId: { not: null } },
    select: { id: true, storeId: true, storeNameSnapshot: true },
    orderBy: { storeNameSnapshot: 'asc' },
  });

  const stores = configs.map((config) => ({
    value: config.storeId as string,
    label: config.storeNameSnapshot,
  }));
  return {
    stores,
    defaultStoreId: stores.length === 1 ? stores[0].value : null,
  };
}
