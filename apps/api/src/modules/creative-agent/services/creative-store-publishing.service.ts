import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import { UpsertCreativeStorePublishingDto } from '../dto/creative-store-publishing.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';
import { CreativeMetaCredentialsService } from './creative-meta-credentials.service';
import { fetchPages, fetchPixels, MetaGraphError } from './meta-draft-client';

const READ_PERMISSIONS = [
  CREATIVE_AGENT_PERMISSIONS.READ,
  CREATIVE_AGENT_PERMISSIONS.READ_ALL,
  CREATIVE_AGENT_PERMISSIONS.REVIEW,
  CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE,
  CREATIVE_AGENT_PERMISSIONS.STORES_MANAGE,
];
const EDIT_PERMISSIONS = [CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE, CREATIVE_AGENT_PERMISSIONS.STORES_MANAGE];

export type ProductDestinationView = {
  posCustomId: string;
  posProductName: string | null;
  pixelId: string;
  landingPageUrl: string;
  displayLink: string | null;
};

export type PublishingProfileView = {
  storeConfigId: string;
  storeName: string;
  codePrefix: string;
  canEdit: boolean;
  profile: {
    metaAdAccountId: string | null;
    facebookPageId: string | null;
    facebookPageName: string | null;
    instagramAccountId: string | null;
    instagramUsername: string | null;
    defaultDailyBudget: number | null;
    countries: string[];
    timezone: string;
    updatedAt: string | null;
    updatedBy: string | null;
  } | null;
  products: ProductDestinationView[];
  adAccounts: Array<{ accountId: string; name: string; currency: string | null; timezone: string | null }>;
  /** Products the store sells, for the mapping table. */
  storeProducts: Array<{ customId: string; name: string; enrolledCreatives: number }>;
  /** What the draft worker would refuse on, in the words the panel shows. */
  missing: string[];
};

/** Everything the draft worker needs to launch one product from one store. */
export type LaunchProfile = {
  adAccountId: string;
  currency: string | null;
  accountTimezone: string | null;
  pageId: string;
  pageName: string | null;
  instagramAccountId: string | null;
  instagramUsername: string | null;
  dailyBudget: number;
  countries: string[];
  timezone: string;
  pixelId: string;
  landingPageUrl: string;
  displayLink: string | null;
};

const DEFAULT_DAILY_BUDGET = 1000;

/**
 * Where a store's creatives launch.
 *
 * The SOP fixes almost every campaign setting; the handful it leaves to the
 * store (ad account, page, Instagram, budget, and the pixel and landing page
 * per product) live here, set once. The pixel is per product because the SOP
 * is explicit that optimising one product on another's pixel ruins delivery.
 */
@Injectable()
export class CreativeStorePublishingService {
  private readonly logger = new Logger(CreativeStorePublishingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly credentials: CreativeMetaCredentialsService,
  ) {}

