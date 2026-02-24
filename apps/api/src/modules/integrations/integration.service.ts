import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import { EncryptionService } from './services/encryption.service';
import { ProviderFactory } from './providers/provider.factory';
import { PosOrderService } from './services/pos-order.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  IntegrationResponseDto,
  IntegrationProvider,
  BulkCreatePosIntegrationDto,
  ListIntegrationsDto,
  ListPosStoresDto,
  UpdatePosStoreDto,
} from './dto';
import { validate as uuidValidate } from 'uuid';
import { MetaAdsProvider } from './providers/meta-ads.provider';
import { MetaInsightService } from './services/meta-insight.service';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

type PancakeWebhookSettings = {
  enabled?: boolean;
  apiKeyHash?: string;
  keyLast4?: string;
  rotatedAt?: string;
  rotatedByUserId?: string;
};

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);
  private readonly PANCAKE_WEBHOOK_SETTINGS_KEY = 'pancakePosWebhook';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly teamContext: TeamContextService,
    private readonly encryptionService: EncryptionService,
    private readonly providerFactory: ProviderFactory,
    private readonly metaInsightService: MetaInsightService,
    private readonly posOrderService: PosOrderService,
  ) {}

  private normalizeJsonObject(value: any): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return { ...value };
  }

  private getPancakeWebhookSettings(settingsRaw: any): PancakeWebhookSettings {
    const settings = this.normalizeJsonObject(settingsRaw);
    const webhook = this.normalizeJsonObject(settings[this.PANCAKE_WEBHOOK_SETTINGS_KEY]);
    return {
      enabled: typeof webhook.enabled === 'boolean' ? webhook.enabled : false,
      apiKeyHash: typeof webhook.apiKeyHash === 'string' ? webhook.apiKeyHash : undefined,
      keyLast4: typeof webhook.keyLast4 === 'string' ? webhook.keyLast4 : undefined,
      rotatedAt: typeof webhook.rotatedAt === 'string' ? webhook.rotatedAt : undefined,
      rotatedByUserId:
        typeof webhook.rotatedByUserId === 'string' ? webhook.rotatedByUserId : undefined,
    };
  }

  private buildPancakeWebhookUrl(baseUrl: string, tenantId: string): string {
    const cleanBase = (baseUrl || '').replace(/\/+$/, '');
    return `${cleanBase}/api/v1/webhooks/pancake/${tenantId}`;
  }

  private hashWebhookApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  private verifyWebhookApiKey(apiKey: string, expectedHash: string): boolean {
    if (!apiKey || !expectedHash) return false;
    const candidate = Buffer.from(this.hashWebhookApiKey(apiKey), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  }

  private normalizeWebhookHeaders(headers: Record<string, any> = {}): Record<string, string> {
    const pickedKeys = ['content-type', 'user-agent', 'x-request-id', 'x-forwarded-for'];
    const out: Record<string, string> = {};
    for (const key of pickedKeys) {
      const val = headers[key];
      if (typeof val === 'string') {
        out[key] = val;
      } else if (Array.isArray(val)) {
        out[key] = val.join(', ');
      } else if (val !== undefined && val !== null) {
        out[key] = String(val);
      }
    }
    return out;
  }

  private isWebhookOrderLike(value: any): value is Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const hasOrderId = value.id !== undefined || value.order_id !== undefined;
    const hasShopId = value.shop_id !== undefined || value.shopId !== undefined;
    return hasOrderId && hasShopId;
  }

  /**
   * Accept direct Pancake order payload and common wrappers from tools/middleware.
   * Supports single-order and batch payloads.
   */
  private extractWebhookOrders(payload: any): any[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const queue: any[] = [payload];
    const collected: any[] = [];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== 'object') continue;

      if (Array.isArray(current)) {
        queue.push(...current);
        continue;
      }

      if (this.isWebhookOrderLike(current)) {
        const shopId = current.shop_id?.toString?.()?.trim?.() || current.shopId?.toString?.()?.trim?.() || '';
        const orderId = current.id?.toString?.()?.trim?.() || current.order_id?.toString?.()?.trim?.() || '';
        if (shopId && orderId) {
          const key = `${shopId}::${orderId}`;
          if (!seen.has(key)) {
            seen.add(key);
            collected.push(current);
          }
        }
      }

      queue.push(
        current.body,
        current.payload,
        current.order,
        current.data,
        current.orders,
      );
    }

    return collected;
  }

  async getPancakeWebhookConfig(baseUrl: string) {
    const { tenantId } = await this.teamContext.getContext();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const cfg = this.getPancakeWebhookSettings(tenant.settings);
    return {
      enabled: !!cfg.enabled,
      hasApiKey: !!cfg.apiKeyHash,
      keyLast4: cfg.keyLast4 || null,
      rotatedAt: cfg.rotatedAt || null,
      rotatedByUserId: cfg.rotatedByUserId || null,
      headerKey: 'x-api-key',
      webhookUrl: this.buildPancakeWebhookUrl(baseUrl, tenant.id),
    };
  }

  async rotatePancakeWebhookApiKey(baseUrl: string) {
    const { tenantId, userId } = await this.teamContext.getContext();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const settings = this.normalizeJsonObject(tenant.settings);
    const existing = this.getPancakeWebhookSettings(tenant.settings);
    const apiKey = `nbm_${randomBytes(24).toString('hex')}`;
    const nowIso = new Date().toISOString();

    settings[this.PANCAKE_WEBHOOK_SETTINGS_KEY] = {
      enabled: existing.enabled ?? true,
      apiKeyHash: this.hashWebhookApiKey(apiKey),
      keyLast4: apiKey.slice(-4),
      rotatedAt: nowIso,
      rotatedByUserId: userId || null,
    };

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { settings: settings as Prisma.InputJsonValue },
    });

    return {
      enabled: settings[this.PANCAKE_WEBHOOK_SETTINGS_KEY].enabled,
      headerKey: 'x-api-key',
      apiKey,
      keyLast4: apiKey.slice(-4),
      rotatedAt: nowIso,
      rotatedByUserId: userId || null,
      webhookUrl: this.buildPancakeWebhookUrl(baseUrl, tenant.id),
    };
  }

  async updatePancakeWebhookEnabled(enabled: boolean, baseUrl: string) {
    const { tenantId } = await this.teamContext.getContext();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const settings = this.normalizeJsonObject(tenant.settings);
    const existing = this.getPancakeWebhookSettings(tenant.settings);

    settings[this.PANCAKE_WEBHOOK_SETTINGS_KEY] = {
      enabled,
      apiKeyHash: existing.apiKeyHash,
      keyLast4: existing.keyLast4,
      rotatedAt: existing.rotatedAt,
      rotatedByUserId: existing.rotatedByUserId,
    };

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { settings: settings as Prisma.InputJsonValue },
    });

    return {
      enabled,
      hasApiKey: !!existing.apiKeyHash,
      keyLast4: existing.keyLast4 || null,
      rotatedAt: existing.rotatedAt || null,
      rotatedByUserId: existing.rotatedByUserId || null,
      headerKey: 'x-api-key',
      webhookUrl: this.buildPancakeWebhookUrl(baseUrl, tenant.id),
    };
  }

  async receivePancakeOrderWebhook(
    tenantId: string,
    apiKey: string | undefined,
    payload: any,
    headers: Record<string, any>,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Invalid tenant');
    }

    const cfg = this.getPancakeWebhookSettings(tenant.settings);
    if (!cfg.enabled) {
      throw new ForbiddenException('Webhook is disabled');
    }
    if (!cfg.apiKeyHash) {
      throw new UnauthorizedException('Webhook API key is not configured');
    }
    if (!apiKey || !this.verifyWebhookApiKey(apiKey, cfg.apiKeyHash)) {
      throw new UnauthorizedException('Invalid webhook API key');
    }

    let safePayload: any = payload ?? {};
    try {
      safePayload = JSON.parse(JSON.stringify(payload ?? {}));
    } catch {
      safePayload = { raw: String(payload ?? '') };
    }

    const webhookOrders = this.extractWebhookOrders(safePayload);
    const firstOrder = webhookOrders[0];
    const sourceId =
      safePayload?.id?.toString?.() ||
      safePayload?.order_id?.toString?.() ||
      safePayload?.order?.id?.toString?.() ||
      firstOrder?.id?.toString?.() ||
      firstOrder?.order_id?.toString?.() ||
      null;

    const event = await this.prisma.analyticsEvent.create({
      data: {
        tenantId: tenant.id,
        eventType: 'POS_WEBHOOK',
        eventName: 'PANCAKE_ORDER_RECEIVED',
        source: IntegrationProvider.PANCAKE_POS,
        sourceId,
        properties: {
          payload: safePayload,
          headers: this.normalizeWebhookHeaders(headers),
          receivedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
      select: { id: true, timestamp: true },
    });

    let upserted = 0;
    const warnings: string[] = [];

    if (webhookOrders.length === 0) {
      warnings.push('Missing order payload or shop_id');
    } else {
      const ordersByShopId = new Map<string, any[]>();
      for (const order of webhookOrders) {
        const shopId = order?.shop_id?.toString?.()?.trim?.() || order?.shopId?.toString?.()?.trim?.() || '';
        if (!shopId) {
          warnings.push('Skipped order with missing shop_id');
          continue;
        }
        const list = ordersByShopId.get(shopId) || [];
        list.push(order);
        ordersByShopId.set(shopId, list);
      }

      if (ordersByShopId.size > 0) {
        const shopIds = Array.from(ordersByShopId.keys());
        const stores = await this.prisma.posStore.findMany({
          where: {
            tenantId: tenant.id,
            shopId: { in: shopIds },
          },
          select: {
            id: true,
            shopId: true,
            teamId: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        });

        const storeByShopId = new Map<string, { id: string; teamId: string | null }>();
        for (const store of stores) {
          if (!storeByShopId.has(store.shopId)) {
            storeByShopId.set(store.shopId, { id: store.id, teamId: store.teamId || null });
          }
        }

        for (const [shopId, orders] of ordersByShopId.entries()) {
          const store = storeByShopId.get(shopId);
          if (!store) {
            warnings.push(`No POS store found for shop_id=${shopId}`);
            continue;
          }

          try {
            upserted += await this.posOrderService.upsertPosOrders(
              tenant.id,
              store.id,
              orders,
              store.teamId,
            );
          } catch (error: any) {
            warnings.push(
              `Failed to upsert shop_id=${shopId}: ${error?.message || 'Unknown error'}`,
            );
          }
        }
      }
    }

    return {
      accepted: true,
      eventId: event.id,
      receivedAt: event.timestamp.toISOString(),
      message: warnings.length > 0 ? 'Webhook received with upsert warning' : 'Webhook received and upserted',
      upserted,
      warning: warnings.length > 0 ? warnings.join(' | ') : null,
    };
  }

  /**
   * Build an access-aware where clause for integrations, respecting team scope and sharing.
   */
  private async buildIntegrationAccessWhere(additional: any = {}) {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];
    const restrictAdminToScope = isAdmin && allowedTeams.length > 0;

    if (!isAdmin && allowedTeams.length === 0) {
      return { where: null, tenantId, allowedTeams };
    }

    const base: any = { tenantId, ...additional };

    if (isAdmin && !restrictAdminToScope) {
      return { where: base, tenantId, allowedTeams };
    }

    if (allowedTeams.length === 0) {
      return { where: null, tenantId, allowedTeams };
    }

    return {
      tenantId,
      allowedTeams,
      where: {
        ...base,
        OR: [
          { teamId: { in: allowedTeams } },
          { sharedTeams: { some: { teamId: { in: allowedTeams } } } },
        ],
      },
    };
  }


  /**
   * Create a new integration for the current tenant
   */
  async create(createIntegrationDto: CreateIntegrationDto): Promise<IntegrationResponseDto> {
    const { tenantId } = await this.teamContext.getContext();
    const { name, provider, description, credentials, config, teamId: payloadTeamId, sharedTeamIds } =
      createIntegrationDto;

    // Validate and get effective team ID - restricts non-admins to their teams only
    const effectiveTeamId = await this.teamContext.validateAndGetTeamId(payloadTeamId);

    // Get tenant's encryption key
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { encryptionKey: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // For PANCAKE_POS, check for duplicate API keys/shop IDs
    // For META_ADS, allow multiple integrations (different access tokens)
    if (provider === 'PANCAKE_POS') {
      const apiKey = credentials?.apiKey;
      const shopId = config?.shopId?.toString();

      if (apiKey) {
        const existingStore = await this.prisma.posStore.findFirst({
          where: {
            tenantId,
            ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}),
            apiKey,
          },
        });

        if (existingStore) {
          throw new ConflictException('Store with this API key already exists for this tenant');
        }
      }

      if (shopId) {
        const existingStoreByShop = await this.prisma.posStore.findFirst({
          where: {
            tenantId,
            ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}),
            shopId,
          },
        });

        if (existingStoreByShop) {
          throw new ConflictException('Store with this shop ID already exists for this tenant');
        }
      }
    }

    // Derive a friendly name for Meta based on /me if available
    let finalName = name;
    if (provider === 'META_ADS' && credentials?.accessToken) {
      try {
        const meRes = await fetch(
          `https://graph.facebook.com/v23.0/me?fields=name&access_token=${credentials.accessToken}`,
        );
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData?.name) {
            finalName = meData.name;
          }
        }
      } catch {
        // Ignore and fall back to provided name
      }
    }

    // Encrypt credentials
    const encryptedCredentials = this.encryptionService.encrypt(credentials, tenant.encryptionKey);

    // Validate shared team ids (same tenant)
    const validSharedIds =
      Array.isArray(sharedTeamIds) && sharedTeamIds.length > 0
        ? (
            await this.prisma.team.findMany({
              where: { tenantId, id: { in: sharedTeamIds } },
              select: { id: true },
            })
          ).map((t) => t.id)
        : [];

    // Create integration with shared teams
    const integration = await this.prisma.$transaction(async (tx) => {
      const created = await tx.integration.create({
        data: {
          name: finalName,
          provider,
          description,
          credentials: encryptedCredentials,
          config: config || {},
          tenantId,
          teamId: effectiveTeamId,
          status: 'ACTIVE',
          enabled: false,
          sharedTeams:
            validSharedIds.length > 0
              ? {
                  createMany: {
                    data: validSharedIds.map((tid) => ({ teamId: tid })),
                    skipDuplicates: true,
                  },
                }
              : undefined,
        },
        include: { sharedTeams: true },
      });
      return created;
    });

    // Create POS store record for Pancake POS
    if (provider === 'PANCAKE_POS') {
      await this.prisma.posStore.create({
        data: {
          tenantId,
          teamId: effectiveTeamId,
          integrationId: integration.id,
          name,
          shopId: config?.shopId?.toString() || '',
          shopName: config?.shopName || name,
          shopAvatarUrl: config?.shopAvatarUrl || null,
          apiKey: credentials?.apiKey || '',
          description,
          status: 'ACTIVE',
          enabled: null,
        },
      });
    }

    // Auto-fetch data after creation (best-effort, don't fail the creation)
    try {
      if (provider === 'META_ADS') {
        await this.syncMetaAdAccounts(integration.id);
        this.logger.log(`Auto-synced Meta ad accounts for integration ${integration.id}`);
      } else if (provider === 'PANCAKE_POS') {
        await this.fetchPancakeProductsByIntegrationId(integration.id);
        this.logger.log(`Auto-fetched POS products for integration ${integration.id}`);
      }
    } catch (error) {
      this.logger.warn(
        `Auto-fetch after integration creation failed for ${integration.id}: ${error.message}`,
      );
    }

    return new IntegrationResponseDto(integration);
  }

  /**
   * Bulk import POS integrations from a list of API keys.
   * For each key, discovers shops via Pancake API, creates integration + store, and auto-fetches products.
   */
  async bulkCreatePosIntegrations(dto: BulkCreatePosIntegrationDto) {
    const { tenantId } = await this.teamContext.getContext();

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { encryptionKey: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const effectiveTeamId = await this.teamContext.validateAndGetTeamId(dto.teamId);

    // Validate shared team ids
    const validSharedIds =
      Array.isArray(dto.sharedTeamIds) && dto.sharedTeamIds.length > 0
        ? (
            await this.prisma.team.findMany({
              where: { tenantId, id: { in: dto.sharedTeamIds } },
              select: { id: true },
            })
          ).map((t) => t.id)
        : [];

    const results: any[] = [];

    for (const entry of dto.integrations) {
      const maskedKey = entry.apiKey.length > 8
        ? entry.apiKey.slice(0, 4) + '...' + entry.apiKey.slice(-4)
        : '****';

      // 1. Discover shops from this API key
      let shops: any[];
      try {
        const response = await fetch(
          `https://pos.pages.fm/api/v1/shops?api_key=${entry.apiKey}`,
        );

        if (!response.ok) {
          results.push({ status: 'failed', apiKey: maskedKey, reason: `API returned ${response.status}` });
          continue;
        }

        const data = await response.json();
        if (!data.success || !Array.isArray(data.shops) || data.shops.length === 0) {
          results.push({ status: 'failed', apiKey: maskedKey, reason: 'No shops found for this API key' });
          continue;
        }

        shops = data.shops;
      } catch (error) {
        results.push({ status: 'failed', apiKey: maskedKey, reason: error.message });
        continue;
      }

      // 2. Create integration + store for each shop
      for (const shop of shops) {
        const shopId = shop.id?.toString() || '';
        const shopName = shop.name || 'Unnamed Shop';
        const shopAvatarUrl = shop.avatar_url || null;

        // Duplicate check: shopId
        const existingByShopId = await this.prisma.posStore.findFirst({
          where: { tenantId, shopId },
        });
        if (existingByShopId) {
          results.push({ status: 'skipped', apiKey: maskedKey, shopId, shopName, reason: 'Shop ID already exists' });
          continue;
        }

        // Duplicate check: apiKey
        const existingByApiKey = await this.prisma.posStore.findFirst({
          where: {
            tenantId,
            apiKey: entry.apiKey,
            shopId,
          },
        });
        if (existingByApiKey) {
          results.push({ status: 'skipped', apiKey: maskedKey, shopId, shopName, reason: 'API key + shop already exists' });
          continue;
        }

        try {
          const encryptedCredentials = this.encryptionService.encrypt(
            { apiKey: entry.apiKey },
            tenant.encryptionKey,
          );

          // Create integration with shared teams
          const integration = await this.prisma.$transaction(async (tx) => {
            const created = await tx.integration.create({
              data: {
                name: shopName,
                provider: 'PANCAKE_POS',
                credentials: encryptedCredentials,
                config: { shopId, shopName, shopAvatarUrl },
                tenantId,
                teamId: effectiveTeamId,
                status: 'ACTIVE',
                enabled: false,
                sharedTeams:
                  validSharedIds.length > 0
                    ? {
                        createMany: {
                          data: validSharedIds.map((tid) => ({ teamId: tid })),
                          skipDuplicates: true,
                        },
                      }
                    : undefined,
              },
            });
            return created;
          });

          // Create POS store
          await this.prisma.posStore.create({
            data: {
              tenantId,
              teamId: effectiveTeamId,
              integrationId: integration.id,
              name: shopName,
              shopId,
              shopName,
              shopAvatarUrl,
              apiKey: entry.apiKey,
              status: 'ACTIVE',
              enabled: null,
            },
          });

          // Auto-fetch products (best-effort)
          try {
            await this.fetchPancakeProductsByIntegrationId(integration.id);
          } catch (fetchError) {
            this.logger.warn(
              `Bulk import: product fetch failed for integration ${integration.id}: ${fetchError.message}`,
            );
          }

          results.push({
            status: 'created',
            apiKey: maskedKey,
            shopId,
            shopName,
            integrationId: integration.id,
          });
        } catch (error) {
          results.push({ status: 'failed', apiKey: maskedKey, shopId, shopName, reason: error.message });
        }
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return {
      summary: { total: results.length, created, skipped, failed },
      results,
    };
  }

  /**
   * Get all integrations for the current tenant
   * Non-admins only see integrations from their teams
   */
  async findAll(
    params: ListIntegrationsDto,
  ): Promise<IntegrationResponseDto[]> {
    const { search } = params || {};

    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    let baseWhere: any = { tenantId };
    const shouldRestrictAdminToScope = isAdmin && allowedTeams.length > 0;
    if (!isAdmin || shouldRestrictAdminToScope) {
      if (allowedTeams.length === 0) {
        return [];
      }
      baseWhere = {
        tenantId,
        OR: [
          { teamId: { in: allowedTeams } },
          { sharedTeams: { some: { teamId: { in: allowedTeams } } } },
        ],
      };
    }

    let where: any = baseWhere;
    if (search) {
      const searchFilter = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { provider: { contains: search, mode: 'insensitive' } },
        ],
      };
      where = { AND: [baseWhere, searchFilter] };
    }

    const rows = await this.prisma.integration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { sharedTeams: true },
    });

    return rows.map((integration) => new IntegrationResponseDto(integration));
  }

  async listPosStores(
    params: ListPosStoresDto,
  ): Promise<any[]> {
    const { search } = params || {};

    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    // Admins with no scope see all; otherwise restrict to owned or shared integrations
    let where: any = { tenantId };
    const shouldRestrict = !isAdmin || (isAdmin && allowedTeams.length > 0);
    if (shouldRestrict) {
      if (allowedTeams.length === 0) {
        return [];
      }
      where = {
        tenantId,
        OR: [
          { teamId: { in: allowedTeams } },
          // Integration owned by allowed teams
          { integration: { teamId: { in: allowedTeams } } },
          // Integration shared to allowed teams
          { integration: { sharedTeams: { some: { teamId: { in: allowedTeams } } } } },
        ],
      };
    }

    if (search) {
      const s = search.trim();
      if (s.length > 0) {
        const searchFilter = {
          OR: [
            { name: { contains: s, mode: 'insensitive' } },
            { shopName: { contains: s, mode: 'insensitive' } },
            { shopId: { contains: s, mode: 'insensitive' } },
            { description: { contains: s, mode: 'insensitive' } },
          ],
        };
        where = { AND: [where, searchFilter] };
      }
    }

    return this.prisma.posStore.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { integration: { include: { sharedTeams: true } } },
    });
  }

  async getPosStore(id: string) {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    // Admins with no scope see all; otherwise restrict to owned or shared integrations
    let where: any = { id, tenantId };
    const shouldRestrict = !isAdmin || (isAdmin && allowedTeams.length > 0);
    if (shouldRestrict) {
      if (allowedTeams.length === 0) {
        throw new NotFoundException(`Store with ID ${id} not found`);
      }
      where = {
        id,
        tenantId,
        OR: [
          { teamId: { in: allowedTeams } },
          { integration: { teamId: { in: allowedTeams } } },
          { integration: { sharedTeams: { some: { teamId: { in: allowedTeams } } } } },
        ],
      };
    }

    const store = await this.prisma.posStore.findFirst({
      where,
      include: { integration: { include: { sharedTeams: true } } },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    return store;
  }

  async updatePosStore(id: string, dto: UpdatePosStoreDto) {
    const store = await this.getPosStore(id);

    const initialValueOffer =
      dto.initialValueOffer === undefined ? undefined : dto.initialValueOffer;

    return this.prisma.posStore.update({
      where: { id: store.id },
      data: {
        ...(initialValueOffer !== undefined
          ? { initialValueOffer: initialValueOffer === null ? null : initialValueOffer }
          : {}),
      },
    });
  }

  async listPosStoreProducts(id: string) {
    const store = await this.getPosStore(id); // validates access including shared integrations

    return this.prisma.posProduct.findMany({
      where: { storeId: store.id },
      orderBy: { name: 'asc' },
    });
  }

  async listPosStoreOrders(id: string, dateFrom?: string, dateTo?: string) {
    const store = await this.getPosStore(id); // validates access including shared integrations
    const { tenantId } = await this.teamContext.getContext();

    const where: any = {
      tenantId,
      shopId: store.shopId,
    };

    // Do not further restrict by team here; store access has already been validated

    if (dateFrom || dateTo) {
      where.dateLocal = {};
      if (dateFrom) where.dateLocal.gte = dateFrom;
      if (dateTo) where.dateLocal.lte = dateTo;
    }

    return this.prisma.posOrder.findMany({
      where,
      orderBy: [{ dateLocal: 'desc' }, { insertedAt: 'desc' }],
    });
  }

  async bulkUpdateProductMapping(storeId: string, productIds: string[], mapping: string) {
    const store = await this.getPosStore(storeId); // validates access including shared integrations

    // Update all products in the list
    const result = await this.prisma.posProduct.updateMany({
      where: {
        id: { in: productIds },
        storeId: store.id,
      },
      data: {
        mapping,
      },
    });

    return {
      success: true,
      updated: result.count,
      message: `Updated ${result.count} product(s)`,
    };
  }

  async checkPosDuplicate(apiKey?: string, shopId?: string) {
    const { tenantId } = await this.teamContext.getContext();
    const where = await this.teamContext.buildTeamWhereClause();

    if (!tenantId || !uuidValidate(tenantId)) {
      throw new ForbiddenException('Tenant context is required');
    }

    if (apiKey) {
      const existingApiKey = await this.prisma.posStore.findFirst({
        where: {
          ...where,
          apiKey,
        },
        select: { id: true, shopName: true },
      });

      if (existingApiKey) {
        return {
          duplicate: true,
          reason: 'Store with this API key already exists for this tenant',
        };
      }
    }

    if (shopId) {
      const existingShop = await this.prisma.posStore.findFirst({
        where: {
          ...where,
          shopId,
        },
        select: { id: true, shopName: true },
      });

      if (existingShop) {
        return {
          duplicate: true,
          reason: 'Store with this shop ID already exists for this tenant',
        };
      }
    }

    return { duplicate: false };
  }


  /**
   * Get a single integration by ID
   */
  async findOne(id: string): Promise<IntegrationResponseDto> {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    const where: any = { id, tenantId };
    const shouldRestrictAdminToScope = isAdmin && allowedTeams.length > 0;
    if (!isAdmin || shouldRestrictAdminToScope) {
      if (allowedTeams.length === 0) {
        throw new NotFoundException(`Integration with ID ${id} not found`);
      }
      where.OR = [
        { teamId: { in: allowedTeams } },
        { sharedTeams: { some: { teamId: { in: allowedTeams } } } },
      ];
    }

    const integration = await this.prisma.integration.findFirst({
      where,
      include: { sharedTeams: true },
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    return new IntegrationResponseDto(integration);
  }

  /**
   * Update an integration
   */
  async update(id: string, updateIntegrationDto: UpdateIntegrationDto): Promise<IntegrationResponseDto> {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    const where: any = { id, tenantId };
    const shouldRestrictAdminToScope = isAdmin && allowedTeams.length > 0;
    if (!isAdmin || shouldRestrictAdminToScope) {
      if (allowedTeams.length === 0) {
        throw new NotFoundException(`Integration with ID ${id} not found`);
      }
      where.OR = [
        { teamId: { in: allowedTeams } },
        { sharedTeams: { some: { teamId: { in: allowedTeams } } } },
      ];
    }

    // Verify integration exists and user has access to it
    const existingIntegration = await this.prisma.integration.findFirst({
      where,
      include: { sharedTeams: true },
    });

    if (!existingIntegration) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    const { name, description, credentials, config, enabled, teamId: payloadTeamId, sharedTeamIds } =
      updateIntegrationDto;

    // Validate and get effective team ID - restricts non-admins to their teams only
    const effectiveTeamId = await this.teamContext.validateAndGetTeamId(payloadTeamId);

    // Prepare update data
    const updateData: any = {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(config && { config }),
      ...(enabled !== undefined && { enabled }),
      teamId: effectiveTeamId,
    };

    // If credentials are being updated, encrypt them
    if (credentials) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { encryptionKey: true },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      updateData.credentials = this.encryptionService.encrypt(
        credentials,
        tenant.encryptionKey,
      );
    }

    // Validate shared team ids (same tenant)
    const validSharedIds =
      Array.isArray(sharedTeamIds) && sharedTeamIds.length > 0
        ? (
            await this.prisma.team.findMany({
              where: { tenantId, id: { in: sharedTeamIds } },
              select: { id: true },
            })
          ).map((t) => t.id)
        : [];

    const updatedIntegration = await this.prisma.$transaction(async (tx) => {
      await tx.integration.update({
        where: { id },
        data: updateData,
      });

      // Cascade team changes to related records
      if (updateIntegrationDto.teamId !== undefined) {
        await tx.posStore.updateMany({
          where: { integrationId: id },
          data: { teamId: effectiveTeamId },
        });
        await tx.metaAdAccount.updateMany({
          where: { integrationId: id },
          data: { teamId: effectiveTeamId },
        });
      }

      // Sync shared teams if provided
      if (sharedTeamIds !== undefined) {
        // Remove links not in the new list
        await tx.integrationSharedTeam.deleteMany({
          where: {
            integrationId: id,
            ...(validSharedIds.length > 0 ? { teamId: { notIn: validSharedIds } } : {}),
          },
        });
        // Add new links
        if (validSharedIds.length > 0) {
          await tx.integrationSharedTeam.createMany({
            data: validSharedIds.map((tid) => ({ integrationId: id, teamId: tid })),
            skipDuplicates: true,
          });
        } else {
          // If empty array was provided, clear all shares
          await tx.integrationSharedTeam.deleteMany({ where: { integrationId: id } });
        }
      }

      return tx.integration.findUnique({
        where: { id },
        include: { sharedTeams: true },
      });
    });

    return new IntegrationResponseDto(updatedIntegration);
  }

  /**
   * Delete an integration
   */
  async remove(id: string): Promise<void> {
    const { teamIds, userTeams, isAdmin, tenantId } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    let where: any = { id, tenantId };
    const shouldRestrictAdminToScope = isAdmin && allowedTeams.length > 0;
    if (!isAdmin || shouldRestrictAdminToScope) {
      if (allowedTeams.length === 0) {
        throw new NotFoundException(`Integration with ID ${id} not found`);
      }
      where = {
        ...where,
        OR: [
          { teamId: { in: allowedTeams } },
          { sharedTeams: { some: { teamId: { in: allowedTeams } } } },
        ],
      };
    }

    // Verify integration exists and user has access
    const integration = await this.prisma.integration.findFirst({
      where,
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      if (integration.provider === 'PANCAKE_POS') {
        const stores = await tx.posStore.findMany({
          where: { tenantId, integrationId: id },
          select: { id: true, shopId: true },
        });
        if (stores.length > 0) {
          const shopIds = stores.map((s) => s.shopId).filter(Boolean);
          if (shopIds.length > 0) {
            await tx.posOrder.deleteMany({
              where: { tenantId, shopId: { in: shopIds } },
            });
          }
          await tx.posStore.deleteMany({
            where: { id: { in: stores.map((s) => s.id) } },
          });
        }
      }

      // Delete integration
      await tx.integration.delete({
        where: { id },
      });
    });
  }

  /**
   * Enable an integration
   */
  async enable(id: string): Promise<IntegrationResponseDto> {
    const where = await this.teamContext.buildTeamWhereClause({ id });

    const integration = await this.prisma.integration.findFirst({
      where,
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    const updatedIntegration = await this.prisma.integration.update({
      where: { id },
      data: {
        enabled: true,
        status: 'ACTIVE',
      },
    });

    return new IntegrationResponseDto(updatedIntegration);
  }

  /**
   * Disable an integration
   */
  async disable(id: string): Promise<IntegrationResponseDto> {
    const where = await this.teamContext.buildTeamWhereClause({ id });

    const integration = await this.prisma.integration.findFirst({
      where,
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    const updatedIntegration = await this.prisma.integration.update({
      where: { id },
      data: {
        enabled: false,
        status: 'DISABLED',
      },
    });

    return new IntegrationResponseDto(updatedIntegration);
  }

  private async fetchProductsFromPancake(shopId: string, apiKey: string): Promise<any[]> {
    const baseUrl = `https://pos.pages.fm/api/v1/shops/${shopId}/products`;
    const products: any[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = `${baseUrl}?api_key=${apiKey}&page_number=${page}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new ConflictException(errorText || 'Failed to fetch products from Pancake POS');
      }

      const data = await response.json();
      const pageProducts = data?.products || data?.data || [];
      products.push(
        ...pageProducts.map((item: any) => ({
          id: item?.id,
          customId: item?.custom_id || item?.code,
          name: item?.name,
        })),
      );

      const currentPage = data?.page_number || page;
      totalPages = data?.total_pages || currentPage;
      if (currentPage >= totalPages) {
        break;
      }

      page += 1;
    }

    return products;
  }

  private async upsertStoreProducts(storeId: string, products: any[]) {
    if (!products?.length) return;

    await this.prisma.$transaction(
      products.map((p: any) =>
        this.prisma.posProduct.upsert({
          where: {
            storeId_productId: {
              storeId,
              productId: p.id?.toString() || '',
            },
          },
          update: {
            customId: p.customId || null,
            name: p.name || 'Unnamed product',
          },
          create: {
            storeId,
            productId: p.id?.toString() || '',
            customId: p.customId || null,
            name: p.name || 'Unnamed product',
          },
        }),
      ),
    );
  }

  async fetchPancakeProductsByIntegrationId(id: string): Promise<any[]> {
    const { tenantId } = await this.teamContext.getContext();

    // Use sharing-aware access check (same as buildIntegrationAccessWhere)
    const access = await this.buildIntegrationAccessWhere({ id });
    if (!access.where) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    const integration = await this.prisma.integration.findFirst({
      where: access.where,
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    if (integration.provider !== 'PANCAKE_POS') {
      throw new ConflictException('Products can only be fetched for Pancake POS integrations');
    }

    const credentials = await this.getDecryptedCredentials(id, tenantId);
    const apiKey = credentials?.apiKey;
    const config = integration.config as any;
    const shopId = config?.shopId;

    if (!apiKey || !shopId) {
      throw new ConflictException('Missing API key or shop ID for this integration');
    }

    const products = await this.fetchProductsFromPancake(shopId, apiKey);

    // Find store with sharing-aware access (owned or shared via integration)
    const store = await this.prisma.posStore.findFirst({
      where: {
        tenantId,
        integrationId: integration.id,
      },
    });

    if (store) {
      await this.upsertStoreProducts(store.id, products);

      return this.prisma.posProduct.findMany({
        where: { storeId: store.id },
        orderBy: { name: 'asc' },
      });
    }

    return products;
  }

  async fetchPancakeProductsByShopId(shopId: string, overrideApiKey?: string): Promise<any[]> {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    // Build sharing-aware where clause (same logic as listPosStores/getPosStore)
    let where: any = { tenantId, shopId: shopId.toString() };
    const shouldRestrict = !isAdmin || (isAdmin && allowedTeams.length > 0);
    if (shouldRestrict) {
      if (allowedTeams.length === 0) {
        throw new NotFoundException(`Store with shop ID ${shopId} not found`);
      }
      where = {
        tenantId,
        shopId: shopId.toString(),
        OR: [
          { teamId: { in: allowedTeams } },
          // Integration owned by allowed teams
          { integration: { teamId: { in: allowedTeams } } },
          // Integration shared to allowed teams
          { integration: { sharedTeams: { some: { teamId: { in: allowedTeams } } } } },
        ],
      };
    }

    const store = await this.prisma.posStore.findFirst({
      where,
    });

    if (!store) {
      throw new NotFoundException(`Store with shop ID ${shopId} not found`);
    }

    let apiKeyToUse = overrideApiKey || store.apiKey;

    // Fallback: use integration credentials if store apiKey is missing
    if (!apiKeyToUse && store.integrationId) {
      try {
        const creds = await this.getDecryptedCredentials(store.integrationId, tenantId);
        if (creds?.apiKey) {
          apiKeyToUse = creds.apiKey;
          // Persist so future calls don't need the fallback
          await this.prisma.posStore.update({
            where: { id: store.id },
            data: { apiKey: apiKeyToUse },
          });
        }
      } catch {
        // swallow and fall through to conflict if still missing
      }
    }

    if (!apiKeyToUse) {
      throw new ConflictException('Missing API key for this store');
    }

    const products = await this.fetchProductsFromPancake(shopId, apiKeyToUse);

    await this.upsertStoreProducts(store.id, products);

    return this.prisma.posProduct.findMany({
      where: { storeId: store.id },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get decrypted credentials for an integration (internal use only)
   * This method should NEVER be exposed via API
   */
  async getDecryptedCredentials(
    integrationId: string,
    tenantIdOverride?: string,
  ): Promise<any> {
    // Accept explicit tenantId override (recommended for background jobs)
    // Fallback to integration.tenantId if not provided
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      select: { id: true, tenantId: true, credentials: true, teamId: true },
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${integrationId} not found`);
    }

    const tenantId = tenantIdOverride || integration.tenantId || this.cls.get('tenantId');
    const teamId = this.cls.get('teamId') || integration.teamId || null;
    if (!tenantId) {
      this.logger.error(
        `Missing tenantId when decrypting credentials for integration ${integrationId}. ` +
        `override=${tenantIdOverride ?? 'undefined'} integrationTenant=${integration.tenantId ?? 'undefined'} clsTenant=${this.cls.get('tenantId') ?? 'undefined'}`,
      );
      throw new ForbiddenException(
        `Tenant context is required to decrypt credentials for integration ${integrationId}`,
      );
    }

    // Enforce tenant match when override is provided
    if (tenantIdOverride && integration.tenantId && tenantIdOverride !== integration.tenantId) {
      throw new ForbiddenException('Integration does not belong to the provided tenant');
    }

    // Set CLS context when we have an explicit tenant (helps downstream callers)
    this.cls.set('tenantId', tenantId);
    this.cls.set('userRole', this.cls.get('userRole') || 'SYSTEM');
    if (teamId) {
      this.cls.set('teamId', teamId);
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { encryptionKey: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.encryptionService.decrypt(
      integration.credentials,
      tenant.encryptionKey,
    );
  }

  /**
   * Test connection for an integration
   */
  async testConnection(id: string): Promise<any> {
    const tenantId = this.cls.get('tenantId');
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    // Get integration
    const integration = await this.prisma.integration.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    // Get decrypted credentials
    const credentials = await this.getDecryptedCredentials(id, tenantId);

    // Create provider instance
    const provider = this.providerFactory.createProvider(
      integration.provider as any,
      credentials,
      integration.config as any,
    );

    // Test connection
    const result = await provider.testConnection();

    // Update integration status based on test result
    if (result.success) {
      const updateData: any = {
        status: 'ACTIVE',
      };

      // For Meta Ads, store user info in config
      if (integration.provider === 'META_ADS' && result.details) {
        updateData.config = {
          ...(integration.config as any),
          userId: result.details.userId,
          userName: result.details.userName,
        };
      }

      await this.prisma.integration.update({
        where: { id },
        data: updateData,
      });
    } else {
      await this.prisma.integration.update({
        where: { id },
        data: {
          status: 'ERROR',
        },
      });
    }

    return result;
  }

  /**
   * Sync Meta ad accounts from Meta API for a specific integration
   * Similar to Laravel Action - fetches and stores all ad accounts
   */
  async syncMetaAdAccounts(integrationId: string): Promise<number> {
    const { tenantId } = await this.teamContext.getContext();
    const access = await this.buildIntegrationAccessWhere({ id: integrationId });
    if (!access.where) {
      throw new NotFoundException('Integration not found');
    }

    const integration = await this.prisma.integration.findFirst({
      where: access.where,
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    if (integration.provider !== 'META_ADS') {
      throw new ConflictException('This operation is only for Meta Ads integrations');
    }

    // Get decrypted credentials
    const credentials = await this.getDecryptedCredentials(integrationId, tenantId);
    const provider = this.providerFactory.createProvider(
      IntegrationProvider.META_ADS,
      credentials,
      integration.config as any,
    ) as MetaAdsProvider;

    // Fetch ad accounts from Meta API
    const accounts = await provider.fetchAdAccounts();

    // Store in database (upsert pattern like Laravel)
    let synced = 0;
    const ownerTeamId = integration.teamId ?? null;
    for (const account of accounts) {
      await this.prisma.metaAdAccount.upsert({
        where: {
          tenantId_accountId: {
            tenantId,
            accountId: account.account_id,
          },
        },
        create: {
          tenantId,
          teamId: ownerTeamId,
          integrationId,
          accountId: account.account_id,
          name: account.name,
          currency: account.currency,
          currencyMultiplier: null,
          timezone: account.timezone_name,
          accountStatus: account.account_status,
          status: 'ACTIVE',
          enabled: null,
        },
        update: {
          name: account.name,
          currency: account.currency,
          timezone: account.timezone_name,
          accountStatus: account.account_status,
          status: 'ACTIVE',
          enabled: null,
          lastSyncAt: new Date(),
          teamId: ownerTeamId,
        },
      });
      synced++;
    }

    return synced;
  }

  /**
   * List all Meta ad accounts for current tenant
   * Non-admins only see accounts from their teams
   */
  async listMetaAdAccounts(): Promise<any[]> {
    const { where, tenantId, allowedTeams } = await this.buildIntegrationAccessWhere();
    if (!where) return [];

    let accountWhere: any = { tenantId };
    // Restrict by teams or shared teams when scoped
    const restrict = allowedTeams && allowedTeams.length > 0;
    if (restrict) {
      accountWhere = {
        tenantId,
        OR: [
          { teamId: { in: allowedTeams } },
          { integration: { sharedTeams: { some: { teamId: { in: allowedTeams } } } } },
        ],
      };
    }

    return this.prisma.metaAdAccount.findMany({
      where: accountWhere,
      include: {
        integration: {
          select: { id: true, name: true, enabled: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get Meta ad accounts for a specific integration
   */
  async getMetaAdAccountsByIntegration(integrationId: string): Promise<any[]> {
    const access = await this.buildIntegrationAccessWhere({ id: integrationId });
    if (!access.where) {
      throw new NotFoundException('Integration not found');
    }

    return this.prisma.metaAdAccount.findMany({
      where: { tenantId: access.tenantId, integrationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update currency multiplier for selected Meta ad accounts (non-PHP only)
   */
  async updateMetaAdAccountMultipliers(
    integrationId: string,
    accountIds: string[],
    multiplier: number,
  ) {
    if (!accountIds || accountIds.length === 0) {
      return { updated: 0 };
    }
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      throw new BadRequestException('multiplier must be a positive number');
    }

    const access = await this.buildIntegrationAccessWhere({ id: integrationId });
    if (!access.where) {
      throw new NotFoundException('Integration not found');
    }

    const result = await this.prisma.metaAdAccount.updateMany({
      where: {
        tenantId: access.tenantId,
        integrationId,
        accountId: { in: accountIds },
        currency: { not: 'PHP' },
      },
      data: { currencyMultiplier: multiplier },
    });

    return { updated: result.count };
  }

  // ============================================================================
  // COGS (Cost of Goods Sold) Management
  // ============================================================================

  /**
   * Get COGS history for a product in a store
   */
  async getProductCogsHistory(productId: string, storeId: string) {
    const { tenantId } = await this.teamContext.getContext();
    const storeWhere = await this.teamContext.buildTeamWhereClause({ id: storeId });

    // Verify store belongs to user's accessible teams
    const store = await this.prisma.posStore.findFirst({
      where: storeWhere,
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    // Verify product belongs to this store
    const product = await this.prisma.posProduct.findFirst({
      where: { id: productId, storeId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found in this store`);
    }

    const cogsWhere = await this.teamContext.buildTeamWhereClause({ productId, storeId, tenantId });

    return this.prisma.posProductCogs.findMany({
      where: cogsWhere,
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Get current active COGS for a product in a store
   */
  async getCurrentCogs(productId: string, storeId: string) {
    const where = await this.teamContext.buildTeamWhereClause({
      productId,
      storeId,
      endDate: null, // Currently active
    });

    return this.prisma.posProductCogs.findFirst({
      where,
    });
  }

  /**
   * Get COGS for a product on a specific date (used in Meta attribution)
   */
  async getCogsForDate(productId: string, storeId: string, date: Date) {
    const where = await this.teamContext.buildTeamWhereClause({
      productId,
      storeId,
      startDate: { lte: date },
      OR: [{ endDate: { gte: date } }, { endDate: null }],
    });

    const entry = await this.prisma.posProductCogs.findFirst({
      where,
    });

    return entry?.cogs || null;
  }

  /**
   * Add new COGS entry for a product
   * Automatically closes previous active entry
   */
  async addCogsEntry(
    productId: string,
    storeId: string,
    cogs: number,
    startDate: Date,
  ) {
    const { tenantId } = await this.teamContext.getContext();
    const storeWhere = await this.teamContext.buildTeamWhereClause({ id: storeId });

    // Verify store belongs to user's accessible teams
    const store = await this.prisma.posStore.findFirst({
      where: storeWhere,
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    // Verify product belongs to this store
    const product = await this.prisma.posProduct.findFirst({
      where: { id: productId, storeId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found in this store`);
    }

    // Check for existing entry with same start date
    const existingEntryWhere = await this.teamContext.buildTeamWhereClause({
      productId,
      storeId,
      startDate,
    });

    const existingEntry = await this.prisma.posProductCogs.findFirst({
      where: existingEntryWhere,
    });

    if (existingEntry) {
      throw new ConflictException(
        'COGS entry with this start date already exists',
      );
    }

    const baseWhere = await this.teamContext.buildTeamWhereClause({ productId, storeId });
    const nextEntry = await this.prisma.posProductCogs.findFirst({
      where: {
        ...baseWhere,
        startDate: { gt: startDate },
      },
      orderBy: { startDate: 'asc' },
    });
    const prevEntry = await this.prisma.posProductCogs.findFirst({
      where: {
        ...baseWhere,
        startDate: { lt: startDate },
      },
      orderBy: { startDate: 'desc' },
    });

    // If there's a future entry, cap this one to the day before it starts.
    let newEndDate: Date | null = null;
    if (nextEntry) {
      newEndDate = new Date(nextEntry.startDate);
      newEndDate.setDate(newEndDate.getDate() - 1);
      if (newEndDate < startDate) {
        throw new BadRequestException('COGS entry overlaps an existing entry');
      }
    }

    // Validate and get effective team ID
    const effectiveTeamId = await this.teamContext.validateAndGetTeamId(store.teamId);

    // Create new entry and adjust previous entry (if overlapping) in a transaction
    return this.prisma.$transaction(async (tx) => {
      if (prevEntry && (prevEntry.endDate === null || prevEntry.endDate >= startDate)) {
        const prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        await tx.posProductCogs.update({
          where: { id: prevEntry.id },
          data: { endDate: prevEndDate },
        });
      }

      return tx.posProductCogs.create({
        data: {
          tenantId,
          teamId: effectiveTeamId,
          productId,
          storeId,
          cogs,
          startDate,
          endDate: newEndDate, // Active until next change or until next entry starts
        },
      });
    });
  }

  /**
   * Update existing COGS entry
   */
  async updateCogsEntry(
    cogsId: string,
    cogs: number,
    startDate: Date,
  ) {
    const where = await this.teamContext.buildTeamWhereClause({ id: cogsId });

    const existingEntry = await this.prisma.posProductCogs.findFirst({
      where,
    });

    if (!existingEntry) {
      throw new NotFoundException('COGS entry not found');
    }

    // Check for conflicts with other entries if start date is changing
    if (startDate.getTime() !== existingEntry.startDate.getTime()) {
      const conflictWhere = await this.teamContext.buildTeamWhereClause({
        productId: existingEntry.productId,
        storeId: existingEntry.storeId,
        startDate,
        id: { not: cogsId },
      });

      const conflictEntry = await this.prisma.posProductCogs.findFirst({
        where: conflictWhere,
      });

      if (conflictEntry) {
        throw new ConflictException(
          'Another COGS entry with this start date already exists',
        );
      }
    }

    return this.prisma.posProductCogs.update({
      where: { id: cogsId },
      data: { cogs, startDate },
    });
  }

  /**
   * Delete COGS entry
   * If deleting current active entry, makes previous entry active again
   */
  async deleteCogsEntry(cogsId: string): Promise<void> {
    const { tenantId } = await this.teamContext.getContext();
    const where = await this.teamContext.buildTeamWhereClause({ id: cogsId });

    const entry = await this.prisma.posProductCogs.findFirst({
      where,
    });

    if (!entry) {
      throw new NotFoundException('COGS entry not found');
    }

    // If deleting current active entry, make previous entry active again
    if (entry.endDate === null) {
      const previousWhere = await this.teamContext.buildTeamWhereClause({
        productId: entry.productId,
        storeId: entry.storeId,
        endDate: { lt: entry.startDate },
      });

      const previousEntry = await this.prisma.posProductCogs.findFirst({
        where: previousWhere,
        orderBy: { startDate: 'desc' },
      });

      if (previousEntry) {
        await this.prisma.posProductCogs.update({
          where: { id: previousEntry.id },
          data: { endDate: null },
        });
      }
    }

    await this.prisma.posProductCogs.delete({
      where: { id: cogsId },
    });
  }

  async getMetaInsightsByIntegration(
    integrationId: string,
    accountId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const access = await this.buildIntegrationAccessWhere({ id: integrationId });
    if (!access.where) {
      throw new NotFoundException(`Integration with ID ${integrationId} not found`);
    }

    const integration = await this.prisma.integration.findFirst({
      where: access.where,
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${integrationId} not found`);
    }

    const accounts = await this.prisma.metaAdAccount.findMany({
      where: { tenantId: access.tenantId, integrationId },
      select: { tenantId: true, accountId: true, teamId: true },
    });

    // Backfill existing insights that are missing teamId so they show up under team scope
    await this.metaInsightService.backfillTeamIdsForAccounts(accounts);

    const accountIds = accounts.map((a) => a.accountId);
    if (accountIds.length === 0) {
      return [];
    }

    const normalizedAccountId = accountId ? accountId.replace(/^act_/, '') : undefined;
    const accountFilter =
      normalizedAccountId && accountIds.includes(normalizedAccountId)
        ? normalizedAccountId
        : undefined;

    const insightsWhere: any = {
      tenantId: access.tenantId,
      accountId: accountFilter ? accountFilter : { in: accountIds },
    };

    if (dateFrom || dateTo) {
      insightsWhere.date = {};
      if (dateFrom) insightsWhere.date.gte = new Date(dateFrom);
      if (dateTo) insightsWhere.date.lte = new Date(dateTo);
    }

    return this.prisma.metaAdInsight.findMany({
      where: insightsWhere,
      orderBy: [{ date: 'desc' }, { spend: 'desc' }],
      take: 500,
    });
  }
}
