import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { SalesPerformanceService } from './sales-performance.service';

@Controller('analytics/sales-performance')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SalesPerformanceController {
  constructor(private readonly salesPerformanceService: SalesPerformanceService) {}

  @Get('overview')
  @Permissions('analytics.sales_performance')
  async getOverview(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('sales_assignee') salesAssignee?: string | string[],
  ) {
    const rawAssignees = Array.isArray(salesAssignee)
      ? salesAssignee
      : salesAssignee
      ? [salesAssignee]
      : [];
    const salesAssignees = rawAssignees
      .flatMap((value) => (value ? value.toString().split(',') : []))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    return this.salesPerformanceService.getOverview({
      startDate,
      endDate,
      salesAssignees,
    });
  }
}
