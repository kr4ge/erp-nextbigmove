import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import {
  CreateWmsStockRequestDto,
  CreateWmsStockRequestPaymentDto,
  ListWmsForecastsDto,
  ListWmsInvoicesDto,
  ListWmsPaymentsDto,
  ListWmsRequestProductsDto,
  ListWmsStockRequestsDto,
  RespondWmsStockRequestDto,
  ReviewWmsStockRequestDto,
  UpdateWmsStockRequestDto,
  UpsertWmsCompanyBillingSettingsDto,
  VerifyWmsStockRequestPaymentDto,
  AuditWmsStockRequestDto,
} from './dto';
import { WmsRequestsService } from './wms-requests.service';

@Controller('wms')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WmsRequestsController {
  constructor(private readonly wmsRequestsService: WmsRequestsService) {}

  @Get('partner-types')
  @Permissions('wms.partners.read')
  async listPartnerTypes() {
    return this.wmsRequestsService.listPartnerTypes();
  }

  @Get('company-settings/billing')
  @Permissions('wms.billing.read')
  async getCompanyBillingSettings() {
    return this.wmsRequestsService.getCompanyBillingSettings();
  }

  @Put('company-settings/billing')
  @Permissions('wms.billing.update')
  async upsertCompanyBillingSettings(
    @Body() dto: UpsertWmsCompanyBillingSettingsDto,
  ) {
    return this.wmsRequestsService.upsertCompanyBillingSettings(dto);
  }

  @Get('request-products')
  @Permissions('wms.requests.read', 'wms.inventory.read')
  async listRequestProducts(@Query() query: ListWmsRequestProductsDto) {
    return this.wmsRequestsService.listRequestProducts(query);
  }

  @Get('forecasts')
  @Permissions('wms.requests.read')
  async listForecasts(@Query() query: ListWmsForecastsDto) {
    return this.wmsRequestsService.listForecasts(query);
  }

  @Get('stock-requests')
  @Permissions('wms.requests.read')
  async listStockRequests(@Query() query: ListWmsStockRequestsDto) {
    return this.wmsRequestsService.listStockRequests(query);
  }

  @Get('stock-requests/:id')
  @Permissions('wms.requests.read')
  async getStockRequest(@Param('id') id: string) {
    return this.wmsRequestsService.getStockRequest(id);
  }

  @Post('stock-requests')
  @Permissions('wms.requests.create')
  async createStockRequest(@Body() dto: CreateWmsStockRequestDto) {
    return this.wmsRequestsService.createStockRequest(dto);
  }

  @Patch('stock-requests/:id')
  @Permissions('wms.requests.update')
  async updateStockRequest(
    @Param('id') id: string,
    @Body() dto: UpdateWmsStockRequestDto,
  ) {
    return this.wmsRequestsService.updateStockRequest(id, dto);
  }

  @Post('stock-requests/:id/submit')
  @Permissions('wms.requests.update')
  async submitStockRequest(@Param('id') id: string) {
    return this.wmsRequestsService.submitStockRequest(id);
  }

  @Post('stock-requests/:id/review')
  @Permissions('wms.requests.update')
  async reviewStockRequest(
    @Param('id') id: string,
    @Body() dto: ReviewWmsStockRequestDto,
  ) {
    return this.wmsRequestsService.reviewStockRequest(id, dto);
  }

  @Post('stock-requests/:id/respond')
  @Permissions('wms.requests.update')
  async respondToStockRequest(
    @Param('id') id: string,
    @Body() dto: RespondWmsStockRequestDto,
  ) {
    return this.wmsRequestsService.respondToStockRequest(id, dto);
  }

  @Post('stock-requests/:id/start-audit')
  @Permissions('wms.requests.update')
  async startStockRequestAudit(@Param('id') id: string) {
    return this.wmsRequestsService.startStockRequestAudit(id);
  }

  @Post('stock-requests/:id/audit')
  @Permissions('wms.requests.update')
  async auditStockRequest(
    @Param('id') id: string,
    @Body() dto: AuditWmsStockRequestDto,
  ) {
    return this.wmsRequestsService.auditStockRequest(id, dto);
  }

  @Post('stock-requests/:id/procure')
  @Permissions('wms.requests.update', 'wms.purchasing.update')
  async markRequestInProcurement(@Param('id') id: string) {
    return this.wmsRequestsService.markRequestInProcurement(id);
  }

  @Get('invoices')
  @Permissions('wms.billing.read')
  async listInvoices(@Query() query: ListWmsInvoicesDto) {
    return this.wmsRequestsService.listInvoices(query);
  }

  @Get('payments')
  @Permissions('wms.billing.read')
  async listPayments(@Query() query: ListWmsPaymentsDto) {
    return this.wmsRequestsService.listPayments(query);
  }

  @Post('stock-requests/:id/payments')
  @Permissions('wms.billing.create', 'wms.requests.update')
  async submitPayment(
    @Param('id') id: string,
    @Body() dto: CreateWmsStockRequestPaymentDto,
  ) {
    return this.wmsRequestsService.submitPayment(id, dto);
  }

  @Post('payments/:paymentId/verify')
  @Permissions('wms.billing.update')
  async verifyPayment(
    @Param('paymentId') paymentId: string,
    @Body() dto: VerifyWmsStockRequestPaymentDto,
  ) {
    return this.wmsRequestsService.verifyPayment(paymentId, dto);
  }
}
