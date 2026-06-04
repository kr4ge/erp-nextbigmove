import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Readable } from 'stream';

type UploadObjectInput = {
  key: string;
  body: Buffer | Readable;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
};

type SignedReadUrlOptions = {
  ttlSeconds?: number;
  downloadFileName?: string;
  responseContentType?: string;
};

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  private client: S3Client | null = null;

  private readonly provider = (process.env.OBJECT_STORAGE_PROVIDER || 's3-compatible').trim();
  private readonly endpoint = this.clean(process.env.OBJECT_STORAGE_ENDPOINT);
  private readonly region = this.clean(process.env.OBJECT_STORAGE_REGION) || 'us-east-1';
  private readonly bucket = this.clean(process.env.OBJECT_STORAGE_BUCKET);
  private readonly accessKeyId = this.clean(process.env.OBJECT_STORAGE_ACCESS_KEY_ID);
  private readonly secretAccessKey = this.clean(process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY);
  private readonly forcePathStyle = process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true';
  private readonly autoCreateBucket = process.env.OBJECT_STORAGE_AUTO_CREATE_BUCKET === 'true';
  private readonly signedUrlTtlSeconds = this.parsePositiveInt(
    process.env.OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS,
    900,
  );

  async onModuleInit() {
    if (!this.isConfigured() || !this.autoCreateBucket) {
      return;
    }

    const client = this.getClient();

    try {
      await client.send(new HeadBucketCommand({ Bucket: this.bucket! }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: this.bucket! }));
      this.logger.log(`Created object storage bucket ${this.bucket}`);
    }
  }

  isConfigured() {
    return Boolean(
      this.endpoint
      && this.bucket
      && this.accessKeyId
      && this.secretAccessKey,
    );
  }

  getBucketName() {
    if (!this.bucket) {
      throw new Error('Object storage bucket is not configured');
    }

    return this.bucket;
  }

  getProviderName() {
    return this.provider;
  }

  async uploadObject(input: UploadObjectInput) {
    const client = this.getClient();

    await client.send(new PutObjectCommand({
      Bucket: this.getBucketName(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl,
      Metadata: input.metadata,
    }));

    return {
      bucket: this.getBucketName(),
      key: input.key,
    };
  }

  async createSignedReadUrl(key: string, options?: SignedReadUrlOptions) {
    const client = this.getClient();
    const ttlSeconds = options?.ttlSeconds ?? this.signedUrlTtlSeconds;

    return getSignedUrl(client, new GetObjectCommand({
      Bucket: this.getBucketName(),
      Key: key,
      ResponseContentDisposition: options?.downloadFileName
        ? `attachment; filename="${this.escapeContentDispositionFileName(options.downloadFileName)}"`
        : undefined,
      ResponseContentType: options?.responseContentType,
    }), {
      expiresIn: ttlSeconds,
    });
  }

  private getClient() {
    if (!this.isConfigured()) {
      throw new Error('Object storage is not configured');
    }

    if (!this.client) {
      this.client = new S3Client({
        region: this.region,
        endpoint: this.endpoint!,
        forcePathStyle: this.forcePathStyle,
        credentials: {
          accessKeyId: this.accessKeyId!,
          secretAccessKey: this.secretAccessKey!,
        },
      });
    }

    return this.client;
  }

  private clean(value?: string | null) {
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

  private escapeContentDispositionFileName(fileName: string) {
    return fileName.replace(/["\\]/g, '_');
  }
}
