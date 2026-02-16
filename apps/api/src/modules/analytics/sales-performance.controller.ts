import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
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
      includeShopOptions: true,
    });
  }

  @Get('my-stats')
  @Permissions('dashboard.sales')
  async getMyStats(
    @Req() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('shop_id') shopId?: string | string[],
  ) {
    const rawShopIds = Array.isArray(shopId)
      ? shopId
      : shopId
      ? [shopId]
      : [];
    const shopIds = rawShopIds
      .flatMap((value) => (value ? value.toString().split(',') : []))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const salesAssignee =
      req?.user?.employeeId ||
      req?.user?.employee_id ||
      null;

    return this.salesPerformanceService.getMyStats({
      startDate,
      endDate,
      salesAssignee,
      shopIds,
    });
  }

  @Post('pos-orders/delete-range')
  @Permissions('analytics.sales_performance')
  async deletePosOrdersInRange(@Body() body: { start_date?: string; end_date?: string }) {
    return this.salesPerformanceService.deletePosOrdersInRange(body?.start_date, body?.end_date);
  }
}
