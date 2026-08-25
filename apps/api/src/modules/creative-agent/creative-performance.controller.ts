import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ListAdvertisingPerformanceQueryDto } from './dto/list-advertising-performance-query.dto';
import { CreativePerformanceService } from './services/creative-performance.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

@Controller('creative-agent')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativePerformanceController {
  constructor(private readonly performance: CreativePerformanceService) {}

  @Get('performance')
  @Permissions('creative_agent.read_all')
  list(@Request() req: CreativeRequest, @Query() query: ListAdvertisingPerformanceQueryDto) {
    return this.performance.list(req.user, query);
  }
}
