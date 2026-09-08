import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../integrations/services/encryption.service';

/**
 * The tenant's Anthropic key, admin-managed.
 *
 * Write-only from the client's point of view: the key is encrypted with the
 * tenant's own encryption key (the integration-credentials scheme) and only
 * its last four characters are ever returned. It is NOT stored in
 * Tenant.settings, because that JSON rides along in the login response of
 * every user in the tenant.
 */
@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async get(tenantId: string) {
    const setting = await this.prisma.aiSetting.findUnique({
      where: { tenantId },
      select: { keyLast4: true, updatedAt: true, updatedById: true },
    });
    if (!setting) return { configured: false as const };
    const updatedBy = setting.updatedById
      ? await this.prisma.user.findUnique({
          where: { id: setting.updatedById },
          select: { firstName: true, lastName: true, email: true },
        })
      : null;
    return {
      configured: true as const,
      keyLast4: setting.keyLast4,
      updatedAt: setting.updatedAt,
      updatedBy: updatedBy
        ? [updatedBy.firstName, updatedBy.lastName].filter(Boolean).join(' ') || updatedBy.email
        : null,
    };
  }

  async set(tenantId: string, userId: string, apiKey: string) {
    const trimmed = apiKey.trim();
    // Anthropic keys start with sk-ant-. Reject obvious paste accidents early;
    // a wrong-but-plausible key still fails loudly on the first model call.
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
      throw new BadRequestException('That does not look like an Anthropic API key (they start with "sk-ant-").');
    }
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { encryptionKey: true },
    });
    const encrypted = this.encryption.encrypt({ apiKey: trimmed }, tenant.encryptionKey);
    await this.prisma.$transaction([
      this.prisma.aiSetting.upsert({
        where: { tenantId },
        create: { tenantId, encryptedApiKey: encrypted, keyLast4: trimmed.slice(-4), updatedById: userId },
        update: { encryptedApiKey: encrypted, keyLast4: trimmed.slice(-4), updatedById: userId },
      }),
      this.prisma.auditLog.create({
        data: { tenantId, userId, action: 'ai.key.set', resource: 'AiSetting', resourceId: tenantId, changes: { keyLast4: trimmed.slice(-4) } },
      }),
    ]);
    return this.get(tenantId);
  }

  async clear(tenantId: string, userId: string) {
    await this.prisma.$transaction([
      this.prisma.aiSetting.deleteMany({ where: { tenantId } }),
      this.prisma.auditLog.create({
        data: { tenantId, userId, action: 'ai.key.clear', resource: 'AiSetting', resourceId: tenantId, changes: {} },
      }),
    ]);
    return { configured: false as const };
  }

  /**
   * The key the AI features actually call with: the tenant's stored key first,
   * the server env as fallback so a platform-wide key still works in dev.
   */
  async resolveKey(tenantId: string): Promise<string | null> {
    const setting = await this.prisma.aiSetting.findUnique({
      where: { tenantId },
      select: { encryptedApiKey: true },
    });
    if (setting) {
      try {
        const tenant = await this.prisma.tenant.findUniqueOrThrow({
          where: { id: tenantId },
          select: { encryptionKey: true },
        });
        const decrypted = this.encryption.decrypt(setting.encryptedApiKey, tenant.encryptionKey) as { apiKey?: string };
        if (decrypted?.apiKey) return decrypted.apiKey;
      } catch (error) {
        // A key that no longer decrypts is treated as absent, not as fatal —
        // the admin can simply paste it again.
        this.logger.error(`Failed to decrypt AI key for tenant ${tenantId}: ${(error as Error).message}`);
      }
    }
    return process.env.ANTHROPIC_API_KEY?.trim() || null;
  }
}
