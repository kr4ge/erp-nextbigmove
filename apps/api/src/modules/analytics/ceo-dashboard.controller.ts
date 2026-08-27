import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { GetCeoDashboardQueryDto } from './dto/get-ceo-dashboard-query.dto';
import { CeoDashboardService } from './services/ceo-dashboard.service';

@Controller('analytics/ceo')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CeoDashboardController {
  constructor(
    private readonly dashboard: CeoDashboardService,
    private readonly cls: ClsService,
  ) {}

  @Get('dashboard')
  @Permissions('dashboard.executives')
  getDashboard(@Query() query: GetCeoDashboardQueryDto) {
    // Tenant comes from the request context, never from the payload.
    return this.dashboard.getDashboard(this.cls.get<string>('tenantId'), query);
  }
}
