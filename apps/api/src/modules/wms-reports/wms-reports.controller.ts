import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { GetWmsMonthEndStockReportDto } from './dto/get-wms-month-end-stock-report.dto';
import { WmsReportsService } from './wms-reports.service';

@Controller('wms/reports')
@UseGuards(JwtAuthGuard, WmsAccessGuard)
export class WmsReportsController {
  constructor(private readonly wmsReportsService: WmsReportsService) {}

  @Get('month-end-stock')
  @Permissions('wms.reports.month_end_stock.read')
  async getMonthEndStockReport(@Query() query: GetWmsMonthEndStockReportDto) {
    return this.wmsReportsService.getMonthEndStockReport(query);
  }
}
