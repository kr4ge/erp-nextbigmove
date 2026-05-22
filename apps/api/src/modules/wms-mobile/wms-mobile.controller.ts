import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetWmsMobileStockDto } from './dto/get-wms-mobile-stock.dto';
import {
  GetWmsMobileHomeInventorySummaryDto,
  GetWmsMobileHomeTaskSummaryDto,
  GetWmsMobileStockScanDto,
  GetWmsMobileStockScopedDto,
  GetWmsMobileTrackingLookupDto,
  WmsMobileStockMoveDto,
} from './dto/wms-mobile-stock-execution.dto';
import {
  GetWmsMobilePickBasketLookupDto,
  WmsMobilePickHandoffDto,
  GetWmsMobilePickingTasksDto,
  WmsMobilePickScanDto,
  WmsMobilePickScopedDto,
} from './dto/wms-mobile-picking.dto';
import {
  GetWmsMobilePackingTasksDto,
  WmsMobilePackCompleteDto,
  WmsMobilePackScanDto,
  WmsMobilePackScopedDto,
  WmsMobilePackVoidDto,
} from './dto/wms-mobile-packing.dto';
import { GetWmsMobileHistoryFeedDto } from './dto/wms-mobile-history.dto';
import { WmsMobileService } from './wms-mobile.service';

@Controller('wms/mobile')
@UseGuards(JwtAuthGuard, WmsAccessGuard)
export class WmsMobileController {
  constructor(private readonly wmsMobileService: WmsMobileService) {}

  @Get('bootstrap')
  @Permissions('wms.core.read')
  async getBootstrap(@Request() req) {
    return this.wmsMobileService.getBootstrap(req.user, req);
  }

  @Get('tenants')
  @Permissions('wms.core.read')
  async getTenants(@Request() req) {
    return this.wmsMobileService.getTenantOptions(req.user);
  }

  @Get('stock')
  @Permissions('wms.inventory.read', 'wms.receiving.read')
  async getStock(@Request() req, @Query() query: GetWmsMobileStockDto) {
    return this.wmsMobileService.getStock(req.user, query, req);
  }

  @Get('home/inventory-summary')
  @Permissions('wms.core.read')
  async getHomeInventorySummary(
    @Request() req,
    @Query() query: GetWmsMobileHomeInventorySummaryDto,
  ) {
    return this.wmsMobileService.getHomeInventorySummary(req.user, query, req);
  }

  @Get('home/task-summary')
  @Permissions(
    'wms.core.read',
    'wms.fulfillment.read',
    'wms.fulfillment.write',
    'wms.fulfillment.edit',
    'wms.fulfillment.override',
    'wms.dispatch.read',
    'wms.dispatch.write',
    'wms.dispatch.edit',
    'wms.dispatch.override',
  )
  async getHomeTaskSummary(
    @Request() req,
    @Query() query: GetWmsMobileHomeTaskSummaryDto,
  ) {
    return this.wmsMobileService.getHomeTaskSummary(req.user, query, req);
  }

  @Get('stock/scan')
  @Permissions('wms.inventory.read', 'wms.receiving.read')
  async scanStockCode(@Request() req, @Query() query: GetWmsMobileStockScanDto) {
    return this.wmsMobileService.scanStockCode(req.user, query, req);
  }

  @Get('stock/units/:id')
  @Permissions('wms.inventory.read')
  async getStockUnit(
    @Request() req,
    @Param('id') id: string,
    @Query() query: GetWmsMobileStockScopedDto,
  ) {
    return this.wmsMobileService.getStockUnit(req.user, id, query, req);
  }

  @Get('stock/bins/:id')
  @Permissions('wms.inventory.read')
  async getStockBin(
    @Request() req,
    @Param('id') id: string,
    @Query() query: GetWmsMobileStockScopedDto,
  ) {
    return this.wmsMobileService.getStockBin(req.user, id, query, req);
  }

  @Get('stock/batches/:id')
  @Permissions('wms.receiving.read')
  async getStockBatch(
    @Request() req,
    @Param('id') id: string,
    @Query() query: GetWmsMobileStockScopedDto,
  ) {
    return this.wmsMobileService.getStockBatch(req.user, id, query, req);
  }

  @Get('tracking/lookup')
  @Permissions(
    'wms.inventory.read',
    'wms.receiving.read',
    'wms.fulfillment.read',
    'wms.dispatch.write',
    'wms.dispatch.edit',
    'wms.dispatch.override',
  )
  async lookupTracking(@Request() req, @Query() query: GetWmsMobileTrackingLookupDto) {
    return this.wmsMobileService.lookupTrackingOrder(req.user, query, req);
  }

