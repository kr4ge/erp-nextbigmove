import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CreativeAiEffort, CreativeAiProvider, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import {
  StartCreativeAiRunDto,
  UpdateCreativeAiHouseRulesDto,
  UpdateCreativeAiPolicyDto,
  UpdateCreativeAiStoreContextDto,
} from '../dto/creative-ai-run.dto';
import { CREATIVE_AI_LENSES, DEFAULT_HOUSE_RULES } from '../prompts/creative-ai-analysis.prompt';
import { creativeAiNicheOptions, isCreativeAiNiche } from '../prompts/creative-ai-niches';
import type { CreativeActor, CreativeAccessContext } from '../types/creative-actor.type';
import { AiGatewayAdminClientService, type AiProviderKey } from './ai-gateway-admin-client.service';
import { CreativeAccessService } from './creative-access.service';

export type ResolvedCreativeAiSettings = {
  provider: CreativeAiProvider;
  model: string;
  effort: CreativeAiEffort;
  maxTurns: number;
  maxRunMinutes: number;
};

const FALLBACK_POLICY = {
  defaultProvider: CreativeAiProvider.CLAUDE,
  claudeModel: 'sonnet',
  codexModel: 'gpt-5.6-terra',
  defaultEffort: CreativeAiEffort.MEDIUM,
  maxTurns: 12,
  maxRunMinutes: 15,
  allowRunOverrides: true,
  analysisHouseRules: null as string | null,
};

