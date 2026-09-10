import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CreativeAiEffort, CreativeAiProvider, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import { StartCreativeAiRunDto, UpdateCreativeAiPolicyDto } from '../dto/creative-ai-run.dto';
import type { CreativeActor, CreativeAccessContext } from '../types/creative-actor.type';
import { AiGatewayAdminClientService, type AiProviderKey } from './ai-gateway-admin-client.service';
import { CreativeAccessService } from './creative-access.service';

export type ResolvedCreativeAiSettings = {
  provider: CreativeAiProvider;
  model: string;
  effort: CreativeAiEffort;
  maxTurns: number;
  maxBudgetUsd: number;
};

const FALLBACK_POLICY = {
  defaultProvider: CreativeAiProvider.CLAUDE,
  claudeModel: 'sonnet',
  codexModel: 'gpt-5.6-terra',
  defaultEffort: CreativeAiEffort.MEDIUM,
  maxTurns: 12,
  maxBudgetUsd: new Prisma.Decimal(1),
  allowRunOverrides: true,
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
      permissions: {
        canConfigure: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE),
        canManageConnections: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE),
        canOverrideRuns: policy.allowRunOverrides,
      },
    };
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
          maxBudgetUsd: dto.maxBudgetUsd,
          allowRunOverrides: dto.allowRunOverrides,
          updatedById: context.userId,
        },
        update: {
          defaultProvider: dto.defaultProvider,
          claudeModel: dto.claudeModel,
          codexModel: dto.codexModel,
          defaultEffort: dto.defaultEffort,
          maxTurns: dto.maxTurns,
          maxBudgetUsd: dto.maxBudgetUsd,
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
      maxBudgetUsd: Number(policy.maxBudgetUsd),
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
      maxBudgetUsd: Number(policy.maxBudgetUsd),
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
