import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreativeInsightService } from './services/creative-insight.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

class GenerateVariantsDto {
  @IsUUID()
  creativeId!: string;
}

/**
 * Ads Insight — the steering view, so everything here rides read_all. The
 * queue is free to recompute; diagnose and variants each cost a model call,
 * which is why they are POSTs a person clicks rather than page-load fetches.
 */
@Controller('creative-agent/insights')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeInsightController {
  constructor(private readonly insights: CreativeInsightService) {}

  @Get()
  @Permissions('creative_agent.read_all')
  queue(@Request() req: CreativeRequest) {
    return this.insights.getQueue(req.user);
  }

  @Post('diagnose')
  @Permissions('creative_agent.read_all')
  diagnose(@Request() req: CreativeRequest) {
    return this.insights.diagnose(req.user);
  }

  @Post('variants')
  @Permissions('creative_agent.read_all')
  variants(@Request() req: CreativeRequest, @Body() dto: GenerateVariantsDto) {
    return this.insights.variants(req.user, dto.creativeId);
  }
}
