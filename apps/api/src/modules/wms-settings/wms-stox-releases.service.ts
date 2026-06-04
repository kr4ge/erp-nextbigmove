import { createHash, randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WmsStoxAppPlatform,
  WmsStoxReleaseChannel,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ObjectStorageService } from '../../common/services/object-storage.service';
import { CreateWmsStoxReleaseDto } from './dto/wms-stox-release.dto';

type WmsSettingsActor = {
  id?: string;
  userId?: string;
  role?: string;
  tenantId?: string | null;
};

export type UploadedBinaryFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

type ReleaseRecord = Prisma.WmsStoxAppReleaseGetPayload<{
  include: {
    createdBy: {
      select: {
        id: true;
        email: true;
        firstName: true;
        lastName: true;
      };
    };
    activatedBy: {
      select: {
        id: true;
        email: true;
        firstName: true;
        lastName: true;
      };
    };
  };
}>;

const STOX_PLATFORM = WmsStoxAppPlatform.ANDROID;
const STOX_CHANNEL = WmsStoxReleaseChannel.INTERNAL;

@Injectable()
export class WmsStoxReleasesService {
  private readonly stoxApkMaxFileMb = this.parsePositiveInt(
    process.env.OBJECT_STORAGE_STOX_APK_MAX_FILE_MB,
    150,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async listReleases(actor: WmsSettingsActor) {
    const releases = await this.prisma.wmsStoxAppRelease.findMany({
      where: {
        platform: STOX_PLATFORM,
        channel: STOX_CHANNEL,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        activatedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { buildNumber: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const releaseViews = await Promise.all(releases.map((release) => this.toReleaseView(release)));
    const latestRelease = releaseViews.find((release) => release.isActive) ?? releaseViews[0] ?? null;

    return {
      scope: {
        isPlatformAdmin: actor.role === 'SUPER_ADMIN',
        tenantId: actor.tenantId ?? null,
      },
      latestRelease,
      releases: releaseViews,
    };
  }

  async getLatestActiveRelease(actor: WmsSettingsActor) {
    const release = await this.prisma.wmsStoxAppRelease.findFirst({
      where: {
        platform: STOX_PLATFORM,
        channel: STOX_CHANNEL,
        isActive: true,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        activatedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { buildNumber: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return {
      scope: {
        isPlatformAdmin: actor.role === 'SUPER_ADMIN',
        tenantId: actor.tenantId ?? null,
      },
      release: release ? await this.toReleaseView(release) : null,
    };
  }

  async createRelease(
    actor: WmsSettingsActor,
    dto: CreateWmsStoxReleaseDto,
    file: UploadedBinaryFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('STOX Android APK file is required');
    }

    if (!this.objectStorageService.isConfigured()) {
      throw new BadRequestException('Object storage is not configured');
    }

    this.assertValidApkFile(file);

    const actorId = actor.id ?? actor.userId ?? null;
    const normalizedVersion = dto.version.trim();
    const normalizedReleaseNotes = dto.releaseNotes?.trim() || null;
    const fileName = this.buildDownloadFileName(normalizedVersion, dto.buildNumber);
    const now = new Date();
    const year = `${now.getUTCFullYear()}`;
    const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
    const objectKey = `wms/stox/android/${year}/${month}/${normalizedVersion}/${dto.buildNumber}/${randomUUID()}.apk`;
    const checksumSha256 = createHash('sha256').update(file.buffer).digest('hex');

    await this.objectStorageService.uploadObject({
      key: objectKey,
      body: file.buffer,
      contentType: 'application/vnd.android.package-archive',
      cacheControl: 'private, max-age=31536000, immutable',
      metadata: {
        app: 'stox',
        platform: STOX_PLATFORM,
        channel: STOX_CHANNEL,
        version: normalizedVersion,
        buildNumber: `${dto.buildNumber}`,
      },
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (dto.isActive ?? true) {
          await tx.wmsStoxAppRelease.updateMany({
            where: {
              platform: STOX_PLATFORM,
              channel: STOX_CHANNEL,
              isActive: true,
            },
            data: {
              isActive: false,
            },
          });
        }

        return tx.wmsStoxAppRelease.create({
          data: {
            platform: STOX_PLATFORM,
            channel: STOX_CHANNEL,
            version: normalizedVersion,
            buildNumber: dto.buildNumber,
            releaseNotes: normalizedReleaseNotes,
            isActive: dto.isActive ?? true,
            storageProvider: this.objectStorageService.getProviderName(),
            bucket: this.objectStorageService.getBucketName(),
            objectKey,
            contentType: 'application/vnd.android.package-archive',
            byteSize: file.size,
            checksumSha256,
            originalFileName: file.originalname?.trim() || fileName,
            createdById: actorId,
            activatedById: (dto.isActive ?? true) ? actorId : null,
            activatedAt: (dto.isActive ?? true) ? now : null,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            activatedBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });
      });

      return {
        release: await this.toReleaseView(created),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        throw new ConflictException('A STOX Android release with this version and build number already exists');
      }

      throw error;
    }
  }

  async activateRelease(actor: WmsSettingsActor, releaseId: string) {
    const actorId = actor.id ?? actor.userId ?? null;

    const release = await this.prisma.wmsStoxAppRelease.findUnique({
      where: { id: releaseId },
    });

    if (!release || release.platform !== STOX_PLATFORM || release.channel !== STOX_CHANNEL) {
      throw new NotFoundException('STOX release was not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.wmsStoxAppRelease.updateMany({
        where: {
          platform: STOX_PLATFORM,
          channel: STOX_CHANNEL,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      return tx.wmsStoxAppRelease.update({
        where: { id: releaseId },
        data: {
          isActive: true,
          activatedById: actorId,
          activatedAt: new Date(),
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          activatedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });

    return {
      release: await this.toReleaseView(updated),
    };
  }

  private async toReleaseView(release: ReleaseRecord) {
    const downloadFileName = this.buildDownloadFileName(release.version, release.buildNumber);
    const downloadUrl = this.objectStorageService.isConfigured()
      ? await this.objectStorageService.createSignedReadUrl(release.objectKey, {
          downloadFileName,
          responseContentType: release.contentType,
        })
      : null;

    return {
      id: release.id,
      platform: release.platform,
      channel: release.channel,
      version: release.version,
      buildNumber: release.buildNumber,
      releaseNotes: release.releaseNotes ?? null,
      isActive: release.isActive,
      contentType: release.contentType,
      byteSize: release.byteSize,
      originalFileName: release.originalFileName ?? null,
      downloadFileName,
      downloadUrl,
      createdAt: release.createdAt.toISOString(),
      updatedAt: release.updatedAt.toISOString(),
      activatedAt: release.activatedAt?.toISOString() ?? null,
      createdBy: release.createdBy
        ? {
            id: release.createdBy.id,
            email: release.createdBy.email,
            displayName: this.getDisplayName(release.createdBy),
          }
        : null,
      activatedBy: release.activatedBy
        ? {
            id: release.activatedBy.id,
            email: release.activatedBy.email,
            displayName: this.getDisplayName(release.activatedBy),
          }
        : null,
    };
  }

  private assertValidApkFile(file: UploadedBinaryFile) {
    const maxBytes = this.stoxApkMaxFileMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(`STOX Android APK must be ${this.stoxApkMaxFileMb}MB or smaller`);
    }

    const normalizedName = file.originalname?.trim().toLowerCase() ?? '';
    if (!normalizedName.endsWith('.apk')) {
      throw new BadRequestException('Only Android APK files are supported');
    }

    const normalizedMimeType = file.mimetype?.trim().toLowerCase() ?? '';
    const allowedMimeTypes = new Set([
      'application/vnd.android.package-archive',
      'application/octet-stream',
      'application/zip',
      'application/x-zip-compressed',
    ]);

    if (normalizedMimeType && !allowedMimeTypes.has(normalizedMimeType)) {
      throw new BadRequestException('Only Android APK files are supported');
    }
  }

  private buildDownloadFileName(version: string, buildNumber: number) {
    return `stox-${version}-${buildNumber}.apk`;
  }

  private getDisplayName(user: { firstName: string | null; lastName: string | null; email: string }) {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.email;
  }

  private parsePositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
