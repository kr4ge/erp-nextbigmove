import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
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
import { GetUndeliverablesQueryDto } from './dto/get-undeliverables-query.dto';
import { MarkAgingOrdersSummaryNotificationReadDto } from './dto/mark-aging-orders-summary-notification-read.dto';
import { CreateUndeliverableOrderRemarkDto } from './dto/create-undeliverable-order-remark.dto';
import { CreateUndeliverableRemarkOptionDto } from './dto/create-undeliverable-remark-option.dto';
import { UpdateConfirmationOrderStatusDto } from './dto/update-confirmation-order-status.dto';
import { UpdateUndeliverableOrderRemarkDto } from './dto/update-undeliverable-order-remark.dto';
import { UpdateUndeliverableRemarkOptionDto } from './dto/update-undeliverable-remark-option.dto';
import { UpdateUndeliverableStoreAssignmentsDto } from './dto/update-undeliverable-store-assignments.dto';

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

  @Get('undeliverables')
  @Permissions('orders.undeliverables.read', 'orders.undeliverables.read_all')
  async listUndeliverables(@Query() query: GetUndeliverablesQueryDto) {
    return this.ordersService.listUndeliverables(query);
  }

  @Get('undeliverables/assignments')
  @Permissions('orders.undeliverables.read_all', 'orders.undeliverables.assign')
  async getUndeliverableAssignments() {
    return this.ordersService.getUndeliverableAssignments();
  }

  @Put('undeliverables/assignments/:userId')
  @Permissions('orders.undeliverables.assign')
  async updateUndeliverableAssignments(
    @Param('userId') userId: string,
    @Body() body: UpdateUndeliverableStoreAssignmentsDto,
  ) {
    return this.ordersService.updateUndeliverableAssignments(userId, body.storeIds ?? []);
  }

  @Get('undeliverables/:orderId/remarks')
  @Permissions('orders.undeliverables.read', 'orders.undeliverables.read_all')
  async listUndeliverableRemarks(@Param('orderId') orderId: string) {
    return this.ordersService.listUndeliverableRemarks(orderId);
  }

  @Get('undeliverables/remark-options')
  @Permissions('orders.undeliverables.read', 'orders.undeliverables.read_all')
  async listUndeliverableRemarkOptions() {
    return this.ordersService.listUndeliverableRemarkOptions();
  }

  @Post('undeliverables/remark-options')
  @Permissions('orders.undeliverables.remarks.write')
  async createUndeliverableRemarkOption(@Body() body: CreateUndeliverableRemarkOptionDto) {
    return this.ordersService.createUndeliverableRemarkOption(body.remark);
  }

  @Patch('undeliverables/remark-options/:remarkOptionId')
  @Permissions('orders.undeliverables.remarks.write')
  async updateUndeliverableRemarkOption(
    @Param('remarkOptionId') remarkOptionId: string,
    @Body() body: UpdateUndeliverableRemarkOptionDto,
  ) {
    return this.ordersService.updateUndeliverableRemarkOption(remarkOptionId, body.remark);
  }

  @Post('undeliverables/remark-options/:remarkOptionId/delete')
  @HttpCode(200)
  @Permissions('orders.undeliverables.remarks.write')
  async deleteUndeliverableRemarkOption(@Param('remarkOptionId') remarkOptionId: string) {
    return this.ordersService.deleteUndeliverableRemarkOption(remarkOptionId);
  }

  @Post('undeliverables/:orderId/remarks')
  @Permissions('orders.undeliverables.remarks.write')
  async createUndeliverableRemark(
    @Param('orderId') orderId: string,
    @Body() body: CreateUndeliverableOrderRemarkDto,
  ) {
    return this.ordersService.createUndeliverableRemark(orderId, body.remarkOptionId);
  }

  @Patch('undeliverables/remarks/:remarkId')
  @Permissions('orders.undeliverables.remarks.write')
  async updateUndeliverableRemark(
    @Param('remarkId') remarkId: string,
    @Body() body: UpdateUndeliverableOrderRemarkDto,
  ) {
    return this.ordersService.updateUndeliverableRemark(remarkId, body.remarkOptionId);
  }

  @Post('undeliverables/remarks/:remarkId/delete')
  @HttpCode(200)
  @Permissions('orders.undeliverables.remarks.write')
  async deleteUndeliverableRemark(@Param('remarkId') remarkId: string) {
    return this.ordersService.deleteUndeliverableRemark(remarkId);
  }
}