  @Post('stock/putaway')
  @Permissions('wms.inventory.transfer', 'wms.receiving.edit', 'wms.receiving.write')
  async putawayStockUnit(@Request() req, @Body() body: WmsMobileStockMoveDto) {
    return this.wmsMobileService.putawayStockUnit(req.user, body, req);
  }

  @Post('stock/move')
  @Permissions('wms.inventory.transfer', 'wms.inventory.edit', 'wms.inventory.write')
  async moveStockUnit(@Request() req, @Body() body: WmsMobileStockMoveDto) {
    return this.wmsMobileService.moveStockUnit(req.user, body, req);
  }

  @Get('picking/tasks')
  @Permissions(
    'wms.fulfillment.read',
    'wms.fulfillment.write',
    'wms.fulfillment.edit',
    'wms.fulfillment.override',
  )
  async getPickingTasks(@Request() req, @Query() query: GetWmsMobilePickingTasksDto) {
    return this.wmsMobileService.getPickingTasks(req.user, query, req);
  }

  @Post('picking/tasks/:id/claim')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit')
  async claimPickingTask(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePickScopedDto,
  ) {
    return this.wmsMobileService.claimPickingTask(req.user, id, body, req);
  }

  @Post('picking/tasks/:id/scan-bin')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit')
  async scanPickingBin(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePickScanDto,
  ) {
    return this.wmsMobileService.scanPickingBin(req.user, id, body, req);
  }

  @Post('picking/tasks/:id/scan-basket')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit')
  async scanPickingBasket(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePickScanDto,
  ) {
    return this.wmsMobileService.scanPickingBasket(req.user, id, body, req);
  }

  @Post('picking/tasks/:id/scan-unit')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit')
  async scanPickingUnit(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePickScanDto,
  ) {
    return this.wmsMobileService.scanPickingUnit(req.user, id, body, req);
  }

  @Post('picking/tasks/:id/complete')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit')
  async completePickingTask(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePickScopedDto,
  ) {
    return this.wmsMobileService.completePickingTask(req.user, id, body, req);
  }

  @Post('picking/tasks/:id/handoff')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit')
  async handoffPickingTask(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePickHandoffDto,
  ) {
    return this.wmsMobileService.handoffPickingTask(req.user, id, body, req);
  }

  @Get('picking/baskets/lookup')
  @Permissions('wms.fulfillment.read')
  async lookupPickingBasket(@Request() req, @Query() query: GetWmsMobilePickBasketLookupDto) {
    return this.wmsMobileService.lookupPickingBasket(req.user, query, req);
  }

  @Get('packing/tasks')
  @Permissions('wms.dispatch.read', 'wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override')
  async getPackingTasks(@Request() req, @Query() query: GetWmsMobilePackingTasksDto) {
    return this.wmsMobileService.getPackingTasks(req.user, query, req);
  }

  @Get('history/feed')
  @Permissions(
    'wms.history.read_all',
    'wms.inventory.read',
    'wms.receiving.read',
    'wms.fulfillment.read',
    'wms.fulfillment.write',
    'wms.fulfillment.edit',
    'wms.fulfillment.override',
    'wms.dispatch.read',
    'wms.dispatch.write',
    'wms.dispatch.edit',
    'wms.dispatch.override',
    'wms.dispatch.void',
  )
  async getHistoryFeed(@Request() req, @Query() query: GetWmsMobileHistoryFeedDto) {
    return this.wmsMobileService.getHistoryFeed(req.user, query, req);
  }

  @Post('packing/tasks/:id/start')
  @Permissions('wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override')
  async startPackingTask(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePackScopedDto,
  ) {
    return this.wmsMobileService.startPackingTask(req.user, id, body, req);
  }

  @Post('packing/tasks/:id/scan-unit')
  @Permissions('wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override')
  async scanPackingUnit(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePackScanDto,
  ) {
    return this.wmsMobileService.scanPackingUnit(req.user, id, body, req);
  }

  @Post('packing/tasks/:id/verify-tracking')
  @Permissions('wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override')
  async verifyPackingTracking(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePackScanDto,
  ) {
    return this.wmsMobileService.verifyPackingTracking(req.user, id, body, req);
  }

  @Post('packing/tasks/:id/complete')
  @Permissions('wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override')
  async completePackingTask(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePackCompleteDto,
  ) {
    return this.wmsMobileService.completePackingTask(req.user, id, body, req);
  }

  @Post('packing/tasks/:id/void')
  @Permissions('wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override', 'wms.dispatch.void')
  async voidPackingTask(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePackVoidDto,
  ) {
    return this.wmsMobileService.voidPackingTask(req.user, id, body, req);
  }
}
