import { Controller, Get, Patch, Param, Query, Body, UseGuards, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { WmsProductsService } from './wms-products.service';
import { GetWmsProductsOverviewDto } from './dto/get-wms-products-overview.dto';
import { UpdateWmsProductProfileDto } from './dto/update-wms-product-profile.dto';

@Controller('wms/products')
@UseGuards(JwtAuthGuard, WmsAccessGuard)
export class WmsProductsController {
  constructor(private readonly wmsProductsService: WmsProductsService) {}

  @Get('overview')
  @Permissions('wms.products.read')
  async getOverview(@Query() query: GetWmsProductsOverviewDto) {
    return this.wmsProductsService.getOverview(query);
  }

  @Patch(':id')
  @Permissions('wms.products.edit')
  async updateProfile(
    @Param('id') id: string,
    @Body() body: UpdateWmsProductProfileDto,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsProductsService.updateProfile(id, body, tenantId);
  }

  @Post('stores/:storeId/sync')
  @Permissions('wms.products.sync', 'wms.products.write')
  async syncStoreProducts(
    @Param('storeId') storeId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsProductsService.syncStoreProducts(storeId, tenantId);
  }
}
