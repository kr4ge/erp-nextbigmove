import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { GetAdvertisingDashboardQueryDto } from './dto/get-advertising-dashboard-query.dto';
import { CreativeAdvertisingDashboardService } from './services/creative-advertising-dashboard.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

@Controller('creative-agent')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeAdvertisingDashboardController {
  constructor(private readonly dashboard: CreativeAdvertisingDashboardService) {}

  @Get('advertising/dashboard')
  @Permissions('creative_agent.read_all')
  getDashboard(@Request() req: CreativeRequest, @Query() query: GetAdvertisingDashboardQueryDto) {
    return this.dashboard.getDashboard(req.user, query);
  }
}
