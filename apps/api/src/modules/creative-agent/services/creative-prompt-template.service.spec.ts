import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { PROMPT_KINDS } from '../prompts/creative-prompt-router';
import { CreativePromptTemplateService } from './creative-prompt-template.service';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const actor = { userId, tenantId } as any;

function setup(options: { active?: any; maxVersion?: number | null; rows?: any[] } = {}) {
  const permissions = ['creative_agent.ai.use', 'creative_agent.performance.manage'];
  const context = { tenantId, userId, isSuperAdmin: false, permissions: new Set(permissions) };
  const template = {
    findFirst: jest.fn(async () => (options.active === undefined ? null : options.active)),
    aggregate: jest.fn(async () => ({ _max: { version: options.maxVersion ?? null } })),
    updateMany: jest.fn(async () => ({ count: 1 })),
    create: jest.fn(async (args: any) => ({ id: 'tpl-new', createdAt: new Date(), ...args.data })),
    findUnique: jest.fn(async () => null),
    update: jest.fn(async (args: any) => ({ id: args.where.id, isActive: true })),
    findMany: jest.fn(async () => options.rows ?? []),
  };
  const prisma: any = {
    creativeAiPromptTemplate: template,
    auditLog: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
  };
  const access = {
    resolve: jest.fn(async () => context),
    require: jest.fn((_ctx: any, ...required: string[]) => {
      if (!required.some((permission) => permissions.includes(permission))) throw new Error('Insufficient permissions');
    }),
  };
  return { service: new CreativePromptTemplateService(prisma, access as any), prisma, template };
}

describe('CreativePromptTemplateService.resolve', () => {
  it('falls back to the built-in default when nothing is saved', async () => {
    const { service } = setup();
    const resolved = await service.resolve(tenantId, 'RUNNING_ANALYST');
    expect(resolved.isDefault).toBe(true);
    expect(resolved.templateId).toBeNull();
    expect(resolved.body).toBe(PROMPT_KINDS.RUNNING_ANALYST.defaultBody);
    expect(resolved.version).toBe(PROMPT_KINDS.RUNNING_ANALYST.defaultVersion);
  });

  it('uses the active saved version when there is one', async () => {
    const { service } = setup({ active: { id: 'tpl-3', body: 'custom text', version: 3 } });
    const resolved = await service.resolve(tenantId, 'NEW_REVIEWER');
    expect(resolved).toMatchObject({ isDefault: false, templateId: 'tpl-3', body: 'custom text', version: 3 });
  });
});

describe('CreativePromptTemplateService.update', () => {
  it('saves as the next version and retires the previous active one', async () => {
    // Every edit is a commit: nothing is overwritten, so any run can be read
    // against the exact words it was given.
    const { service, template } = setup({ maxVersion: 4 });
    await service.update(actor, 'NEW_REVIEWER', { body: 'v5 {{KNOWLEDGE_BASE}}', note: 'tighter hook rule' });
    expect(template.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
    expect(template.create.mock.calls[0][0].data).toMatchObject({ version: 5, isActive: true, note: 'tighter hook rule' });
  });

  it('starts at version 1 for a kind that has never been edited', async () => {
    const { service, template } = setup({ maxVersion: null });
    await service.update(actor, 'RUNNING_ANALYST', { body: 'first custom' });
    expect(template.create.mock.calls[0][0].data.version).toBe(1);
  });

  it('refuses an empty prompt and points at reset instead', async () => {
    const { service } = setup();
    await expect(service.update(actor, 'RUNNING_ANALYST', { body: '   ' })).rejects.toThrow(/Reset to default/);
  });

  it('refuses a prompt over the size limit', async () => {
    const { service } = setup();
    await expect(service.update(actor, 'RUNNING_ANALYST', { body: 'x'.repeat(60_001) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports tokens the system will not fill, without blocking the save', async () => {
    const { service } = setup();
    const saved = await service.update(actor, 'RUNNING_ANALYST', { body: 'Use {{STORE_NAME}} and {{MADE_UP}}' });
    expect(saved.unknownTokens).toEqual(['MADE_UP']);
  });

  it('records the change in the audit log', async () => {
    const { service, prisma } = setup();
    await service.update(actor, 'RUNNING_ANALYST', { body: 'text' });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});

describe('CreativePromptTemplateService.reset', () => {
  it('retires every active version so the default runs again', async () => {
    const { service, template } = setup();
    const described = await service.reset(actor, 'NEW_REVIEWER');
    expect(template.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
    expect(described.isDefault).toBe(true);
  });
});

describe('CreativePromptTemplateService.activate', () => {
  it('refuses a version that does not exist', async () => {
    const { service } = setup();
    await expect(service.activate(actor, 'NEW_REVIEWER', 9)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rolls back by activating an earlier version', async () => {
    const { service, template } = setup();
    template.findUnique.mockResolvedValueOnce({ id: 'tpl-2', version: 2 } as any);
    await service.activate(actor, 'NEW_REVIEWER', 2);
    expect(template.update).toHaveBeenCalledWith({ where: { id: 'tpl-2' }, data: { isActive: true } });
  });
});

describe('CreativePromptTemplateService.describe', () => {
  it('shows the variables, the appendix, and any unknown tokens', async () => {
    const { service } = setup({ active: { id: 'tpl-1', body: '{{STORE_NAME}} {{BOGUS}}', version: 1, note: null, createdAt: new Date(), createdBy: null } });
    const described = await service.describe(tenantId, 'RUNNING_ANALYST');
    expect(described.isDefault).toBe(false);
    expect(described.unknownTokens).toEqual(['BOGUS']);
    expect(described.appendix).toMatch(/OUTPUT \(fixed\)/);
    expect(described.variables.map((v) => v.token)).toContain('PRODUCT_NAME');
  });
});
