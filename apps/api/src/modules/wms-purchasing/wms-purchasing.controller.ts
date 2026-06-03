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
import { NotificationSystem } from '@prisma/client';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WmsAccessGuard } from '../../common/guards/wms-access.guard';
import { CreateWmsPurchasingBatchDto } from './dto/create-wms-purchasing-batch.dto';
import { GetWmsPurchasingOverviewDto } from './dto/get-wms-purchasing-overview.dto';
import { GetWmsPurchasingProductOptionsDto } from './dto/get-wms-purchasing-product-options.dto';
import { RespondWmsPurchasingRevisionDto } from './dto/respond-wms-purchasing-revision.dto';
import { SubmitWmsPurchasingPaymentProofDto } from './dto/submit-wms-purchasing-payment-proof.dto';
import { UpdateWmsPurchasingLineDto } from './dto/update-wms-purchasing-line.dto';
import { UpdateWmsPurchasingStatusDto } from './dto/update-wms-purchasing-status.dto';
import { WmsPurchasingService } from './wms-purchasing.service';

@Controller('wms/purchasing')
@UseGuards(JwtAuthGuard, WmsAccessGuard)
export class WmsPurchasingController {
  constructor(private readonly wmsPurchasingService: WmsPurchasingService) {}

  @Get('overview')
  @Permissions('wms.purchasing.read', 'stock_request.read')
  async getOverview(@Query() query: GetWmsPurchasingOverviewDto) {
    return this.wmsPurchasingService.getOverview(query);
  }

  @Get('products')
  @Permissions('wms.purchasing.read', 'stock_request.read')
  async getProductOptions(@Query() query: GetWmsPurchasingProductOptionsDto) {
    return this.wmsPurchasingService.getProductOptions(query);
  }

  @Get('notifications/unread-count')
  @Permissions('wms.purchasing.read', 'stock_request.read')
  async getUnreadNotificationCount(@Query('tenantId') tenantId?: string) {
    return this.wmsPurchasingService.getUnreadNotificationCount(NotificationSystem.WMS, tenantId);
  }

  @Get(':id')
  @Permissions('wms.purchasing.read', 'stock_request.read')
  async getBatchById(@Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.wmsPurchasingService.getBatchById(id, tenantId);
  }

  @Post('batches')
  @Permissions('wms.purchasing.write', 'stock_request.write')
  async createBatch(
    @Body() body: CreateWmsPurchasingBatchDto,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsPurchasingService.createBatch(body, tenantId);
  }

  @Post(':id/payment-proof')
  @Permissions('wms.purchasing.write', 'wms.purchasing.edit', 'stock_request.write')
  async submitPaymentProof(
    @Param('id') id: string,
    @Body() body: SubmitWmsPurchasingPaymentProofDto,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsPurchasingService.submitPartnerPaymentProof(id, body, tenantId);
  }

  @Post(':id/revision-response')
  @Permissions('wms.purchasing.write', 'wms.purchasing.edit', 'stock_request.write')
  async respondToRevision(
    @Param('id') id: string,
    @Body() body: RespondWmsPurchasingRevisionDto,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsPurchasingService.respondToRevision(id, body, tenantId);
  }

  @Post(':id/notifications/read')
  @HttpCode(200)
  @Permissions('wms.purchasing.read', 'stock_request.read')
  async markNotificationsRead(@Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.wmsPurchasingService.markBatchNotificationsRead(id, NotificationSystem.WMS, tenantId);
  }

  @Patch(':id/status')
  @Permissions('wms.purchasing.edit')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateWmsPurchasingStatusDto,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsPurchasingService.updateStatus(id, body, tenantId);
  }

  @Patch(':id/lines/:lineId')
  @Permissions('wms.purchasing.edit')
  async updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateWmsPurchasingLineDto,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.wmsPurchasingService.updateLine(id, lineId, body, tenantId);
  }
}
