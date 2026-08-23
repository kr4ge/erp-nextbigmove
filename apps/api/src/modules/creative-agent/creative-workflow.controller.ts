import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TransitionCreativeStatusDto } from './dto/transition-creative-status.dto';
import { CreativeWorkflowService } from './services/creative-workflow.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

@Controller('creative-agent')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeWorkflowController {
  constructor(private readonly workflow: CreativeWorkflowService) {}

  @Post('creatives/:id/status-transitions')
  @Permissions('creative_agent.edit', 'creative_agent.edit_all', 'creative_agent.review', 'creative_agent.performance.manage')
  transition(
    @Request() req: CreativeRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionCreativeStatusDto,
  ) {
    return this.workflow.transition(req.user, id, body);
  }

  @Get('creatives/:id/events')
  @Permissions('creative_agent.read', 'creative_agent.read_all')
  events(@Request() req: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.workflow.listEvents(req.user, id);
  }
}
