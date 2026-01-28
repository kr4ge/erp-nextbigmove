import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { MarketingAnalyticsService } from './marketing-analytics.service';
import { TeamGuard } from '../../common/guards/team.guard';

@Controller('analytics/marketing')
@UseGuards(JwtAuthGuard, TenantGuard, TeamGuard, PermissionsGuard)
export class MarketingAnalyticsController {
  constructor(private readonly marketingAnalyticsService: MarketingAnalyticsService) {}

  @Get('overview')
  @Permissions('analytics.marketing')
  async getOverview(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('associate') associate?: string | string[],
    @Query('exclude_cancel') excludeCancel?: string,
    @Query('exclude_restocking') excludeRestocking?: string,
    @Query('tables') tables?: string | string[],
  ) {
    const associates = Array.isArray(associate)
      ? associate
      : associate
      ? [associate]
      : [];
    const tableList = Array.isArray(tables)
      ? tables
      : tables
      ? tables.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    const parseBool = (val: string | undefined) => {
      if (val === undefined) return true;
      return !['false', '0', 'no', 'off'].includes(val.toLowerCase());
    };
    return this.marketingAnalyticsService.getOverview({
      startDate,
      endDate,
      associates,
      excludeCancel: parseBool(excludeCancel),
      excludeRestocking: parseBool(excludeRestocking),
      tables: tableList,
    });
  }

  @Get('my-stats')
  @Permissions('dashboard.marketing', 'dashboard.marketing_leader')
  async getMyStats(
    @Req() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('exclude_cancel') excludeCancel?: string,
    @Query('exclude_restocking') excludeRestocking?: string,
  ) {
    const parseBool = (val: string | undefined, defaultVal = true) => {
      if (val === undefined) return defaultVal;
      return !['false', '0', 'no', 'off'].includes(val.toLowerCase());
    };

    return this.marketingAnalyticsService.getMyStats({
      startDate,
      endDate,
      excludeCancel: parseBool(excludeCancel, true),
      excludeRestocking: parseBool(excludeRestocking, true),
      user: req.user,
    });
  }

  @Get('leader-stats')
  @Permissions('dashboard.marketing_leader')
  async getLeaderStats(
    @Req() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('exclude_cancel') excludeCancel?: string,
    @Query('exclude_restocking') excludeRestocking?: string,
    @Query('team_code') teamCode?: string,
  ) {
    const parseBool = (val: string | undefined, defaultVal = true) => {
      if (val === undefined) return defaultVal;
      return !['false', '0', 'no', 'off'].includes(val.toLowerCase());
    };

    return this.marketingAnalyticsService.getLeaderStats({
      startDate,
      endDate,
      excludeCancel: parseBool(excludeCancel, true),
      excludeRestocking: parseBool(excludeRestocking, true),
      user: req.user,
      teamCodeOverride: teamCode,
    });
  }
}
