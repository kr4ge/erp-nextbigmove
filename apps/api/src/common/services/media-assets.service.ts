import { createHash, randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MediaAssetKind } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import sharp = require('sharp');
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from './object-storage.service';

type UploadedAssetView = {
  assetId: string;
  imageUrl: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  originalFileName: string | null;
};

export type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

@Injectable()
export class MediaAssetsService {
  private readonly logger = new Logger(MediaAssetsService.name);
  private readonly paymentProofMaxFileMb = this.parsePositiveInt(
    process.env.OBJECT_STORAGE_PAYMENT_PROOF_MAX_FILE_MB,
    8,
  );
  private readonly invoiceLogoMaxFileMb = this.parsePositiveInt(
    process.env.OBJECT_STORAGE_INVOICE_LOGO_MAX_FILE_MB,
    4,
  );
  private readonly undeliverableProofMaxFileMb = this.parsePositiveInt(
    process.env.OBJECT_STORAGE_UNDELIVERABLE_PROOF_MAX_FILE_MB,
    30,
  );
  private readonly packingProofMaxFileMb = this.parsePositiveInt(
    process.env.OBJECT_STORAGE_PACKING_PROOF_MAX_FILE_MB,
    30,
  );
  private readonly creativeThumbnailMaxFileMb = this.parsePositiveInt(
    process.env.OBJECT_STORAGE_CREATIVE_THUMBNAIL_MAX_FILE_MB,
    8,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async uploadPaymentProofImage(
    file: UploadedImageFile | undefined,
    tenantId: string,
  ): Promise<UploadedAssetView> {
    return this.uploadImageAsset({
      file,
      tenantId,
      kind: MediaAssetKind.PAYMENT_PROOF_IMAGE,
      maxFileMb: this.paymentProofMaxFileMb,
      objectPrefix: 'payment-proofs',
      requiredMessage: 'Payment proof image file is required',
      tooLargeLabel: 'Payment proof image',
    });
  }

  async uploadInvoiceLogoImage(
    file: UploadedImageFile | undefined,
    tenantId?: string | null,
  ): Promise<UploadedAssetView> {
    return this.uploadImageAsset({
      file,
      tenantId,
      kind: MediaAssetKind.INVOICE_LOGO_IMAGE,
      maxFileMb: this.invoiceLogoMaxFileMb,
      objectPrefix: 'invoice-logos',
      requiredMessage: 'Invoice logo image file is required',
      tooLargeLabel: 'Invoice logo image',
    });
  }

  async uploadUndeliverableRemarkProofImage(
    file: UploadedImageFile | undefined,
    tenantId: string,
  ): Promise<UploadedAssetView> {
    return this.uploadImageAsset({
      file,
      tenantId,
      kind: MediaAssetKind.UNDELIVERABLE_REMARK_PROOF_IMAGE,
      maxFileMb: this.undeliverableProofMaxFileMb,
      objectPrefix: 'undeliverable-proofs',
      requiredMessage: 'Proof image is required before saving the SA remark',
      tooLargeLabel: 'Proof image',
      resizeWidth: 1920,
      resizeHeight: 2560,
    });
  }

  async uploadPackingProofImage(
    file: UploadedImageFile | undefined,
    tenantId: string,
  ): Promise<UploadedAssetView> {
    return this.uploadImageAsset({
      file,
      tenantId,
      kind: MediaAssetKind.WMS_PACKING_PROOF_IMAGE,
      maxFileMb: this.packingProofMaxFileMb,
      objectPrefix: 'packing-proofs',
      requiredMessage: 'Packing proof image is required',
      tooLargeLabel: 'Packing proof image',
      resizeWidth: 1920,
      resizeHeight: 1920,
    });
  }

  /**
   * Caches a creative's cover image (resolved from a Facebook post's og:image).
   * Reuses the shared pipeline, so the bytes are re-encoded to WebP and stored
   * in the same bucket as every other media asset.
   */
  async uploadCreativeThumbnailImage(
    file: UploadedImageFile | undefined,
    tenantId: string,
  ): Promise<UploadedAssetView> {
    return this.uploadImageAsset({
      file,
      tenantId,
      kind: MediaAssetKind.CREATIVE_THUMBNAIL_IMAGE,
      maxFileMb: this.creativeThumbnailMaxFileMb,
      objectPrefix: 'creative-thumbnails',
      requiredMessage: 'Creative thumbnail image is required',
      tooLargeLabel: 'Creative thumbnail image',
      resizeWidth: 960,
      resizeHeight: 960,
    });
  }

  async assertTenantOwnedPaymentProofAsset(assetId: string, tenantId: string) {
    return this.assertTenantOwnedImageAsset(
      assetId,
      tenantId,
      MediaAssetKind.PAYMENT_PROOF_IMAGE,
      'Uploaded proof image was not found',
      'Uploaded proof image does not belong to the active tenant',
      'Uploaded asset is not a payment proof image',
    );
  }

  async assertGlobalInvoiceLogoAsset(assetId: string) {
    return this.assertImageAsset(
      assetId,
      MediaAssetKind.INVOICE_LOGO_IMAGE,
      'Uploaded invoice logo was not found',
      'Uploaded asset is not an invoice logo image',
      {
        requireTenantId: null,
      },
    );
  }

  async deleteUnattachedImageAsset(
    assetId: string,
    tenantId: string,
    kind: MediaAssetKind,
  ) {
    const asset = await this.assertTenantOwnedImageAsset(
      assetId,
      tenantId,
      kind,
      'Uploaded image was not found',
      'Uploaded image does not belong to the active tenant',
      'Uploaded image has an unexpected asset type',
    );

    await this.prisma.mediaAsset.delete({
      where: { id: asset.id },
    });

    try {
      await this.objectStorageService.deleteObject(asset.objectKey);
    } catch (error) {
      this.logger.error(
        `Failed to remove unreferenced object ${asset.objectKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async createSignedAssetUrl(asset: { objectKey: string } | null | undefined) {
    if (!asset) {
      return null;
    }

    if (!this.objectStorageService.isConfigured()) {
      this.logger.warn(`Object storage is not configured; cannot sign asset URL for ${asset.objectKey}`);
      return null;
    }

    return this.objectStorageService.createSignedReadUrl(asset.objectKey);
  }

  async createAssetDataUrl(
    asset: { objectKey: string; contentType?: string | null } | null | undefined,
  ) {
    if (!asset) {
      return null;
    }

    if (!this.objectStorageService.isConfigured()) {
      this.logger.warn(`Object storage is not configured; cannot inline asset for ${asset.objectKey}`);
      return null;
    }

    const contentType = asset.contentType?.trim() || 'application/octet-stream';
    const bytes = await this.objectStorageService.downloadObjectBuffer(asset.objectKey);
    return `data:${contentType};base64,${bytes.toString('base64')}`;
  }

  private async uploadImageAsset(params: {
    file: UploadedImageFile | undefined;
    tenantId?: string | null;
    kind: MediaAssetKind;
    maxFileMb: number;
    objectPrefix: string;
    requiredMessage: string;
    tooLargeLabel: string;
    resizeWidth?: number;
    resizeHeight?: number;
  }): Promise<UploadedAssetView> {
    const {
      file,
      tenantId = null,
      kind,
      maxFileMb,
      objectPrefix,
      requiredMessage,
      tooLargeLabel,
      resizeWidth = 1800,
      resizeHeight = 1800,
    } = params;

    if (!file) {
      throw new BadRequestException(requiredMessage);
    }

    if (!this.objectStorageService.isConfigured()) {
      throw new BadRequestException('Object storage is not configured');
    }

    const normalizedMimeType = this.normalizeImageMimeType(file.mimetype);
    if (!normalizedMimeType) {
      throw new BadRequestException('Only PNG, JPEG, or WebP images are supported');
    }

    const maxBytes = maxFileMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(`${tooLargeLabel} must be ${maxFileMb}MB or smaller`);
    }

    let optimized: {
      data: Buffer;
      info: sharp.OutputInfo;
    };
    try {
      optimized = await sharp(file.buffer, {
        failOn: 'error',
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize({
          width: resizeWidth,
          height: resizeHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: 82,
          effort: 5,
        })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new BadRequestException(
        'The image could not be processed. Upload a valid PNG, JPEG, or WebP image.',
      );
    }

    const now = new Date();
    const year = `${now.getUTCFullYear()}`;
    const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
    const tenantScope = tenantId ? `tenants/${tenantId}` : 'platform/wms';
    const objectKey = `${tenantScope}/${objectPrefix}/${year}/${month}/${randomUUID()}.webp`;
    const checksumSha256 = createHash('sha256').update(optimized.data).digest('hex');
    const actorId = (this.cls.get('userId') as string | undefined) ?? null;

    await this.objectStorageService.uploadObject({
      key: objectKey,
      body: optimized.data,
      contentType: 'image/webp',
      cacheControl: 'private, max-age=31536000, immutable',
      metadata: {
        tenantId: tenantId ?? 'global-wms',
        assetKind: kind,
      },
    });

    let asset;
    try {
      asset = await this.prisma.mediaAsset.create({
        data: {
          tenantId,
          kind,
          storageProvider: this.objectStorageService.getProviderName(),
          bucket: this.objectStorageService.getBucketName(),
          objectKey,
          contentType: 'image/webp',
          byteSize: optimized.info.size,
          width: optimized.info.width ?? null,
          height: optimized.info.height ?? null,
          checksumSha256,
          originalFileName: this.cleanOptionalText(file.originalname),
          createdById: actorId,
        },
      });
    } catch (error) {
      try {
        await this.objectStorageService.deleteObject(objectKey);
      } catch (cleanupError) {
        this.logger.error(
          `Failed to clean up object ${objectKey}: ${
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          }`,
        );
      }
      throw error;
    }

    return {
      assetId: asset.id,
      imageUrl: await this.objectStorageService.createSignedReadUrl(asset.objectKey),
      contentType: asset.contentType,
      byteSize: asset.byteSize,
      width: asset.width ?? null,
      height: asset.height ?? null,
      originalFileName: asset.originalFileName ?? null,
    };
  }

  private async assertTenantOwnedImageAsset(
    assetId: string,
    tenantId: string,
    kind: MediaAssetKind,
    notFoundMessage: string,
    wrongTenantMessage: string,
    wrongKindMessage: string,
  ) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException(notFoundMessage);
    }

    if (asset.tenantId !== tenantId) {
      throw new ForbiddenException(wrongTenantMessage);
    }

    if (asset.kind !== kind) {
      throw new BadRequestException(wrongKindMessage);
    }

    return asset;
  }

  private async assertImageAsset(
    assetId: string,
    kind: MediaAssetKind,
    notFoundMessage: string,
    wrongKindMessage: string,
    options?: {
      requireTenantId?: string | null;
    },
  ) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException(notFoundMessage);
    }

    if (asset.kind !== kind) {
      throw new BadRequestException(wrongKindMessage);
    }

    if (options && 'requireTenantId' in options && asset.tenantId !== options.requireTenantId) {
      throw new ForbiddenException('Uploaded invoice logo does not match the expected WMS scope');
    }

    return asset;
  }

  private normalizeImageMimeType(mimeType?: string | null) {
    const value = mimeType?.trim().toLowerCase();
    if (!value) {
      return null;
    }

    if (value === 'image/jpg') {
      return 'image/jpeg';
    }

    return ['image/jpeg', 'image/png', 'image/webp'].includes(value) ? value : null;
  }

  private cleanOptionalText(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private parsePositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
