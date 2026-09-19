import { Injectable, Logger } from '@nestjs/common';
import { readFile, rm } from 'fs/promises';
import { basename, join } from 'path';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MediaAssetsService } from '../../../common/services/media-assets.service';
import type { MediaManifest } from './creative-ai-media.service';

export type CreativeAiRunFrameView = {
  sceneIndex: number;
  timestampSeconds: number | null;
  endSeconds: number | null;
  url: string | null;
  width: number | null;
  height: number | null;
};

/**
 * The scene thumbnails an analysis leaves behind.
 *
 * The run workspace is swept after its retention window, so anything the
 * storyboard or the knowledge base wants to show later has to leave it.
 * Thumbnails go to object storage as media assets, one row per scene, and are
 * served back as signed URLs.
 */
@Injectable()
export class CreativeAiFrameService {
  private readonly logger = new Logger(CreativeAiFrameService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaAssets: MediaAssetsService,
  ) {}

  /**
   * Store the thumbnails a preprocessing pass produced. Safe to call again on
   * a retried run: scenes already stored are skipped, and thumbnails that were
   * removed after a previous success are simply not there to upload.
   */
  async persist(tenantId: string, runId: string, workspace: string, manifest: MediaManifest): Promise<string[]> {
    const warnings: string[] = [];
    if (!manifest.thumbnails?.length) return warnings;

    const existing = await this.prisma.creativeAiRunFrame.findMany({
      where: { tenantId, runId },
      select: { sceneIndex: true },
    });
    const stored = new Set(existing.map((row) => row.sceneIndex));
    let failed = false;
    let uploaded = 0;

    for (const thumbnail of manifest.thumbnails) {
      if (stored.has(thumbnail.sceneIndex)) continue;
      let buffer: Buffer;
      try {
        buffer = await readFile(join(workspace, thumbnail.file));
      } catch {
        continue;
      }
      try {
        const asset = await this.mediaAssets.uploadCreativeAiFrameImage(
          { buffer, mimetype: 'image/jpeg', size: buffer.length, originalname: basename(thumbnail.file) },
          tenantId,
        );
        await this.prisma.creativeAiRunFrame.create({
          data: {
            tenantId,
            runId,
            sceneIndex: thumbnail.sceneIndex,
            timestampSeconds: thumbnail.timestampSeconds,
            endSeconds: thumbnail.endSeconds,
            assetId: asset.assetId,
          },
        });
        uploaded += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(/not configured/i.test(message) ? 'FRAME_STORAGE_NOT_CONFIGURED' : 'FRAME_STORAGE_FAILED');
        this.logger.warn(`Scene thumbnail storage failed tenant=${tenantId} run=${runId}: ${message.slice(0, 300)}`);
        failed = true;
        break;
      }
    }

    // Thumbnails are only kept on disk until they are stored; a failure leaves
    // them for the retention sweeper rather than losing them at once.
    if (!failed && (uploaded > 0 || stored.size > 0)) {
      await rm(join(workspace, 'thumbs'), { recursive: true, force: true });
    }
    return [...new Set(warnings)];
  }

  /** The stored scenes of one run, as signed URLs, in scene order. */
  async listForRun(tenantId: string, runId: string): Promise<CreativeAiRunFrameView[]> {
    const rows = await this.prisma.creativeAiRunFrame.findMany({
      where: { tenantId, runId },
      orderBy: { sceneIndex: 'asc' },
      include: { asset: { select: { objectKey: true, width: true, height: true } } },
    });
    return Promise.all(rows.map(async (row) => ({
      sceneIndex: row.sceneIndex,
      timestampSeconds: row.timestampSeconds === null ? null : Number(row.timestampSeconds),
      endSeconds: row.endSeconds === null ? null : Number(row.endSeconds),
      url: await this.mediaAssets.createSignedAssetUrl(row.asset),
      width: row.asset.width ?? null,
      height: row.asset.height ?? null,
    })));
  }
}
