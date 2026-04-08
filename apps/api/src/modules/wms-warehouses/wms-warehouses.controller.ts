import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateWmsLocationDto } from './dto/create-wms-location.dto';
import { CreateWmsWarehouseDto } from './dto/create-wms-warehouse.dto';
import { UpdateWmsLocationDto } from './dto/update-wms-location.dto';
import { UpdateWmsWarehouseDto } from './dto/update-wms-warehouse.dto';
import { WmsWarehousesService } from './wms-warehouses.service';

@Controller('wms/warehouses')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WmsWarehousesController {
  constructor(private readonly wmsWarehousesService: WmsWarehousesService) {}

  @Get()
  @Permissions('wms.warehouses.read')
  async listWarehouses() {
    return this.wmsWarehousesService.listWarehouses();
  }

  @Post()
  @Permissions('wms.warehouses.create')
  async createWarehouse(@Body() dto: CreateWmsWarehouseDto) {
    return this.wmsWarehousesService.createWarehouse(dto);
  }

  @Patch(':id')
  @Permissions('wms.warehouses.update')
  async updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWmsWarehouseDto) {
    return this.wmsWarehousesService.updateWarehouse(id, dto);
  }

  @Delete(':id')
  @Permissions('wms.warehouses.delete')
  async removeWarehouse(@Param('id') id: string) {
    return this.wmsWarehousesService.removeWarehouse(id);
  }

  @Post(':warehouseId/locations')
  @Permissions('wms.warehouses.create')
  async createLocation(
    @Param('warehouseId') warehouseId: string,
    @Body() dto: CreateWmsLocationDto,
  ) {
    return this.wmsWarehousesService.createLocation(warehouseId, dto);
  }

  @Patch(':warehouseId/locations/:locationId')
  @Permissions('wms.warehouses.update')
  async updateLocation(
    @Param('warehouseId') warehouseId: string,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateWmsLocationDto,
  ) {
    return this.wmsWarehousesService.updateLocation(warehouseId, locationId, dto);
  }

  @Delete(':warehouseId/locations/:locationId')
  @Permissions('wms.warehouses.delete')
  async removeLocation(
    @Param('warehouseId') warehouseId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.wmsWarehousesService.removeLocation(warehouseId, locationId);
  }
}
