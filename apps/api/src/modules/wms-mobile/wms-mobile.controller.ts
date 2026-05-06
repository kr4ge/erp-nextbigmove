import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetWmsMobileStockDto } from './dto/get-wms-mobile-stock.dto';
import {
  GetWmsMobileStockScanDto,
  GetWmsMobileStockScopedDto,
  WmsMobileStockMoveDto,
} from './dto/wms-mobile-stock-execution.dto';
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
}
