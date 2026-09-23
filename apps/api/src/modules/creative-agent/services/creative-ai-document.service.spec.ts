import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CreativeAiDocumentService, DOCUMENT_LIMITS } from './creative-ai-document.service';

const staging = mkdtempSync(join(tmpdir(), 'creative-ai-docs-'));

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '99999999-9999-4999-8999-999999999999';
const userId = '22222222-2222-4222-8222-222222222222';
const storeConfigId = '44444444-4444-4444-8444-444444444444';
const actor = { userId, tenantId } as any;

type Row = { id: string; tenantId: string; title: string; scope: 'TENANT' | 'STORE' | 'PRODUCT'; storeConfigId: string | null; productName: string | null; version: number; text: string; active: boolean; status: string };

function setup(rows: Row[] = [], permissions = ['creative_agent.ai.use', 'creative_agent.ai.manage']) {
  const context = { tenantId, userId, isSuperAdmin: false, permissions: new Set(permissions) };
  const prisma: any = {
    creativeAiReferenceDocument: {
      // The mock applies the tenant clause itself, so a query that forgot it
      // would leak the other tenant's rows and fail the assertions below.
      findMany: jest.fn(async (args: any) => rows.filter((row) => row.tenantId === args.where.tenantId && row.active).map((row) => ({ ...row, storeConfig: null, uploadedBy: null }))),
      findFirst: jest.fn(async (args: any) => rows.find((row) => row.tenantId === args.where.tenantId && (!args.where.id || row.id === args.where.id)) ?? null),
      create: jest.fn(async (args: any) => ({ id: 'doc-new', ...args.data, storeConfig: null, uploadedBy: null, createdAt: new Date() })),
      update: jest.fn(async () => ({})),
    },
    creativeStoreConfig: {
      findFirst: jest.fn(async (args: any) => (args.where.tenantId === tenantId && args.where.id === storeConfigId ? { id: storeConfigId } : null)),
      findMany: jest.fn(async () => [{ id: storeConfigId, storeNameSnapshot: 'Ogimi Wellness' }]),
    },
    auditLog: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn))),
  };
  const access = {
    resolve: jest.fn(async () => context),
    require: jest.fn((_ctx: any, ...required: string[]) => {
      if (!required.some((permission) => permissions.includes(permission))) throw new Error('Insufficient permissions');
    }),
    has: jest.fn((_ctx: any, permission: string) => permissions.includes(permission)),
  };
  const storage = { isConfigured: () => false, uploadObject: jest.fn() };
  return { service: new CreativeAiDocumentService(prisma, access as any, storage as any), prisma };
}

const row = (overrides: Partial<Row>): Row => ({
  id: 'doc', tenantId, title: 'Doc', scope: 'TENANT', storeConfigId: null, productName: null, version: 1, text: 'x'.repeat(100), active: true, status: 'READY', ...overrides,
});

