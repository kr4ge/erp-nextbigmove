import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { extname } from 'path';
import { CreativeAiDocumentScope, CreativeAiDocumentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ObjectStorageService } from '../../../common/services/object-storage.service';
import { CREATIVE_AGENT_PERMISSIONS } from '../creative-agent.constants';
import type { UploadCreativeAiDocumentDto } from '../dto/creative-ai-document.dto';
import type { CreativeActor } from '../types/creative-actor.type';
import { CreativeAccessService } from './creative-access.service';

/** Staged on disk by multer; the service reads it and removes it when done. */
export type UploadedDocumentFile = { path: string; originalname: string; mimetype: string; size: number };

/** What a run read, recorded beside the result so a verdict can be explained later. */
export type ReferenceDocumentUse = { id: string; title: string; scope: CreativeAiDocumentScope; version: number; truncated: boolean };

export const DOCUMENT_LIMITS = {
  maxFileMb: 200,
  /** Kept per document at upload; the rest is dropped with a note. */
  maxCharactersPerDocument: 60_000,
  /** What one analysis may carry across every document in scope, most specific first. */
  maxCharactersPerRun: 24_000,
  acceptedExtensions: ['pdf', 'docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods', 'txt', 'md', 'csv', 'rtf', 'html'],
} as const;

const PLAIN_TEXT = new Set(['txt', 'md', 'csv']);
const SCOPE_ORDER: Record<CreativeAiDocumentScope, number> = { PRODUCT: 0, STORE: 1, TENANT: 2 };
const SCOPE_LABEL: Record<CreativeAiDocumentScope, string> = { PRODUCT: 'this product', STORE: 'this store', TENANT: 'every store' };

/**
 * Reference documents the analysis consults.
 *
 * Brand rules, claim sheets and playbooks are not evidence: they have no
 * outcome, so they never become knowledge entries or move the pattern counts.
 * They are the rubric, made specific to the tenant. Text is extracted once at
 * upload, scoped to the tenant, a store or a product, and injected into both
 * prompts under a fixed budget, most specific scope first.
 *
 * Every query here is scoped by the tenant resolved from the login. A store
 * named on upload must belong to that tenant or the upload is refused.
 */
@Injectable()
export class CreativeAiDocumentService {
  private readonly logger = new Logger(CreativeAiDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreativeAccessService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  async list(actor: CreativeActor) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_USE, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE);
    const [rows, stores] = await Promise.all([
      this.prisma.creativeAiReferenceDocument.findMany({
        where: { tenantId: context.tenantId, active: true },
        orderBy: [{ scope: 'asc' }, { title: 'asc' }, { version: 'desc' }],
        include: {
          storeConfig: { select: { storeNameSnapshot: true } },
          uploadedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.creativeStoreConfig.findMany({
        where: { tenantId: context.tenantId, active: true },
        select: { id: true, storeNameSnapshot: true },
        orderBy: { storeNameSnapshot: 'asc' },
      }),
    ]);
    return {
      documents: rows.map((row) => this.present(row)),
      limits: DOCUMENT_LIMITS,
      stores: stores.map((store) => ({ value: store.id, label: store.storeNameSnapshot })),
      canManage: this.access.has(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE),
    };
  }

  async upload(actor: CreativeActor, dto: UploadCreativeAiDocumentDto, file: UploadedDocumentFile | undefined) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE);
    if (!file?.path || !file.size) throw new BadRequestException('Choose a file to upload.');
    try {
      return await this.ingest(context, dto, file);
    } finally {
      // The staged copy has served its purpose whatever happened above.
      await unlink(file.path).catch(() => undefined);
    }
  }

