import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ReportsService } from './reports.service';
import { GetPosOrdersReportQueryDto } from './dto/get-pos-orders-report-query.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('pos-orders-summary')
  @Permissions('reports.pos_orders.read')
  async getPosOrdersSummary(@Query() query: GetPosOrdersReportQueryDto) {
    return this.reportsService.getPosOrdersSummary({
      startDate: query.start_date,
      endDate: query.end_date,
    });
  }
}
