import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AssignWmsReceivingPutawayDto } from './dto/assign-wms-receiving-putaway.dto';
import { CreateWmsReceivingBatchDto } from './dto/create-wms-receiving-batch.dto';
import { GetWmsReceivingOverviewDto } from './dto/get-wms-receiving-overview.dto';
import { RecordWmsReceivingBatchLabelPrintDto } from './dto/record-wms-receiving-batch-label-print.dto';
import { WmsReceivingService } from './wms-receiving.service';

@Controller('wms/receiving')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WmsReceivingController {
  constructor(private readonly wmsReceivingService: WmsReceivingService) {}

  @Get('overview')
  @Permissions('wms.receiving.read')
  async getOverview(@Query() query: GetWmsReceivingOverviewDto) {
    return this.wmsReceivingService.getOverview(query);
  }

  @Get(':id')
  @Permissions('wms.receiving.read')
  async getBatchById(@Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.wmsReceivingService.getBatchById(id, tenantId);
  }

  @Get(':id/putaway/options')
  @Permissions('wms.receiving.read')
  async getPutawayOptions(@Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.wmsReceivingService.getPutawayOptions(id, tenantId);
  }

  @Post('batches')
  @Permissions('wms.receiving.write', 'wms.purchasing.post_receiving')
  async createBatch(
    @Body() body: CreateWmsReceivingBatchDto,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsReceivingService.createBatch(body, tenantId);
  }

  @Post(':id/labels/print')
  @Permissions('wms.receiving.print_labels', 'wms.receiving.edit', 'wms.receiving.write')
  async recordBatchLabelPrint(
    @Param('id') id: string,
    @Body() body: RecordWmsReceivingBatchLabelPrintDto,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsReceivingService.recordBatchLabelPrint(id, body, tenantId);
  }

  @Post(':id/putaway/assign')
  @Permissions('wms.inventory.transfer', 'wms.receiving.edit', 'wms.receiving.write')
  async assignPutaway(
    @Param('id') id: string,
    @Body() body: AssignWmsReceivingPutawayDto,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsReceivingService.assignPutaway(id, body, tenantId);
  }
}
