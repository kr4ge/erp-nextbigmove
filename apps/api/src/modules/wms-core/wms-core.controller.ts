import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { WmsCoreService } from './wms-core.service';

@Controller('wms/core')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WmsCoreController {
  constructor(private readonly wmsCoreService: WmsCoreService) {}

  @Get('bootstrap')
  @Permissions(
    'wms.core.read',
    'wms.purchasing.read',
    'wms.warehouses.read',
    'wms.products.read',
    'wms.receiving.read',
    'wms.inventory.read',
  )
  async getBootstrap() {
    return this.wmsCoreService.getBootstrap();
  }
}
