import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetWmsDispatchOutboundDto } from './dto/get-wms-dispatch-outbound.dto';
import { GetWmsDispatchReportsDto } from './dto/get-wms-dispatch-reports.dto';
import { GetWmsDispatchReturnsDto } from './dto/get-wms-dispatch-returns.dto';
import { GetWmsDispatchSummaryDto } from './dto/get-wms-dispatch-summary.dto';
import { ReconcileWmsDispatchOutboundDto } from './dto/reconcile-wms-dispatch-outbound.dto';
import { VoidWmsDispatchOutboundDto } from './dto/void-wms-dispatch-outbound.dto';
import { WmsDispatchService } from './wms-dispatch.service';

@Controller('wms/dispatch')
@UseGuards(JwtAuthGuard, WmsAccessGuard)
export class WmsDispatchController {
  constructor(private readonly wmsDispatchService: WmsDispatchService) {}

  @Get('summary')
  @Permissions('wms.dispatch.read', 'wms.rts.read')
  async getSummary(@Query() query: GetWmsDispatchSummaryDto) {
    return this.wmsDispatchService.getSummary(query);
  }

  @Get('outbound')
  @Permissions('wms.dispatch.read')
  async getOutbound(@Query() query: GetWmsDispatchOutboundDto) {
    return this.wmsDispatchService.getOutbound(query);
  }

  @Get('outbound/:taskId')
  @Permissions('wms.dispatch.read')
  async getOutboundTask(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Query() query: GetWmsDispatchSummaryDto,
  ) {
    return this.wmsDispatchService.getOutboundTask(query, taskId);
  }

  @Get('reports')
  @Permissions('wms.dispatch.read', 'wms.rts.read')
  async getReports(@Query() query: GetWmsDispatchReportsDto) {
    return this.wmsDispatchService.getReports(query);
  }

  @Post('outbound/reconcile')
  @Permissions('wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override')
  async reconcileOutbound(@Request() req, @Body() body: ReconcileWmsDispatchOutboundDto) {
    return this.wmsDispatchService.reconcileOutbound(req.user, body, req);
  }

  @Post('outbound/:taskId/void')
  @Permissions('wms.dispatch.write', 'wms.dispatch.edit', 'wms.dispatch.override', 'wms.dispatch.void')
  async voidOutboundTask(
    @Request() req,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() body: VoidWmsDispatchOutboundDto,
  ) {
    return this.wmsDispatchService.voidOutboundTask(req.user, taskId, body, req);
  }

  @Get('returns')
  @Permissions('wms.rts.read', 'wms.dispatch.read')
  async getReturns(@Query() query: GetWmsDispatchReturnsDto) {
    return this.wmsDispatchService.getReturns(query);
  }

  @Get('returns/:taskId')
  @Permissions('wms.rts.read', 'wms.dispatch.read')
  async getReturnTask(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Query() query: GetWmsDispatchSummaryDto,
  ) {
    return this.wmsDispatchService.getReturnTask(query, taskId);
  }
}