  private async ingest(context: { tenantId: string; userId: string }, dto: UploadCreativeAiDocumentDto, file: UploadedDocumentFile) {
    if (file.size > DOCUMENT_LIMITS.maxFileMb * 1024 * 1024) {
      throw new BadRequestException(`The file must be ${DOCUMENT_LIMITS.maxFileMb} MB or smaller.`);
    }
    const extension = extname(file.originalname || '').replace('.', '').toLowerCase();
    if (!DOCUMENT_LIMITS.acceptedExtensions.includes(extension as (typeof DOCUMENT_LIMITS.acceptedExtensions)[number])) {
      throw new BadRequestException(`Unsupported file type ".${extension}". Accepted: ${DOCUMENT_LIMITS.acceptedExtensions.join(', ')}.`);
    }

    const scope = dto.scope as CreativeAiDocumentScope;
    let storeConfigId: string | null = null;
    if (scope !== 'TENANT') {
      if (!dto.storeConfigId) throw new BadRequestException('Choose the store this document belongs to.');
      const store = await this.prisma.creativeStoreConfig.findFirst({
        where: { id: dto.storeConfigId, tenantId: context.tenantId },
        select: { id: true },
      });
      if (!store) throw new NotFoundException('Store not found');
      storeConfigId = store.id;
    }
    const productName = scope === 'PRODUCT' ? dto.productName?.trim() || null : null;
    if (scope === 'PRODUCT' && !productName) throw new BadRequestException('Name the product this document applies to.');

    const title = dto.title?.trim() || file.originalname.replace(/\.[^.]+$/, '').trim() || 'Untitled document';
    const [extracted, sha256] = await Promise.all([this.extract(file.path, extension), this.hashFile(file.path)]);

    // A re-upload under the same title becomes the next version and retires
    // the previous one, so runs can cite exactly what they read.
    const previous = await this.prisma.creativeAiReferenceDocument.findFirst({
      where: { tenantId: context.tenantId, title, scope, storeConfigId, productName },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, active: true },
    });

    let objectKey: string | null = null;
    if (this.objectStorage.isConfigured()) {
      objectKey = `tenants/${context.tenantId}/creative-ai-documents/${randomUUID()}.${extension}`;
      try {
        await this.objectStorage.uploadObject({
          key: objectKey,
          body: createReadStream(file.path),
          contentType: file.mimetype || 'application/octet-stream',
          cacheControl: 'private, max-age=0',
          metadata: { tenantId: context.tenantId, assetKind: 'CREATIVE_AI_REFERENCE_DOCUMENT' },
        });
      } catch (error) {
        this.logger.warn(`Original document not stored: ${error instanceof Error ? error.message : String(error)}`);
        objectKey = null;
      }
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (previous?.active) {
        await tx.creativeAiReferenceDocument.update({ where: { id: previous.id }, data: { active: false } });
      }
      const created = await tx.creativeAiReferenceDocument.create({
        data: {
          tenantId: context.tenantId,
          scope,
          storeConfigId,
          productName,
          title,
          fileName: file.originalname,
          contentType: file.mimetype || 'application/octet-stream',
          byteSize: file.size,
          sha256,
          objectKey,
          text: extracted.text,
          characterCount: extracted.text.length,
          tokenEstimate: Math.ceil(extracted.text.length / 4),
          status: extracted.status,
          statusNote: extracted.note,
          version: (previous?.version ?? 0) + 1,
          uploadedById: context.userId,
        },
        include: {
          storeConfig: { select: { storeNameSnapshot: true } },
          uploadedBy: { select: { firstName: true, lastName: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'creative.ai.document.upload',
          resource: 'CreativeAiReferenceDocument',
          resourceId: created.id,
          changes: { title, scope, storeConfigId, productName, version: created.version, characters: created.characterCount, status: created.status } as Prisma.InputJsonValue,
        },
      });
      return created;
    });
    return this.present(row);
  }

  /** Retire a document. The row stays so past runs can still name what they read. */
  async remove(actor: CreativeActor, id: string) {
    const context = await this.access.resolve(actor);
    this.access.require(context, CREATIVE_AGENT_PERMISSIONS.AI_MANAGE);
    const existing = await this.prisma.creativeAiReferenceDocument.findFirst({ where: { id, tenantId: context.tenantId, active: true }, select: { id: true, title: true } });
    if (!existing) throw new NotFoundException('Document not found');
    await this.prisma.$transaction([
      this.prisma.creativeAiReferenceDocument.update({ where: { id: existing.id }, data: { active: false } }),
      this.prisma.auditLog.create({
        data: { tenantId: context.tenantId, userId: context.userId, action: 'creative.ai.document.remove', resource: 'CreativeAiReferenceDocument', resourceId: existing.id, changes: { title: existing.title } },
      }),
    ]);
    return { ok: true };
  }

