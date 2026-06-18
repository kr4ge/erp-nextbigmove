import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetWmsMobileStockDto } from './dto/get-wms-mobile-stock.dto';
import {
  GetWmsMobileHomeInventorySummaryDto,
  GetWmsMobileRtsTasksDto,
  GetWmsMobileStockCountSessionsDto,
  GetWmsMobileHomeTaskSummaryDto,
  GetWmsMobileStockScanDto,
  GetWmsMobileStockScopedDto,
  GetWmsMobileTrackingLookupDto,
  WmsMobileCloseoutStockCountDto,
  WmsMobileReopenStockCountDto,
  WmsMobileScanStockCountUnitDto,
  WmsMobileStartStockCountDto,
  WmsMobileTrackingReturnDispositionDto,
  WmsMobileTrackingReturnUnitDto,
  WmsMobileSubmitStockCountDto,
  WmsMobileStockMoveDto,
} from './dto/wms-mobile-stock-execution.dto';
import {
  GetWmsMobilePickBasketLookupDto,
  WmsMobilePickBasketBatchAssignDto,
  WmsMobilePickHandoffDto,
  WmsMobilePickBasketUnitScanDto,
  WmsMobilePickBasketVoidDto,
  WmsMobilePickReallocateDto,
  GetWmsMobilePickingTasksDto,
  WmsMobilePickResyncDto,
  WmsMobilePickScanDto,
  WmsMobilePickScopedDto,
} from './dto/wms-mobile-picking.dto';
import {
  WmsMobilePackBasketVoidDto,
  WmsMobilePackBasketOrderCompleteDto,
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

  @Get('stox/release')
  @Permissions('wms.core.read')
  async getActiveStoxRelease(@Request() req) {
    return this.wmsMobileService.getActiveStoxRelease(req.user);
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
    'wms.rts.read',
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

  @Get('stock/counts')
  @Permissions('wms.inventory.read', 'wms.inventory.write', 'wms.inventory.edit')
  async getStockCountSessions(
    @Request() req,
    @Query() query: GetWmsMobileStockCountSessionsDto,
  ) {
    return this.wmsMobileService.getStockCountSessions(req.user, query, req);
  }

  @Get('stock/counts/:id')
  @Permissions('wms.inventory.read', 'wms.inventory.write', 'wms.inventory.edit')
  async getStockCountSession(
    @Request() req,
    @Param('id') id: string,
    @Query() query: GetWmsMobileStockScopedDto,
  ) {
    return this.wmsMobileService.getStockCountSession(req.user, id, query, req);
  }

  @Post('stock/counts/start')
  @Permissions('wms.inventory.write', 'wms.inventory.edit')
  async startStockCountSession(
    @Request() req,
    @Body() body: WmsMobileStartStockCountDto,
  ) {
    return this.wmsMobileService.startStockCountSession(req.user, body, req);
  }

  @Post('stock/counts/:id/scan-unit')
  @Permissions('wms.inventory.write', 'wms.inventory.edit')
  async scanStockCountUnit(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobileScanStockCountUnitDto,
  ) {
    return this.wmsMobileService.scanStockCountUnit(req.user, id, body, req);
  }

  @Post('stock/counts/:id/submit')
  @Permissions('wms.inventory.write', 'wms.inventory.edit')
  async submitStockCountSession(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobileSubmitStockCountDto,
  ) {
    return this.wmsMobileService.submitStockCountSession(req.user, id, body, req);
  }

  @Post('stock/counts/:id/reopen')
  @Permissions('wms.inventory.adjust')
  async reopenStockCountSession(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobileReopenStockCountDto,
  ) {
    return this.wmsMobileService.reopenStockCountSession(req.user, id, body, req);
  }

  @Post('stock/counts/:id/closeout')
  @Permissions('wms.inventory.adjust')
  async closeoutStockCountSession(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobileCloseoutStockCountDto,
  ) {
    return this.wmsMobileService.closeoutStockCountSession(req.user, id, body, req);
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

  @Get('tracking/tasks/rts')
  @Permissions(
    'wms.rts.read',
    'wms.inventory.read',
    'wms.receiving.read',
    'wms.dispatch.read',
    'wms.dispatch.write',
    'wms.dispatch.edit',
    'wms.dispatch.override',
  )
  async getRtsTasks(@Request() req, @Query() query: GetWmsMobileRtsTasksDto) {
    return this.wmsMobileService.getRtsTasks(req.user, query, req);
  }

  @Post('tracking/tasks/:id/verify-return-unit')
  @Permissions(
    'wms.dispatch.write',
    'wms.dispatch.edit',
    'wms.dispatch.override',
  )
  async verifyTrackingReturnUnit(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobileTrackingReturnUnitDto,
  ) {
    return this.wmsMobileService.verifyTrackingReturnUnit(req.user, id, body, req);
  }

  @Post('tracking/tasks/:id/disposition-return-unit')
  @Permissions(
    'wms.rts.disposition',
    'wms.dispatch.override',
  )
  async dispositionTrackingReturnUnit(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobileTrackingReturnDispositionDto,
  ) {
    return this.wmsMobileService.dispositionTrackingReturnUnit(req.user, id, body, req);
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

  @Post('picking/tasks/resync')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit', 'wms.fulfillment.override')
  async resyncPickingTasks(@Request() req, @Body() body: WmsMobilePickResyncDto) {
    return this.wmsMobileService.resyncPickingTasks(req.user, body, req);
  }

  @Post('picking/tasks/reallocate')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit', 'wms.fulfillment.override')
  async reallocatePickingTasks(@Request() req, @Body() body: WmsMobilePickReallocateDto) {
    return this.wmsMobileService.reallocatePickingTasks(req.user, body, req);
  }

  @Post('picking/tasks/batch-assign-basket')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit', 'wms.fulfillment.override')
  async assignPickingTasksToBasket(
    @Request() req,
    @Body() body: WmsMobilePickBasketBatchAssignDto,
  ) {
    return this.wmsMobileService.assignPickingTasksToBasket(req.user, body, req);
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

  @Get('picking/baskets/:id/plan')
  @Permissions('wms.fulfillment.read', 'wms.fulfillment.write', 'wms.fulfillment.edit')
  async getPickingBasketPlan(
    @Request() req,
    @Param('id') id: string,
    @Query() query: WmsMobilePickScopedDto,
  ) {
    return this.wmsMobileService.getPickingBasketPlan(req.user, id, query, req);
  }

  @Post('picking/baskets/:id/scan-bin')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit')
  async scanPickingBasketBin(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePickScanDto,
  ) {
    return this.wmsMobileService.scanPickingBasketBin(req.user, id, body, req);
  }

  @Post('picking/baskets/:id/scan-unit')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit')
  async scanPickingBasketUnit(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePickBasketUnitScanDto,
  ) {
    return this.wmsMobileService.scanPickingBasketUnit(req.user, id, body, req);
  }

  @Post('picking/baskets/:id/void')
  @Permissions('wms.fulfillment.override')
  async voidPickingBasket(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePickBasketVoidDto,
  ) {
    return this.wmsMobileService.voidPickingBasket(req.user, id, body, req);
  }

  @Post('picking/tasks/:id/retry-allocation')
  @Permissions('wms.fulfillment.write', 'wms.fulfillment.edit')
  async retryPickingTaskAllocation(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePickScopedDto,
  ) {
    return this.wmsMobileService.retryPickingTaskAllocation(req.user, id, body, req);
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

  @Get('packing/baskets/:id/plan')
  @Permissions('wms.dispatch.read', 'wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override')
  async getPackingBasketPlan(
    @Request() req,
    @Param('id') id: string,
    @Query() query: WmsMobilePackScopedDto,
  ) {
    return this.wmsMobileService.getPackingBasketPlan(req.user, id, query, req);
  }

  @Post('packing/baskets/:id/scan-waybill')
  @Permissions('wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override')
  async scanPackingBasketWaybill(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePackScanDto,
  ) {
    return this.wmsMobileService.scanPackingBasketWaybill(req.user, id, body, req);
  }

  @Post('packing/baskets/:id/orders/:orderId/scan-unit')
  @Permissions('wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override')
  async scanPackingBasketOrderUnit(
    @Request() req,
    @Param('id') id: string,
    @Param('orderId') orderId: string,
    @Body() body: WmsMobilePackScanDto,
  ) {
    return this.wmsMobileService.scanPackingBasketOrderUnit(req.user, id, orderId, body, req);
  }

  @Post('packing/baskets/:id/orders/:orderId/complete')
  @Permissions('wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override')
  async completePackingBasketOrder(
    @Request() req,
    @Param('id') id: string,
    @Param('orderId') orderId: string,
    @Body() body: WmsMobilePackBasketOrderCompleteDto,
  ) {
    return this.wmsMobileService.completePackingBasketOrder(req.user, id, orderId, body, req);
  }

  @Post('packing/baskets/:id/void-orders')
  @Permissions('wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override', 'wms.dispatch.void')
  async voidPackingBasketOrders(
    @Request() req,
    @Param('id') id: string,
    @Body() body: WmsMobilePackBasketVoidDto,
  ) {
    return this.wmsMobileService.voidPackingBasketOrders(req.user, id, body, req);
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