@Injectable()
export class CreativeAiPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly gateway: AiGatewayAdminClientService,
  ) {}

  async get(actor: CreativeActor) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_USE, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE);
    const policy = await this.policy(context.tenantId);
    const providers = await this.gateway.providers(context.tenantId).catch((error) => this.unavailableProviders(error));
    return {
      policy: this.serializePolicy(policy),
      providers,
      prompt: {
        houseRules: policy.analysisHouseRules ?? null,
        defaultHouseRules: DEFAULT_HOUSE_RULES,
        lenses: CREATIVE_AI_LENSES,
        niches: creativeAiNicheOptions(),
        stores: await this.storeContexts(context.tenantId),
      },
      permissions: {
        canConfigure: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE),
        canManageConnections: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE),
        canOverrideRuns: policy.allowRunOverrides,
        // The analysis prompt belongs to the advertising team, not the tenant admin.
        canEditHouseRules: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE),
      },
    };
  }

  /**
   * House rules are the only editable part of the analysis prompt and are
   * owned by whoever manages creative performance (the advertiser role).
   */
  async updateHouseRules(actor: CreativeActor, dto: UpdateCreativeAiHouseRulesDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE);
    const houseRules = dto.houseRules.trim() || null;
    const saved = await this.prisma.$transaction(async (tx) => {
      const policy = await tx.creativeAiPolicy.upsert({
        where: { tenantId: context.tenantId },
        create: {
          tenantId: context.tenantId,
          defaultProvider: FALLBACK_POLICY.defaultProvider,
          claudeModel: FALLBACK_POLICY.claudeModel,
          codexModel: FALLBACK_POLICY.codexModel,
          defaultEffort: FALLBACK_POLICY.defaultEffort,
          maxTurns: FALLBACK_POLICY.maxTurns,
          maxRunMinutes: FALLBACK_POLICY.maxRunMinutes,
          allowRunOverrides: FALLBACK_POLICY.allowRunOverrides,
          analysisHouseRules: houseRules,
          updatedById: context.userId,
        },
        update: { analysisHouseRules: houseRules, updatedById: context.userId },
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.ai.house_rules.update',
          resource: 'CreativeAiPolicy',
          resourceId: context.tenantId,
          changes: { characters: houseRules?.length ?? 0, cleared: houseRules === null },
        },
      });
      return policy;
    });
    return { houseRules: saved.analysisHouseRules ?? null, defaultHouseRules: DEFAULT_HOUSE_RULES };
  }

  /** Stores with their niche pack and store-only rules, for the settings page. */
  private async storeContexts(tenantId: string) {
    const stores = await this.prisma.creativeStoreConfig.findMany({
      where: { tenantId, active: true },
      select: { id: true, storeNameSnapshot: true, codePrefix: true, aiNiche: true, aiStoreRules: true },
      orderBy: { storeNameSnapshot: 'asc' },
    });
    return stores.map((store) => ({
      id: store.id,
      name: store.storeNameSnapshot,
      codePrefix: store.codePrefix,
      niche: store.aiNiche,
      storeRules: store.aiStoreRules ?? null,
    }));
  }

  /** The niche pack and rules for one store. Advertiser-owned, like house rules. */
  async updateStoreContext(actor: CreativeActor, storeConfigId: string, dto: UpdateCreativeAiStoreContextDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.PERFORMANCE_MANAGE);
    if (!isCreativeAiNiche(dto.niche)) {
      throw new BadRequestException('Unknown product category');
    }
    const store = await this.prisma.creativeStoreConfig.findFirst({
      where: { id: storeConfigId, tenantId: context.tenantId },
      select: { id: true, storeNameSnapshot: true },
    });
    if (!store) throw new BadRequestException('Store not found in this tenant');

    const storeRules = dto.storeRules?.trim() || null;
    await this.prisma.$transaction([
      this.prisma.creativeStoreConfig.update({
        where: { id: store.id },
        data: { aiNiche: dto.niche, aiStoreRules: storeRules },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.ai.store_context.update',
          resource: 'CreativeStoreConfig',
          resourceId: store.id,
          changes: { store: store.storeNameSnapshot, niche: dto.niche, storeRuleCharacters: storeRules?.length ?? 0 },
        },
      }),
    ]);
    return { stores: await this.storeContexts(context.tenantId) };
  }

  async update(actor: CreativeActor, dto: UpdateCreativeAiPolicyDto) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE);
    await this.validateSettings(
      context.tenantId,
      dto.defaultProvider,
      dto.defaultProvider === 'CLAUDE' ? dto.claudeModel : dto.codexModel,
      dto.defaultEffort,
    );
    const policy = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.creativeAiPolicy.upsert({
        where: { tenantId: context.tenantId },
        create: {
          tenantId: context.tenantId,
          defaultProvider: dto.defaultProvider,
          claudeModel: dto.claudeModel,
          codexModel: dto.codexModel,
          defaultEffort: dto.defaultEffort,
          maxTurns: dto.maxTurns,
          maxRunMinutes: dto.maxRunMinutes,
          allowRunOverrides: dto.allowRunOverrides,
          updatedById: context.userId,
        },
        update: {
          defaultProvider: dto.defaultProvider,
          claudeModel: dto.claudeModel,
          codexModel: dto.codexModel,
          defaultEffort: dto.defaultEffort,
          maxTurns: dto.maxTurns,
          maxRunMinutes: dto.maxRunMinutes,
          allowRunOverrides: dto.allowRunOverrides,
          updatedById: context.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.ai.policy.update',
          resource: 'CreativeAiPolicy',
          resourceId: context.tenantId,
          changes: this.serializePolicy(saved),
        },
      });
      return saved;
    });
    return this.serializePolicy(policy);
  }

  async resolveRunSettings(context: CreativeAccessContext, dto: StartCreativeAiRunDto): Promise<ResolvedCreativeAiSettings> {
    const policy = await this.policy(context.tenantId);
    const provider = policy.allowRunOverrides && dto.provider ? dto.provider : policy.defaultProvider;
    const configuredModel = provider === CreativeAiProvider.CLAUDE ? policy.claudeModel : policy.codexModel;
    const model = policy.allowRunOverrides && dto.model ? dto.model : configuredModel;
    const effort = policy.allowRunOverrides && dto.effort ? dto.effort : policy.defaultEffort;
    await this.validateSettings(context.tenantId, provider, model, effort);
    return {
      provider,
      model,
      effort,
      maxTurns: policy.maxTurns,
      maxRunMinutes: policy.maxRunMinutes,
    };
  }

  async test(actor: CreativeActor, provider: string) {
    const context = await this.connectionContext(actor);
    return this.gateway.test(context.tenantId, this.provider(provider));
  }

  async startLogin(actor: CreativeActor, provider: string) {
    const context = await this.connectionContext(actor);
    const selected = this.provider(provider);
    const result = await this.gateway.startLogin(context.tenantId, selected);
    await this.auditProviderAction(context, 'creative.ai.provider.login.start', selected, {
      status: result.status,
    });
    return result;
  }

  async loginStatus(actor: CreativeActor, provider: string, loginId: string) {
    const context = await this.connectionContext(actor);
    return this.gateway.loginStatus(context.tenantId, this.provider(provider), loginId);
  }

  async submitLoginCode(actor: CreativeActor, provider: string, loginId: string, code: string) {
    const context = await this.connectionContext(actor);
    return this.gateway.submitLoginCode(context.tenantId, this.provider(provider), loginId, code);
  }

  async logout(actor: CreativeActor, provider: string) {
    const context = await this.connectionContext(actor);
    const selected = this.provider(provider);
    const result = await this.gateway.logout(context.tenantId, selected);
    await this.auditProviderAction(context, 'creative.ai.provider.logout', selected, { ok: result.ok });
    return result;
  }

  private policy(tenantId: string) {
    return this.prisma.creativeAiPolicy.findUnique({ where: { tenantId } })
      .then((policy) => policy || { tenantId, ...FALLBACK_POLICY });
  }

  private async validateSettings(
    tenantId: string,
    provider: CreativeAiProvider,
    model: string,
    effort: CreativeAiEffort,
  ) {
    const providers = await this.gateway.providers(tenantId).catch((error) => {
      throw new ServiceUnavailableException(`AI provider status is unavailable: ${this.message(error)}`);
    });
    const selected = providers.find((entry) => entry.provider === provider);
    if (!selected?.available) throw new ServiceUnavailableException(`${this.label(provider)} is not installed in the AI gateway.`);
    if (!selected.connected) throw new ServiceUnavailableException(`${this.label(provider)} is not connected for this tenant. Ask the tenant administrator to connect it.`);
    const selectedModel = selected.models.find((entry) => entry.id === model);
    if (selected.models.length && !selectedModel) {
      throw new BadRequestException(`${model} is not available for ${this.label(provider)}.`);
    }
    if (selectedModel && !selectedModel.supportedEfforts.includes(effort)) {
      throw new BadRequestException(`${this.label(provider)} ${selectedModel.label} does not support the selected thinking level.`);
    }
  }

  private serializePolicy(policy: any) {
    return {
      defaultProvider: policy.defaultProvider,
      claudeModel: policy.claudeModel,
      codexModel: policy.codexModel,
      defaultEffort: policy.defaultEffort,
      maxTurns: policy.maxTurns,
      maxRunMinutes: policy.maxRunMinutes,
      allowRunOverrides: policy.allowRunOverrides,
      updatedAt: policy.updatedAt || null,
    };
  }

  private unavailableProviders(error: unknown): any[] {
    const message = `AI gateway is unavailable: ${this.message(error)}`;
    return (['CLAUDE', 'CODEX'] as const).map((provider) => ({
      provider,
      available: false,
      connected: false,
      authMethod: null,
      accountLabel: null,
      planType: null,
      message,
      models: [],
    }));
  }

  private provider(value: string): AiProviderKey {
    const normalized = value.toUpperCase();
    if (normalized !== 'CLAUDE' && normalized !== 'CODEX') {
      throw new BadRequestException('Provider must be Claude or Codex');
    }
    return normalized;
  }

  private async connectionContext(actor: CreativeActor) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE);
    return context;
  }

  private async auditProviderAction(
    context: CreativeAccessContext,
    action: string,
    provider: AiProviderKey,
    changes: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action,
        resource: 'CreativeAiProvider',
        resourceId: provider,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  }

  private label(provider: CreativeAiProvider) {
    return provider === CreativeAiProvider.CLAUDE ? 'Claude' : 'Codex';
  }

  private message(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
