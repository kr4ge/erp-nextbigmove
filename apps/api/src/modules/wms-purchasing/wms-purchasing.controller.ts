import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateWmsStockReceiptDto } from './dto/create-wms-stock-receipt.dto';
import { ListWmsStockReceiptsDto } from './dto/list-wms-stock-receipts.dto';
import { WmsPurchasingService } from './wms-purchasing.service';

@Controller('wms/purchasing')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WmsPurchasingController {
  constructor(private readonly wmsPurchasingService: WmsPurchasingService) {}

  @Get('receipts')
  @Permissions('wms.purchasing.read')
  async listReceipts(@Query() query: ListWmsStockReceiptsDto) {
    return this.wmsPurchasingService.listReceipts(query);
  }

  @Post('receipts')
  @Permissions('wms.purchasing.create', 'wms.inventory.update')
  async createReceipt(@Body() dto: CreateWmsStockReceiptDto) {
    return this.wmsPurchasingService.createReceipt(dto);
  }
}
