import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { OrdersService } from './orders.service';
import { GetAgingOrdersSummaryQueryDto } from './dto/get-aging-orders-summary-query.dto';
import { GetOrderStatusSummaryQueryDto } from './dto/get-order-status-summary-query.dto';
import { MarkAgingOrdersSummaryNotificationReadDto } from './dto/mark-aging-orders-summary-notification-read.dto';
import { UpdateConfirmationOrderStatusDto } from './dto/update-confirmation-order-status.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('summary/aging')
  @Permissions('orders.summary.read')
  async getAgingOrdersSummary(@Query() query: GetAgingOrdersSummaryQueryDto) {
    return this.ordersService.getAgingOrdersSummary({
      thresholdDays: query.threshold_days,
    });
  }

  @Get('summary/status')
  @Permissions('orders.summary.read')
  async getOrderStatusSummary(@Query() query: GetOrderStatusSummaryQueryDto) {
    return this.ordersService.getOrderStatusSummary({
      dateLocal: query.date_local,
      shopIds: query.shop_id,
    });
  }

  @Get('summary/aging/notifications/unread-count')
  @Permissions('orders.summary.read')
  async getAgingOrdersUnreadNotificationCount() {
    return this.ordersService.getAgingOrdersUnreadNotificationCount();
  }

  @Post('summary/aging/notifications/read')
  @HttpCode(200)
  @Permissions('orders.summary.read')
  async markAgingOrdersSummaryNotificationRead(
    @Body() body: MarkAgingOrdersSummaryNotificationReadDto,
  ) {
    return this.ordersService.markAgingOrdersNotificationRead(body);
  }

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

  @Get('confirmation/:id/product-options')
  @Permissions('pos.read')
  async listConfirmationOrderProductOptions(
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.listConfirmationOrderProductOptions(id, search, limit);
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
