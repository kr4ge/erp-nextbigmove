import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateWmsPurchasingBatchDto } from './dto/create-wms-purchasing-batch.dto';
import { GetWmsPurchasingOverviewDto } from './dto/get-wms-purchasing-overview.dto';
import { GetWmsPurchasingProductOptionsDto } from './dto/get-wms-purchasing-product-options.dto';
import { MarkWmsSelfBuyShipmentDto } from './dto/mark-wms-self-buy-shipment.dto';
import { RespondWmsPurchasingRevisionDto } from './dto/respond-wms-purchasing-revision.dto';
import { SubmitWmsPurchasingPaymentProofDto } from './dto/submit-wms-purchasing-payment-proof.dto';
import { WmsPurchasingService } from './wms-purchasing.service';

type TenantRequest = {
  user?: {
    tenantId?: string | null;
  };
};

@Controller('stock-requests')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class StockRequestsController {
  constructor(private readonly wmsPurchasingService: WmsPurchasingService) {}

  @Get('overview')
  @Permissions('stock_request.read')
  async getOverview(@Request() req: TenantRequest, @Query() query: GetWmsPurchasingOverviewDto) {
    return this.wmsPurchasingService.getOverview({
      ...query,
      tenantId: this.getTenantId(req),
    });
  }

  @Get('products')
  @Permissions('stock_request.read')
  async getProductOptions(
    @Request() req: TenantRequest,
    @Query() query: GetWmsPurchasingProductOptionsDto,
  ) {
    return this.wmsPurchasingService.getProductOptions({
      ...query,
      tenantId: this.getTenantId(req),
    });
  }

  @Get(':id')
  @Permissions('stock_request.read')
  async getBatchById(@Request() req: TenantRequest, @Param('id') id: string) {
    return this.wmsPurchasingService.getBatchById(id, this.getTenantId(req));
  }

  @Post('batches')
  @Permissions('stock_request.write')
  async createBatch(@Request() req: TenantRequest, @Body() body: CreateWmsPurchasingBatchDto) {
    return this.wmsPurchasingService.createBatch(body, this.getTenantId(req));
  }

  @Post(':id/payment-proof')
  @Permissions('stock_request.write')
  async submitPaymentProof(
    @Request() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: SubmitWmsPurchasingPaymentProofDto,
  ) {
    return this.wmsPurchasingService.submitPartnerPaymentProof(id, body, this.getTenantId(req));
  }

  @Post(':id/revision-response')
  @Permissions('stock_request.write')
  async respondToRevision(
    @Request() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: RespondWmsPurchasingRevisionDto,
  ) {
    return this.wmsPurchasingService.respondToRevision(id, body, this.getTenantId(req));
  }

  @Post(':id/self-buy/shipped')
  @Permissions('stock_request.write')
  async markSelfBuyShipment(
    @Request() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: MarkWmsSelfBuyShipmentDto,
  ) {
    return this.wmsPurchasingService.markSelfBuyShipment(id, body, this.getTenantId(req));
  }

  private getTenantId(req: TenantRequest) {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required for stock requests');
    }

    return tenantId;
  }
}
