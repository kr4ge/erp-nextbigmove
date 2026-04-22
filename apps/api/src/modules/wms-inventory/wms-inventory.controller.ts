import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateWmsInventoryTransferDto } from './dto/create-wms-inventory-transfer.dto';
import { GetWmsInventoryOverviewDto } from './dto/get-wms-inventory-overview.dto';
import { GetWmsInventoryUnitMovementsDto } from './dto/get-wms-inventory-unit-movements.dto';
import { RecordWmsInventoryUnitLabelPrintDto } from './dto/record-wms-inventory-unit-label-print.dto';
import { WmsInventoryService } from './wms-inventory.service';

@Controller('wms/inventory')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WmsInventoryController {
  constructor(private readonly wmsInventoryService: WmsInventoryService) {}

  @Get('overview')
  @Permissions('wms.inventory.read')
  async getOverview(@Query() query: GetWmsInventoryOverviewDto) {
    return this.wmsInventoryService.getOverview(query);
  }

  @Get(':id/movements')
  @Permissions('wms.inventory.read')
  async getUnitMovements(
    @Param('id') id: string,
    @Query() query: GetWmsInventoryUnitMovementsDto,
  ) {
    return this.wmsInventoryService.getUnitMovements(id, query.tenantId);
  }

  @Get(':id/transfer-options')
  @Permissions('wms.inventory.read')
  async getUnitTransferOptions(
    @Param('id') id: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsInventoryService.getUnitTransferOptions(id, tenantId);
  }

  @Post(':id/labels/print')
  @Permissions('wms.inventory.print_labels', 'wms.inventory.edit', 'wms.inventory.write')
  async recordUnitLabelPrint(
    @Param('id') id: string,
    @Body() body: RecordWmsInventoryUnitLabelPrintDto,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsInventoryService.recordUnitLabelPrint(id, body, tenantId);
  }

  @Post('transfers')
  @Permissions('wms.inventory.transfer', 'wms.inventory.edit', 'wms.inventory.write')
  async createTransfer(
    @Body() body: CreateWmsInventoryTransferDto,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsInventoryService.createTransfer(body, tenantId);
  }
}
