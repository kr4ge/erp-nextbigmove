import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { SalesAttributionAnalyticsService } from './sales-attribution-analytics.service';
import { GetSalesAttributionOverviewQueryDto } from './dto/get-sales-attribution-overview-query.dto';

@Controller('analytics/sales-by-team')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SalesAttributionAnalyticsController {
  constructor(
    private readonly salesAttributionAnalyticsService: SalesAttributionAnalyticsService,
  ) {}

  @Get('overview')
  @Permissions('analytics.sales')
  async getOverview(@Query() query: GetSalesAttributionOverviewQueryDto) {
    return this.salesAttributionAnalyticsService.getOverview(query);
  }
}
