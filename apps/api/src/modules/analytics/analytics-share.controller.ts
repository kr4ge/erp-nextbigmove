import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TeamGuard } from '../../common/guards/team.guard';
import { AnalyticsShareService } from './analytics-share.service';

@Controller('analytics/shares')
@UseGuards(JwtAuthGuard, TenantGuard, TeamGuard, PermissionsGuard)
export class AnalyticsShareController {
  constructor(private readonly shareService: AnalyticsShareService) {}

  @Get()
  @Permissions('analytics.share')
  async list(@Query('scope') scope: string) {
    const sharedTeamIds = await this.shareService.list(scope || 'both');
    return { sharedTeamIds };
  }

  @Post()
  @Permissions('analytics.share')
  async set(@Body() body: { scope?: string; sharedTeamIds?: string[] }) {
    const scope = body.scope || 'both';
    const sharedTeamIds = Array.isArray(body.sharedTeamIds) ? body.sharedTeamIds : [];
    return this.shareService.setShares(scope, sharedTeamIds);
  }
}
