import { ForbiddenException } from '@nestjs/common';
import { CreativeAiEffort, CreativeAiProvider } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { CreativeAiPolicyService } from './creative-ai-policy.service';

describe('CreativeAiPolicyService', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const context = {
    tenantId,
    userId,
    isSuperAdmin: false,
    permissions: new Set(['creative_agent.ai.use']),
  };

  function setup(
    policy: Record<string, unknown> | null = null,
    permissions: string[] = ['creative_agent.ai.use'],
  ) {
    const resolvedContext = { ...context, permissions: new Set(permissions) };
    const prisma = {
      creativeAiPolicy: { findUnique: jest.fn(async () => policy) },
      auditLog: { create: jest.fn(async () => ({})) },
    };
    const access = {
      resolve: jest.fn(async () => resolvedContext),
      require: jest.fn((_context: typeof resolvedContext, ...required: string[]) => {
        if (!required.some((permission) => permissions.includes(permission))) {
          throw new ForbiddenException('Insufficient creative workspace permissions');
        }
      }),
      has: jest.fn((_context: typeof resolvedContext, permission: string) => permissions.includes(permission)),
    };
    const gateway = {
      providers: jest.fn(async () => [
        {
          provider: 'CLAUDE', available: true, connected: true, models: [
            { id: 'sonnet', label: 'Claude Sonnet', supportedEfforts: ['LOW', 'MEDIUM', 'HIGH'], defaultEffort: 'MEDIUM' },
          ],
        },
        {
          provider: 'CODEX', available: true, connected: true, models: [
            { id: 'gpt-5.6-terra', label: 'GPT 5.6 Terra', supportedEfforts: ['LOW', 'MEDIUM', 'HIGH', 'XHIGH'], defaultEffort: 'MEDIUM' },
          ],
        },
      ]),
      startLogin: jest.fn(async () => ({ loginId: 'login-1', status: 'WAITING' })),
      loginStatus: jest.fn(),
      logout: jest.fn(),
      test: jest.fn(),
    };
    return {
      service: new CreativeAiPolicyService(prisma as any, access as any, gateway as any),
      prisma,
      access,
      gateway,
    };
  }

  it('uses tenant defaults when per-run overrides are disabled', async () => {
    const { service } = setup({
      tenantId,
      defaultProvider: CreativeAiProvider.CODEX,
      claudeModel: 'sonnet',
      codexModel: 'gpt-5.6-terra',
      defaultEffort: CreativeAiEffort.HIGH,
      maxTurns: 8,
      maxBudgetUsd: 2,
      allowRunOverrides: false,
      updatedAt: new Date(),
    });

    await expect(service.resolveRunSettings(context, {
      creativeId: '33333333-3333-4333-8333-333333333333',
      provider: CreativeAiProvider.CLAUDE,
      model: 'sonnet',
      effort: CreativeAiEffort.LOW,
    })).resolves.toEqual({
      provider: CreativeAiProvider.CODEX,
      model: 'gpt-5.6-terra',
      effort: CreativeAiEffort.HIGH,
      maxTurns: 8,
      maxBudgetUsd: 2,
    });
  });

  it('rejects provider account changes without tenant AI management', async () => {
    const { service, gateway } = setup();

    await expect(service.startLogin({ role: 'USER', tenantId, userId }, 'claude'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(gateway.startLogin).not.toHaveBeenCalled();
  });

  it('scopes provider account changes to the authenticated tenant', async () => {
    const { service, gateway } = setup(null, ['creative_agent.ai.manage']);

    await expect(service.startLogin({ role: 'USER', tenantId, userId }, 'claude'))
      .resolves.toMatchObject({ status: 'WAITING' });
    expect(gateway.startLogin).toHaveBeenCalledWith(tenantId, 'CLAUDE');
  });

  it('rejects a thinking level unsupported by the selected model', async () => {
    const { service } = setup();

    await expect(service.resolveRunSettings(context, {
      creativeId: '33333333-3333-4333-8333-333333333333',
      provider: CreativeAiProvider.CLAUDE,
      model: 'sonnet',
      effort: CreativeAiEffort.MAX,
    })).rejects.toThrow('does not support the selected thinking level');
  });
});
