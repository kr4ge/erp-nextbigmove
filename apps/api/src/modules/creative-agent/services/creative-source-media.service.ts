import { Injectable, Logger } from '@nestjs/common';
import { MediaAssetKind } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, stat } from 'fs/promises';
import { extname, join } from 'path';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ObjectStorageService } from '../../../common/services/object-storage.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GRACE_DAYS = 30;

export type SourceCaptureOutcome = 'CAPTURED' | 'ALREADY_HELD' | 'RELEASED' | 'SKIPPED';
export type SourceReleaseReason = 'HANDED_TO_META' | 'EXPIRED' | 'REPLACED';

/**
 * The creative's source file, held between analysis and the Meta draft.
 *
 * Before this the analyzer removed the file the moment frames were extracted,
 * which left nothing to upload when the draft worker later needed it. Now the
 * bytes are copied into object storage at the first analysis, referenced from
 * the creative, and released the moment Meta confirms it has its own copy. A
 * file nobody sends is swept after a grace period so storage does not fill
 * with creatives that were rejected or forgotten.
 *
 * Frames, contact sheets, the transcript and the analysis all outlive the
 * source. Only the bytes go.
 */
@Injectable()
export class CreativeSourceMediaService {
  private readonly logger = new Logger(CreativeSourceMediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  /** How long an undrafted file is held before the sweep removes it. */
  graceDays(): number {
    const value = Number(process.env.CREATIVE_MEDIA_GRACE_DAYS || DEFAULT_GRACE_DAYS);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_GRACE_DAYS;
  }

  /** A file uploaded at enrollment (or attached later). The hash is computed here. */
  async captureFile(input: {
    tenantId: string;
    creativeId: string;
    sourcePath: string;
    contentType: string | null;
    fileName: string | null;
  }): Promise<SourceCaptureOutcome> {
    return this.captureFromRun({ ...input, sha256: await this.sha256(input.sourcePath), force: true });
  }

  /**
   * Copy a run's source file into object storage and point the creative at it.
   *
   * Idempotent on the file's SHA-256: a re-analysis of the same file changes
   * nothing, a different file replaces the held one. A creative whose media
   * has already been handed to Meta is left alone, because Meta holds the
   * copy that matters from then on.
   */
  async captureFromRun(input: {
    tenantId: string;
    creativeId: string;
    sourcePath: string;
    contentType: string | null;
    fileName: string | null;
    sha256: string | null;
    /** Hold even if this creative's media was already handed to Meta (a relaunch). */
    force?: boolean;
  }): Promise<SourceCaptureOutcome> {
    if (!this.objectStorage.isConfigured()) {
      this.logger.warn(`Object storage is not configured; source for creative ${input.creativeId} stays in its workspace`);
      return 'SKIPPED';
    }

    const creative = await this.prisma.creative.findFirst({
      where: { id: input.creativeId, tenantId: input.tenantId },
      select: {
        id: true,
        code: true,
        mediaReleasedAt: true,
        sourceAssetId: true,
        sourceAsset: { select: { id: true, objectKey: true, checksumSha256: true } },
      },
    });
    if (!creative) throw new Error('Creative was not found in its tenant');

    if (creative.sourceAsset && input.sha256 && creative.sourceAsset.checksumSha256 === input.sha256) {
      return 'ALREADY_HELD';
    }
    if (!input.force && !creative.sourceAsset && creative.mediaReleasedAt) {
      return 'RELEASED';
    }

    const info = await stat(input.sourcePath);
    const extension = extname(input.fileName || input.sourcePath).toLowerCase() || '';
    const objectKey = `creative-sources/${input.tenantId}/${creative.id}/${randomUUID()}${extension}`;
    const contentType = input.contentType || 'application/octet-stream';

    const uploaded = await this.objectStorage.uploadObject({
      key: objectKey,
      body: createReadStream(input.sourcePath),
      contentLength: info.size,
      contentType,
      metadata: { creativeCode: creative.code },
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.graceDays() * DAY_MS);
    const previous = creative.sourceAsset;

    await this.prisma.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          tenantId: input.tenantId,
          kind: MediaAssetKind.CREATIVE_SOURCE_MEDIA,
          storageProvider: this.objectStorage.getProviderName(),
          bucket: uploaded.bucket,
          objectKey: uploaded.key,
          contentType,
          byteSize: info.size,
          checksumSha256: input.sha256,
          originalFileName: input.fileName,
        },
      });
      await tx.creative.update({
        where: { id: creative.id },
        data: {
          sourceAssetId: asset.id,
          mediaCapturedAt: now,
          mediaExpiresAt: expiresAt,
          mediaReleasedAt: null,
        },
      });
    });

    if (previous) {
      await this.removeAsset(previous.id, previous.objectKey).catch((error) => {
        this.logger.warn(`Held a replaced source for creative ${creative.code} could not be removed: ${this.message(error)}`);
      });
    }

    this.logger.log(`Source held for creative ${creative.code} (${Math.round(info.size / 1024)} KB, until ${expiresAt.toISOString().slice(0, 10)})`);
    return 'CAPTURED';
  }

  /**
   * Delete the held bytes. Called by the draft worker once Meta confirms the
   * upload, and by the nightly sweep for files past their grace period.
   * Returns true when a file was actually removed.
   */
  async release(tenantId: string, creativeId: string, reason: SourceReleaseReason): Promise<boolean> {
    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId },
      select: { id: true, code: true, sourceAssetId: true, sourceAsset: { select: { id: true, objectKey: true } } },
    });
    if (!creative) return false;

    const now = new Date();
    if (!creative.sourceAsset) {
      if (reason === 'HANDED_TO_META') {
        await this.prisma.creative.update({ where: { id: creative.id }, data: { mediaReleasedAt: now } });
      }
      return false;
    }

    await this.removeAsset(creative.sourceAsset.id, creative.sourceAsset.objectKey);
    await this.prisma.creative.update({
      where: { id: creative.id },
      data: {
        sourceAssetId: null,
        // An expired file was never sent, so it is not "released" to anyone;
        // the stamp stays null and the row says only that nothing is held.
        mediaReleasedAt: reason === 'HANDED_TO_META' ? now : undefined,
        mediaExpiresAt: null,
      },
    });
    this.logger.log(`Source released for creative ${creative.code} (${reason.toLowerCase().replace(/_/g, ' ')})`);
    return true;
  }

  /** A short-lived URL Meta can fetch the held file from, or null when nothing is held. */
  async signedSourceUrl(tenantId: string, creativeId: string, ttlSeconds = 3600) {
    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId },
      select: {
        sourceAsset: { select: { objectKey: true, contentType: true, byteSize: true, originalFileName: true } },
      },
    });
    const asset = creative?.sourceAsset;
    if (!asset || !this.objectStorage.isConfigured()) return null;
    return {
      url: await this.objectStorage.createSignedReadUrl(asset.objectKey, { ttlSeconds }),
      objectKey: asset.objectKey,
      contentType: asset.contentType,
      byteSize: asset.byteSize,
      fileName: asset.originalFileName,
    };
  }

  /**
   * Copy the held file into a local directory so an analysis can read it the
   * way it reads an upload. Returns null when nothing is held.
   */
  async stageHeldSource(tenantId: string, creativeId: string, directory: string) {
    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId },
      select: { sourceAsset: { select: { objectKey: true, contentType: true, byteSize: true, originalFileName: true } } },
    });
    const asset = creative?.sourceAsset;
    if (!asset || !this.objectStorage.isConfigured()) return null;
    await mkdir(directory, { recursive: true });
    const originalname = asset.originalFileName || `source${extname(asset.objectKey) || ''}`;
    const path = join(directory, `${randomUUID()}${extname(originalname).toLowerCase()}`);
    await this.objectStorage.downloadObjectToFile(asset.objectKey, path);
    const info = await stat(path);
    return { path, originalname, mimetype: asset.contentType, size: info.size };
  }

  /** The held bytes in memory, for the small files Meta takes inline (images). */
  async downloadSource(tenantId: string, creativeId: string) {
    const creative = await this.prisma.creative.findFirst({
      where: { id: creativeId, tenantId },
      select: { sourceAsset: { select: { objectKey: true, contentType: true, originalFileName: true } } },
    });
    const asset = creative?.sourceAsset;
    if (!asset) return null;
    const buffer = await this.objectStorage.downloadObjectBuffer(asset.objectKey);
    return { buffer, contentType: asset.contentType, fileName: asset.originalFileName };
  }

  /**
   * Remove files whose grace period has passed and that no draft is about to
   * send. Runs nightly from the worker. Bounded per pass so a backlog never
   * turns into one long transaction.
   */
  async sweepExpired(limit = 200): Promise<{ examined: number; released: number }> {
    const now = new Date();
    const rows = await this.prisma.creative.findMany({
      where: {
        sourceAssetId: { not: null },
        mediaExpiresAt: { lt: now },
        metaDrafts: { none: { status: { in: ['QUEUED', 'RUNNING'] } } },
      },
      select: { id: true, tenantId: true, code: true },
      orderBy: { mediaExpiresAt: 'asc' },
      take: limit,
    });
    let released = 0;
    for (const row of rows) {
      try {
        if (await this.release(row.tenantId, row.id, 'EXPIRED')) released += 1;
      } catch (error) {
        this.logger.warn(`Could not sweep source for creative ${row.code}: ${this.message(error)}`);
      }
    }
    return { examined: rows.length, released };
  }

  private async removeAsset(assetId: string, objectKey: string) {
    try {
      await this.objectStorage.deleteObject(objectKey);
    } catch (error) {
      // A key that is already gone is the outcome we wanted.
      const message = this.message(error);
      if (!/NoSuchKey|NotFound|404/i.test(message)) throw error;
    }
    await this.prisma.mediaAsset.deleteMany({ where: { id: assetId } });
  }

  private sha256(path: string) {
    return new Promise<string>((resolveHash, reject) => {
      const hash = createHash('sha256');
      const input = createReadStream(path);
      input.on('error', reject);
      input.on('data', (chunk) => hash.update(chunk));
      input.on('end', () => resolveHash(hash.digest('hex')));
    });
  }

  private message(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
