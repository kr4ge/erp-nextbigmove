import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { WmsWarehousesService } from './wms-warehouses.service';
import { GetWmsWarehousesOverviewDto } from './dto/get-wms-warehouses-overview.dto';
import { CreateWmsWarehouseDto } from './dto/create-wms-warehouse.dto';
import { UpdateWmsWarehouseDto } from './dto/update-wms-warehouse.dto';
import { CreateWmsLocationDto } from './dto/create-wms-location.dto';
import { UpdateWmsLocationDto } from './dto/update-wms-location.dto';

@Controller('wms/warehouses')
@UseGuards(JwtAuthGuard, WmsAccessGuard)
export class WmsWarehousesController {
  constructor(private readonly wmsWarehousesService: WmsWarehousesService) {}

  @Get('overview')
  @Permissions('wms.warehouses.read')
  async getOverview(@Query() query: GetWmsWarehousesOverviewDto) {
    return this.wmsWarehousesService.getOverview(query);
  }

  @Post()
  @Permissions('wms.warehouses.write')
  async createWarehouse(@Body() body: CreateWmsWarehouseDto) {
    return this.wmsWarehousesService.createWarehouse(body);
  }

  @Patch(':id')
  @Permissions('wms.warehouses.edit')
  async updateWarehouse(@Param('id') id: string, @Body() body: UpdateWmsWarehouseDto) {
    return this.wmsWarehousesService.updateWarehouse(id, body);
  }

  @Post(':warehouseId/locations')
  @Permissions('wms.warehouses.write')
  async createLocation(
    @Param('warehouseId') warehouseId: string,
    @Body() body: CreateWmsLocationDto,
  ) {
    return this.wmsWarehousesService.createLocation(warehouseId, body);
  }

  @Patch('locations/:id')
  @Permissions('wms.warehouses.edit')
  async updateLocation(@Param('id') id: string, @Body() body: UpdateWmsLocationDto) {
    return this.wmsWarehousesService.updateLocation(id, body);
  }

  @Get('locations/:id/bin-detail')
  @Permissions('wms.warehouses.read')
  async getBinDetail(@Param('id') id: string) {
    return this.wmsWarehousesService.getBinDetail(id);
  }

}
