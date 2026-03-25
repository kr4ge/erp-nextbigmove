import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { OrdersService } from './orders.service';
import { UpdateConfirmationOrderStatusDto } from './dto/update-confirmation-order-status.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('confirmation')
  @Permissions('pos.read')
  async listConfirmationOrders(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('shop_id') shopIds?: string | string[],
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.listConfirmationOrders({
      startDate,
      endDate,
      shopIds,
      search,
      page,
      limit,
    });
  }

  @Get('geo/provinces')
  @Permissions('pos.read')
  async listGeoProvinces(
    @Query('country_code') countryCode?: string,
  ) {
    return this.ordersService.listGeoProvinces(countryCode || '63');
  }

  @Get('geo/districts')
  @Permissions('pos.read')
  async listGeoDistricts(
    @Query('province_id') provinceId?: string,
  ) {
    return this.ordersService.listGeoDistricts(provinceId || '');
  }

  @Get('geo/communes')
  @Permissions('pos.read')
  async listGeoCommunes(
    @Query('province_id') provinceId?: string,
    @Query('district_id') districtId?: string,
  ) {
    return this.ordersService.listGeoCommunes(provinceId || '', districtId);
  }

  @Get('confirmation/history-by-phone')
  @Permissions('pos.read')
  async listConfirmationPhoneHistory(
    @Query('phone') phone?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.listConfirmationPhoneHistory({
      phone,
      page,
      limit,
    });
  }

  @Get('confirmation/:id/tag-options')
  @Permissions('pos.read')
  async listConfirmationOrderTagOptions(
    @Param('id') id: string,
  ) {
    return this.ordersService.listConfirmationOrderTagOptions(id);
  }

  @Patch('confirmation/:id/status')
  @Permissions('pos.read')
  async updateConfirmationOrderStatus(
    @Param('id') id: string,
    @Body() body: UpdateConfirmationOrderStatusDto,
  ) {
    return this.ordersService.updateConfirmationOrderStatus(id, body);
  }
}
