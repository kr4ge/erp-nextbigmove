import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import { AnalyticsShareScope } from '@prisma/client';

@Injectable()
export class AnalyticsShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamContext: TeamContextService,
  ) {}

  private normalizeScope(scope: string): AnalyticsShareScope {
    const map: Record<string, AnalyticsShareScope> = {
      sales: AnalyticsShareScope.SALES,
      marketing: AnalyticsShareScope.MARKETING,
      both: AnalyticsShareScope.BOTH,
    };
    const normalized = scope?.toLowerCase();
    const val = map[normalized as keyof typeof map];
    if (!val) {
      throw new BadRequestException('Invalid scope');
    }
    return val;
  }

  async list(scope: string) {
    const { tenantId } = await this.teamContext.getContext();
    const ownerTeamId = await this.teamContext.validateAndGetTeamId(undefined);
    if (!ownerTeamId) {
      throw new ForbiddenException('Team context is required to view shares');
    }
    const scopeEnum = this.normalizeScope(scope);

    const shares = await this.prisma.analyticsShare.findMany({
      where: { tenantId, ownerTeamId, scope: scopeEnum },
      select: { targetTeamId: true },
    });

    return shares.map((s) => s.targetTeamId);
  }

  async setShares(scope: string, sharedTeamIds: string[]) {
    const { tenantId } = await this.teamContext.getContext();
    const ownerTeamId = await this.teamContext.validateAndGetTeamId(undefined);
    if (!ownerTeamId) {
      throw new ForbiddenException('Team context is required to share analytics');
    }
    const scopeEnum = this.normalizeScope(scope);

    const uniqueIds = Array.from(new Set((sharedTeamIds || []).filter(Boolean)));

    if (uniqueIds.length > 0) {
      const teams = await this.prisma.team.findMany({
        where: { tenantId, id: { in: uniqueIds } },
        select: { id: true },
      });
      const valid = teams.map((t) => t.id);
      if (valid.length !== uniqueIds.length) {
        throw new BadRequestException('One or more teams are invalid');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.analyticsShare.deleteMany({ where: { tenantId, ownerTeamId, scope: scopeEnum } });
      if (uniqueIds.length > 0) {
        await tx.analyticsShare.createMany({
          data: uniqueIds.map((tid) => ({ tenantId, ownerTeamId, targetTeamId: tid, scope: scopeEnum })),
          skipDuplicates: true,
        });
      }
    });

    return { ownerTeamId, scope: scopeEnum, sharedTeamIds: uniqueIds };
  }
}
