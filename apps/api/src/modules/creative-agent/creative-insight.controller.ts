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
 * Creative Insights — the creative's own steering view, so it rides
 * creative_agent.read like the Video Registry (the owner's call: for the
 * creatives, not the advertiser — the advertiser's read_all does not include
 * read, which is exactly what keeps this off their nav). Scoping to own work
 * happens in the service. The queue is free to recompute; diagnose and
 * variants each cost a model call, which is why they are POSTs a person
 * clicks rather than page-load fetches.
 */
@Controller('creative-agent/insights')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeInsightController {
  constructor(private readonly insights: CreativeInsightService) {}

  @Get()
  @Permissions('creative_agent.read')
  queue(@Request() req: CreativeRequest) {
    return this.insights.getQueue(req.user);
  }

  @Post('diagnose')
  @Permissions('creative_agent.read')
  diagnose(@Request() req: CreativeRequest) {
    return this.insights.diagnose(req.user);
  }

  @Post('variants')
  @Permissions('creative_agent.read')
  variants(@Request() req: CreativeRequest, @Body() dto: GenerateVariantsDto) {
    return this.insights.variants(req.user, dto.creativeId);
  }
}
