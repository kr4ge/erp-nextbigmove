import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { SalesAnalyticsService } from './sales-analytics.service';

@Controller('analytics/sales')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SalesAnalyticsController {
  constructor(private readonly salesAnalyticsService: SalesAnalyticsService) {}

  @Get('overview')
  @Permissions('analytics.sales')
  async getOverview(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('mapping') mapping?: string | string[],
    @Query('exclude_cancel') excludeCancel?: string,
    @Query('exclude_restocking') excludeRestocking?: string,
    @Query('exclude_rts') excludeRts?: string,
    @Query('include_tax_12') includeTax12?: string,
    @Query('include_tax_1') includeTax1?: string,
  ) {
    const mappings = Array.isArray(mapping)
      ? mapping
      : mapping
      ? [mapping]
      : [];
    const parseBool = (val: string | undefined, defaultVal = true) => {
      if (val === undefined) return defaultVal;
      return !['false', '0', 'no', 'off'].includes(val.toLowerCase());
    };

    return this.salesAnalyticsService.getOverview({
      startDate,
      endDate,
      mappings,
      excludeCancel: parseBool(excludeCancel, true),
      excludeRestocking: parseBool(excludeRestocking, true),
      excludeRts: parseBool(excludeRts, true),
      includeTax12: parseBool(includeTax12, false),
      includeTax1: parseBool(includeTax1, false),
    });
  }

  @Get('executive-overview')
  @Permissions('dashboard.executives')
  async getExecutiveOverview(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('mapping') mapping?: string | string[],
    @Query('exclude_cancel') excludeCancel?: string,
    @Query('exclude_restocking') excludeRestocking?: string,
    @Query('exclude_rts') excludeRts?: string,
    @Query('include_tax_12') includeTax12?: string,
    @Query('include_tax_1') includeTax1?: string,
  ) {
    const mappings = Array.isArray(mapping)
      ? mapping
      : mapping
      ? [mapping]
      : [];
    const parseBool = (val: string | undefined, defaultVal = true) => {
      if (val === undefined) return defaultVal;
      return !['false', '0', 'no', 'off'].includes(val.toLowerCase());
    };

    return this.salesAnalyticsService.getOverview({
      startDate,
      endDate,
      mappings,
      excludeCancel: parseBool(excludeCancel, true),
      excludeRestocking: parseBool(excludeRestocking, true),
      excludeRts: parseBool(excludeRts, true),
      includeTax12: parseBool(includeTax12, false),
      includeTax1: parseBool(includeTax1, false),
    });
  }
}
