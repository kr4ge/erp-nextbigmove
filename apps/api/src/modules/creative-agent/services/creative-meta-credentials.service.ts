import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EncryptionService } from '../../integrations/services/encryption.service';

export type MetaAdAccountOption = {
  accountId: string;
  name: string;
  currency: string | null;
  timezone: string | null;
  integrationId: string;
};

/**
 * The tenant's own Meta access, read from the integration it connected.
 *
 * Every Graph write the draft worker makes is signed with this token, so a
 * tenant can only ever create campaigns in an ad account it connected itself.
 * Nothing here goes through Claudex or a claude.ai connector: those would
 * authenticate as one person for every tenant, which is the wrong boundary.
 */
@Injectable()
export class CreativeMetaCredentialsService {
  private readonly logger = new Logger(CreativeMetaCredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /** Ad accounts the tenant has connected, for the publishing profile picker. */
  async listAdAccounts(tenantId: string): Promise<MetaAdAccountOption[]> {
    const rows = await this.prisma.metaAdAccount.findMany({
      where: { tenantId, integration: { provider: 'META_ADS', status: 'ACTIVE' } },
      select: { accountId: true, name: true, currency: true, timezone: true, integrationId: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      accountId: row.accountId,
      name: row.name,
      currency: row.currency,
      timezone: row.timezone,
      integrationId: row.integrationId,
    }));
  }

  /**
   * The access token for an ad account, or for the tenant's Meta integration
   * when no account is named. Refuses with a message a person can act on.
   */
  async accessTokenFor(tenantId: string, adAccountId?: string | null): Promise<{ token: string; integrationId: string }> {
    const integration = adAccountId
      ? (await this.prisma.metaAdAccount.findFirst({
          where: { tenantId, accountId: adAccountId },
          select: { integration: { select: { id: true, tenantId: true, credentials: true, status: true, provider: true } } },
        }))?.integration ?? null
      : await this.prisma.integration.findFirst({
          where: { tenantId, provider: 'META_ADS', status: 'ACTIVE' },
          select: { id: true, tenantId: true, credentials: true, status: true, provider: true },
        });

    if (!integration) {
      throw new BadRequestException(
        adAccountId
          ? `Ad account ${adAccountId} is not connected to this tenant. Connect it under Integrations, then try again.`
          : 'No active Meta integration. Connect one under Integrations before sending drafts.',
      );
    }
    if (integration.tenantId !== tenantId) {
      throw new BadRequestException('That Meta integration belongs to another tenant.');
    }
    if (integration.status !== 'ACTIVE') {
      throw new BadRequestException('The Meta integration is not active. Reconnect it under Integrations.');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { encryptionKey: true } });
    if (!tenant) throw new BadRequestException('Tenant not found');

    let token = '';
    try {
      const credentials = this.encryption.decrypt(integration.credentials, tenant.encryptionKey) as { accessToken?: unknown };
      token = String(credentials?.accessToken ?? '').trim();
    } catch (error) {
      this.logger.warn(`Meta credentials unreadable for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException('The Meta integration credentials could not be read. Reconnect the integration and try again.');
    }
    if (!token) throw new BadRequestException('The Meta integration has no access token. Reconnect it under Integrations.');
    return { token, integrationId: integration.id };
  }
}
