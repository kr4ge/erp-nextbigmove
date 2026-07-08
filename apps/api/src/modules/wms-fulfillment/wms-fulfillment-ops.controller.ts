import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetWmsFulfillmentOpsSnapshotDto } from './dto/get-wms-fulfillment-ops-snapshot.dto';
import { GetWmsFulfillmentPriorityPreviewDto } from './dto/get-wms-fulfillment-priority-preview.dto';
import { PrioritizeWmsFulfillmentOrderDto } from './dto/prioritize-wms-fulfillment-order.dto';
import { RecalculateWmsDemandCountsDto } from './dto/recalculate-wms-demand-counts.dto';
import { ReleaseWmsFulfillmentPriorityDto } from './dto/release-wms-fulfillment-priority.dto';
import { RepairWmsDemandBasketsDto } from './dto/repair-wms-demand-baskets.dto';
import { WmsFulfillmentOpsService } from './wms-fulfillment-ops.service';

@Controller('wms/fulfillment')
@UseGuards(JwtAuthGuard, WmsAccessGuard)
export class WmsFulfillmentOpsController {
  constructor(private readonly wmsFulfillmentOpsService: WmsFulfillmentOpsService) {}

  @Get('ops/health')
  @Permissions('wms.fulfillment.override')
  async getOpsHealth(@Query() query: GetWmsFulfillmentOpsSnapshotDto) {
    return this.wmsFulfillmentOpsService.getOpsHealth(query);
  }

  @Get('ops/priority-preview')
  @Permissions('wms.fulfillment.override')
  async getPriorityPreview(@Query() query: GetWmsFulfillmentPriorityPreviewDto) {
    return this.wmsFulfillmentOpsService.getPriorityPreview(query);
  }

  @Post('ops/prioritize-order')
  @Permissions('wms.fulfillment.override')
  async prioritizeOrder(@Request() req, @Body() body: PrioritizeWmsFulfillmentOrderDto) {
    return this.wmsFulfillmentOpsService.prioritizeOrder(req.user, body, req);
  }

  @Post('ops/release-priority')
  @Permissions('wms.fulfillment.override')
  async releasePriority(@Request() req, @Body() body: ReleaseWmsFulfillmentPriorityDto) {
    return this.wmsFulfillmentOpsService.releasePriority(req.user, body, req);
  }

  @Post('ops/release-abandoned-demand-baskets')
  @Permissions('wms.fulfillment.override')
  async releaseAbandonedDemandBaskets(@Request() req, @Body() body: RepairWmsDemandBasketsDto) {
    return this.wmsFulfillmentOpsService.releaseAbandonedDemandBaskets(req.user, body, req);
  }

  @Post('ops/remove-stale-basket-units')
  @Permissions('wms.fulfillment.override')
  async removeStaleBasketUnits(@Request() req, @Body() body: RepairWmsDemandBasketsDto) {
    return this.wmsFulfillmentOpsService.removeStaleBasketUnits(req.user, body, req);
  }

  @Post('ops/recalculate-demand-counts')
  @Permissions('wms.fulfillment.override')
  async recalculateDemandCounts(@Request() req, @Body() body: RecalculateWmsDemandCountsDto) {
    return this.wmsFulfillmentOpsService.recalculateDemandCounts(req.user, body, req);
  }
}