  /**
   * The documents one analysis reads: the product's, then the store's, then
   * the tenant's, within the run budget. Tenant-scoped by construction; the
   * caller passes the creative's own store and product.
   */
  async forCreative(tenantId: string, storeConfigId: string, productName: string | null): Promise<{ text: string; used: ReferenceDocumentUse[] }> {
    const rows = await this.prisma.creativeAiReferenceDocument.findMany({
      where: {
        tenantId,
        active: true,
        status: CreativeAiDocumentStatus.READY,
        OR: [
          { scope: CreativeAiDocumentScope.TENANT },
          { scope: CreativeAiDocumentScope.STORE, storeConfigId },
          ...(productName ? [{ scope: CreativeAiDocumentScope.PRODUCT, storeConfigId, productName: { equals: productName, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: { id: true, title: true, scope: true, version: true, text: true },
    });
    rows.sort((a, b) => SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] || a.title.localeCompare(b.title));
    if (rows.length === 0) {
      return { text: 'No reference documents were uploaded for this tenant, store or product.', used: [] };
    }

    let remaining = DOCUMENT_LIMITS.maxCharactersPerRun;
    const blocks: string[] = [];
    const used: ReferenceDocumentUse[] = [];
    for (const row of rows) {
      if (remaining <= 400) break;
      const body = row.text.length > remaining ? `${row.text.slice(0, remaining - 60).trimEnd()}\n[… ${row.text.length - remaining + 60} more characters not shown]` : row.text;
      remaining -= body.length;
      blocks.push(`### ${row.title} (applies to ${SCOPE_LABEL[row.scope]}, version ${row.version})\n${body}`);
      used.push({ id: row.id, title: row.title, scope: row.scope, version: row.version, truncated: body.length < row.text.length });
    }
    const skipped = rows.length - used.length;
    if (skipped > 0) blocks.push(`[${skipped} further document(s) did not fit the budget for this analysis.]`);
    return { text: blocks.join('\n\n'), used };
  }

  /**
   * Text out of the file. Plain formats are read as they are; office and PDF
   * formats go through the parser, without OCR, so a scanned PDF or an
   * image-only deck comes back empty and is marked as such rather than
   * pretending to be readable.
   */
  private hashFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
    });
  }

  private async extract(path: string, extension: string): Promise<{ text: string; status: CreativeAiDocumentStatus; note: string | null }> {
    let text = '';
    try {
      if (PLAIN_TEXT.has(extension)) {
        text = await readFile(path, 'utf8');
      } else {
        // Loaded lazily: the parser pulls in PDF and zip machinery nothing else
        // needs. It reads the staged file itself, so a large PDF is never
        // copied through the request first.
        const { parseOffice, OfficeGenerator } = await import('officeparser');
        const ast = await parseOffice(path, { fileType: extension as any, ocr: false } as any);
        // The generator answers { value, messages }; Markdown keeps headings
        // and tables readable, which is what a claim sheet or price list needs.
        const rendered = await (OfficeGenerator as any).generate(ast, 'md');
        text = typeof rendered === 'string' ? rendered : String(rendered?.value ?? '');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Document extraction failed (.${extension}): ${message.slice(0, 200)}`);
      return { text: '', status: CreativeAiDocumentStatus.FAILED, note: `Could not read the file: ${message.slice(0, 160)}` };
    }
    text = text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < 20) {
      return {
        text: '',
        status: CreativeAiDocumentStatus.UNSUPPORTED,
        note: 'No text could be extracted. A scanned PDF or a deck made of pictures needs its text typed or exported first.',
      };
    }
    let note: string | null = null;
    if (text.length > DOCUMENT_LIMITS.maxCharactersPerDocument) {
      note = `Kept the first ${DOCUMENT_LIMITS.maxCharactersPerDocument.toLocaleString()} characters of ${text.length.toLocaleString()}.`;
      text = `${text.slice(0, DOCUMENT_LIMITS.maxCharactersPerDocument).trimEnd()}\n[… truncated at upload]`;
    }
    return { text, status: CreativeAiDocumentStatus.READY, note };
  }

  private present(row: Record<string, any>) {
    return {
      id: row.id,
      title: row.title,
      fileName: row.fileName,
      scope: row.scope,
      storeConfigId: row.storeConfigId ?? null,
      storeName: row.storeConfig?.storeNameSnapshot ?? null,
      productName: row.productName ?? null,
      byteSize: row.byteSize,
      characterCount: row.characterCount,
      tokenEstimate: row.tokenEstimate,
      status: row.status,
      statusNote: row.statusNote ?? null,
      version: row.version,
      uploadedBy: row.uploadedBy ? `${row.uploadedBy.firstName ?? ''} ${row.uploadedBy.lastName ?? ''}`.trim() || null : null,
      createdAt: row.createdAt,
      excerpt: String(row.text ?? '').slice(0, 240),
    };
  }
}