describe('CreativeAiDocumentService.forCreative', () => {
  it('says so when nothing was uploaded, rather than leaving the block empty', async () => {
    const { service } = setup();
    const result = await service.forCreative(tenantId, storeConfigId, 'Cellular Defense');
    expect(result.text).toMatch(/No reference documents were uploaded/);
    expect(result.used).toEqual([]);
  });

  it('orders the product document before the store before the tenant, and names each scope', async () => {
    const { service } = setup([
      row({ id: 't', title: 'Brand rules', scope: 'TENANT' }),
      row({ id: 'p', title: 'Claim sheet', scope: 'PRODUCT', storeConfigId, productName: 'Cellular Defense' }),
      row({ id: 's', title: 'Store voice', scope: 'STORE', storeConfigId }),
    ]);
    const result = await service.forCreative(tenantId, storeConfigId, 'Cellular Defense');
    expect(result.used.map((doc) => doc.id)).toEqual(['p', 's', 't']);
    expect(result.text).toContain('### Claim sheet (applies to this product, version 1)');
    expect(result.text).toContain('### Brand rules (applies to every store, version 1)');
  });

  it('keeps the run under budget by truncating, then skipping, and says what it dropped', async () => {
    // Over the whole run budget on its own, so the first is cut and the second cannot fit at all.
    const big = 'y'.repeat(DOCUMENT_LIMITS.maxCharactersPerRun + 1_000);
    const { service } = setup([
      row({ id: 'a', title: 'A', text: big }),
      row({ id: 'b', title: 'B', text: big }),
    ]);
    const result = await service.forCreative(tenantId, storeConfigId, null);
    expect(result.used).toHaveLength(1);
    expect(result.used[0].truncated).toBe(true);
    expect(result.text).toMatch(/more characters not shown/);
    expect(result.text).toMatch(/1 further document\(s\) did not fit/);
    expect(result.text.length).toBeLessThan(DOCUMENT_LIMITS.maxCharactersPerRun + 400);
  });

  it('never reads another tenant\'s documents', async () => {
    const { service, prisma } = setup([row({ id: 'theirs', tenantId: otherTenantId, title: 'Their secrets' })]);
    const result = await service.forCreative(tenantId, storeConfigId, null);
    expect(result.used).toEqual([]);
    expect(prisma.creativeAiReferenceDocument.findMany.mock.calls[0][0].where.tenantId).toBe(tenantId);
  });
});

describe('CreativeAiDocumentService.upload', () => {
  /** A staged file the way multer leaves it: on disk, with its original name beside it. */
  const file = (name: string, text = 'Never say guaranteed. Price before the CTA. '.repeat(3)) => {
    const path = join(staging, `${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`);
    writeFileSync(path, text);
    return { path, originalname: name, mimetype: 'text/plain', size: Buffer.byteLength(text) };
  };

  it('extracts plain text, estimates the cost and defaults the title to the file name', async () => {
    const { service } = setup();
    const created = await service.upload(actor, { scope: 'TENANT' } as any, file('brand-rules.txt'));
    expect(created.title).toBe('brand-rules');
    expect(created.status).toBe('READY');
    expect(created.tokenEstimate).toBe(Math.ceil(created.characterCount / 4));
  });

  it('refuses a file type it cannot read, before touching the database, and still removes the staged copy', async () => {
    const { service, prisma } = setup();
    const staged = file('video.mp4');
    await expect(service.upload(actor, { scope: 'TENANT' } as any, staged)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.creativeAiReferenceDocument.create).not.toHaveBeenCalled();
    expect(existsSync(staged.path)).toBe(false);
  });

  it('removes the staged copy after a successful upload', async () => {
    const { service } = setup();
    const staged = file('rules.txt');
    await service.upload(actor, { scope: 'TENANT' } as any, staged);
    expect(existsSync(staged.path)).toBe(false);
  });

  it('refuses a store scope without a store, and a store from another tenant', async () => {
    const { service } = setup();
    await expect(service.upload(actor, { scope: 'STORE' } as any, file('a.txt'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.upload(actor, { scope: 'STORE', storeConfigId: '55555555-5555-4555-8555-555555555555' } as any, file('a.txt'))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks a file with no usable text instead of pretending it was read', async () => {
    const { service } = setup();
    const created = await service.upload(actor, { scope: 'TENANT' } as any, file('empty.txt', '  \n '));
    expect(created.status).toBe('UNSUPPORTED');
    expect(created.characterCount).toBe(0);
  });

  it('retires the previous version of the same title and numbers the new one', async () => {
    const { service, prisma } = setup([row({ id: 'old', title: 'brand-rules', version: 2 })]);
    const created = await service.upload(actor, { scope: 'TENANT' } as any, file('brand-rules.txt'));
    expect(created.version).toBe(3);
    expect(prisma.creativeAiReferenceDocument.update).toHaveBeenCalledWith({ where: { id: 'old' }, data: { active: false } });
  });
});