  async get(actor: CreativeActor, storeConfigId: string): Promise<PublishingProfileView> {
    const context = await this.access.resolve(actor);
    this.access.require(context, ...READ_PERMISSIONS);
    const store = await this.loadStore(context.tenantId, storeConfigId);

    const [profile, adAccounts, posProducts, enrolled] = await Promise.all([
      this.prisma.creativeStorePublishingProfile.findUnique({
        where: { storeConfigId: store.id },
        include: { products: { orderBy: { posCustomId: 'asc' } }, updatedBy: { select: { firstName: true, lastName: true } } },
      }),
      this.credentials.listAdAccounts(context.tenantId),
      store.storeId
        ? this.prisma.posProduct.findMany({
            where: { storeId: store.storeId, customId: { not: null } },
            select: { customId: true, name: true },
            distinct: ['customId'],
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
      this.prisma.creative.groupBy({
        by: ['posCustomId', 'posProductName'],
        where: { tenantId: context.tenantId, storeConfigId: store.id, posCustomId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    // Products the store sells, plus anything creatives were enrolled against
    // that the POS sync has not surfaced (renamed, archived, or mapped by hand).
    const storeProducts = new Map<string, { customId: string; name: string; enrolledCreatives: number }>();
    for (const product of posProducts) {
      if (product.customId) storeProducts.set(product.customId, { customId: product.customId, name: product.name, enrolledCreatives: 0 });
    }
    for (const row of enrolled) {
      if (!row.posCustomId) continue;
      const current = storeProducts.get(row.posCustomId);
      if (current) current.enrolledCreatives += row._count._all;
      else storeProducts.set(row.posCustomId, { customId: row.posCustomId, name: row.posProductName ?? row.posCustomId, enrolledCreatives: row._count._all });
    }

    const products = (profile?.products ?? []).map((product) => ({
      posCustomId: product.posCustomId,
      posProductName: product.posProductName,
      pixelId: product.pixelId,
      landingPageUrl: product.landingPageUrl,
      displayLink: product.displayLink,
    }));

    return {
      storeConfigId: store.id,
      storeName: store.storeNameSnapshot,
      codePrefix: store.codePrefix,
      canEdit: EDIT_PERMISSIONS.some((permission) => this.access.has(context, permission)),
      profile: profile
        ? {
            metaAdAccountId: profile.metaAdAccountId,
            facebookPageId: profile.facebookPageId,
            facebookPageName: profile.facebookPageName,
            instagramAccountId: profile.instagramAccountId,
            instagramUsername: profile.instagramUsername,
            defaultDailyBudget: profile.defaultDailyBudget ? Number(profile.defaultDailyBudget) : null,
            countries: profile.countries,
            timezone: profile.timezone,
            updatedAt: profile.updatedAt.toISOString(),
            updatedBy: profile.updatedBy ? `${profile.updatedBy.firstName ?? ''} ${profile.updatedBy.lastName ?? ''}`.trim() || null : null,
          }
        : null,
      products,
      adAccounts: adAccounts.map(({ accountId, name, currency, timezone }) => ({ accountId, name, currency, timezone })),
      storeProducts: Array.from(storeProducts.values()).sort((a, b) => a.name.localeCompare(b.name)),
      missing: this.missingFields(profile, null),
    };
  }

  async upsert(actor: CreativeActor, storeConfigId: string, dto: UpsertCreativeStorePublishingDto): Promise<PublishingProfileView> {
    const context = await this.access.resolve(actor);
    this.access.require(context, ...EDIT_PERMISSIONS);
    const store = await this.loadStore(context.tenantId, storeConfigId);

    if (dto.metaAdAccountId) {
      const known = await this.prisma.metaAdAccount.findFirst({
        where: { tenantId: context.tenantId, accountId: dto.metaAdAccountId },
        select: { id: true },
      });
      if (!known) {
        throw new BadRequestException(`Ad account ${dto.metaAdAccountId} is not connected to this tenant. Connect it under Integrations first.`);
      }
    }

    const products = dto.products ?? [];
    const seen = new Set<string>();
    for (const product of products) {
      const key = product.posCustomId.trim();
      if (seen.has(key)) throw new BadRequestException(`Product ${key} is listed twice.`);
      seen.add(key);
    }

    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.creativeStorePublishingProfile.upsert({
        where: { storeConfigId: store.id },
        create: {
          tenantId: context.tenantId,
          storeConfigId: store.id,
          ...this.profileData(dto),
          updatedById: context.userId,
        },
        update: { ...this.profileData(dto), updatedById: context.userId },
      });
      if (dto.products !== undefined) {
        await tx.creativeStoreProductDestination.deleteMany({
          where: { profileId: profile.id, posCustomId: { notIn: products.map((product) => product.posCustomId.trim()) } },
        });
        for (const product of products) {
          const posCustomId = product.posCustomId.trim();
          await tx.creativeStoreProductDestination.upsert({
            where: { profileId_posCustomId: { profileId: profile.id, posCustomId } },
            create: {
              tenantId: context.tenantId,
              profileId: profile.id,
              posCustomId,
              posProductName: product.posProductName?.trim() || null,
              pixelId: product.pixelId.trim(),
              landingPageUrl: product.landingPageUrl.trim(),
              displayLink: product.displayLink?.trim() || null,
            },
            update: {
              posProductName: product.posProductName?.trim() || null,
              pixelId: product.pixelId.trim(),
              landingPageUrl: product.landingPageUrl.trim(),
              displayLink: product.displayLink?.trim() || null,
            },
          });
        }
      }
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.publishing.upsert',
          resource: 'CreativeStorePublishingProfile',
          resourceId: profile.id,
          changes: { storeConfigId: store.id, products: products.length, adAccountId: dto.metaAdAccountId ?? null } as Prisma.InputJsonValue,
        },
      });
    });

    return this.get(actor, storeConfigId);
  }

  /**
   * Pages and pixels the tenant's token can see, so the panel offers real ids
   * instead of asking anyone to copy them out of Ads Manager. A Graph failure
   * is returned as text, never thrown: the form still loads for manual entry.
   */
  async metaOptions(actor: CreativeActor, storeConfigId: string, adAccountId?: string | null) {
    const context = await this.access.resolve(actor);
    this.access.require(context, ...READ_PERMISSIONS);
    await this.loadStore(context.tenantId, storeConfigId);

    let token: string;
    try {
      token = (await this.credentials.accessTokenFor(context.tenantId, adAccountId)).token;
    } catch (error) {
      return { pages: [], pixels: [], error: error instanceof Error ? error.message : String(error) };
    }

    const [pages, pixels] = await Promise.all([
      fetchPages(token).catch((error) => {
        this.logger.warn(`Could not list pages for tenant ${context.tenantId}: ${this.describe(error)}`);
        return { error: this.describe(error) };
      }),
      adAccountId
        ? fetchPixels(token, adAccountId).catch((error) => {
            this.logger.warn(`Could not list pixels for account ${adAccountId}: ${this.describe(error)}`);
            return { error: this.describe(error) };
          })
        : Promise.resolve([]),
    ]);

    const errors = [pages, pixels].flatMap((result) => ('error' in result ? [result.error] : []));
    return {
      pages: Array.isArray(pages) ? pages : [],
      pixels: Array.isArray(pixels) ? pixels : [],
      error: errors.length ? errors.join(' ') : undefined,
    };
  }

  /**
   * The full launch profile for one product, or a refusal that names every
   * missing field. Called by the draft worker; nothing is guessed here.
   */
  async resolveLaunch(tenantId: string, storeConfigId: string, posCustomId: string | null): Promise<{ profile: LaunchProfile | null; missing: string[] }> {
    const profile = await this.prisma.creativeStorePublishingProfile.findFirst({
      where: { tenantId, storeConfigId },
      include: { products: posCustomId ? { where: { posCustomId } } : false },
    });
    const product = posCustomId ? profile?.products?.[0] ?? null : null;
    const missing = this.missingFields(profile, posCustomId ? { posCustomId, product } : null);
    if (!profile || missing.length) return { profile: null, missing };

    const account = profile.metaAdAccountId
      ? await this.prisma.metaAdAccount.findFirst({ where: { tenantId, accountId: profile.metaAdAccountId }, select: { currency: true, timezone: true } })
      : null;

    return {
      missing: [],
      profile: {
        adAccountId: profile.metaAdAccountId!,
        currency: account?.currency ?? null,
        accountTimezone: account?.timezone ?? null,
        pageId: profile.facebookPageId!,
        pageName: profile.facebookPageName,
        instagramAccountId: profile.instagramAccountId,
        instagramUsername: profile.instagramUsername,
        dailyBudget: profile.defaultDailyBudget ? Number(profile.defaultDailyBudget) : DEFAULT_DAILY_BUDGET,
        countries: profile.countries.length ? profile.countries : ['PH'],
        timezone: profile.timezone || 'Asia/Manila',
        pixelId: product!.pixelId,
        landingPageUrl: product!.landingPageUrl,
        displayLink: product!.displayLink,
      },
    };
  }

  private missingFields(
    profile: { metaAdAccountId: string | null; facebookPageId: string | null } | null,
    productCheck: { posCustomId: string; product: { pixelId: string; landingPageUrl: string } | null } | null,
  ): string[] {
    const missing: string[] = [];
    if (!profile) missing.push('Meta publishing profile');
    else {
      if (!profile.metaAdAccountId) missing.push('ad account');
      if (!profile.facebookPageId) missing.push('Facebook Page');
    }
    if (productCheck) {
      if (!productCheck.product) missing.push(`pixel and landing page for product ${productCheck.posCustomId}`);
      else {
        if (!productCheck.product.pixelId) missing.push(`pixel for product ${productCheck.posCustomId}`);
        if (!productCheck.product.landingPageUrl) missing.push(`landing page for product ${productCheck.posCustomId}`);
      }
    }
    return missing;
  }

  private profileData(dto: UpsertCreativeStorePublishingDto) {
    return {
      metaAdAccountId: dto.metaAdAccountId?.trim() || null,
      facebookPageId: dto.facebookPageId?.trim() || null,
      facebookPageName: dto.facebookPageName?.trim() || null,
      instagramAccountId: dto.instagramAccountId?.trim() || null,
      instagramUsername: dto.instagramUsername?.trim() || null,
      defaultDailyBudget: dto.defaultDailyBudget ?? null,
      countries: (dto.countries ?? ['PH']).map((code) => code.toUpperCase()),
      timezone: dto.timezone?.trim() || 'Asia/Manila',
    };
  }

  private async loadStore(tenantId: string, storeConfigId: string) {
    const store = await this.prisma.creativeStoreConfig.findFirst({
      where: { id: storeConfigId, tenantId },
      select: { id: true, storeId: true, storeNameSnapshot: true, codePrefix: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private describe(error: unknown) {
    if (error instanceof MetaGraphError) return error.message;
    return error instanceof Error ? error.message : String(error);
  }
}
