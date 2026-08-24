import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { GetCreativeOverviewQueryDto } from './dto/get-creative-overview-query.dto';
import { CreativeOverviewService } from './services/creative-overview.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

@Controller('creative-agent')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeOverviewController {
  constructor(private readonly overview: CreativeOverviewService) {}

  @Get('overview')
  @Permissions('creative_agent.read', 'creative_agent.read_all')
  getOverview(@Request() req: CreativeRequest, @Query() query: GetCreativeOverviewQueryDto) {
    return this.overview.getOverview(req.user, query);
  }
}
