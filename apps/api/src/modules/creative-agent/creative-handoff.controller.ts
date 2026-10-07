import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { HandoffQueryDto, ListDraftBatchesQueryDto, PreflightMetaDraftDto, SendMetaDraftDto } from './dto/creative-meta-draft.dto';
import { CreativeHandoffService } from './services/creative-handoff.service';
import { CreativeMetaDraftService } from './services/creative-meta-draft.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

const QUEUE_READERS = ['creative_agent.review', 'creative_agent.performance.manage', 'creative_agent.read_all'] as const;

/**
 * The handoff queue and the sends made from it.
 *
 * Reading the queue is the reviewer's job; sending to Meta is a performance
 * decision and needs that permission. The ERP's automation ends at the paused
 * draft these routes create. Publishing happens in Ads Manager, by a person.
 */
@Controller('creative-agent/handoff')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeHandoffController {
  constructor(
    private readonly handoff: CreativeHandoffService,
    private readonly drafts: CreativeMetaDraftService,
  ) {}

  @Get()
  @Permissions(...QUEUE_READERS)
  list(@Request() req: CreativeRequest, @Query() query: HandoffQueryDto) {
    return this.handoff.list(req.user, query);
  }

  /** What Send would do, before it does it: names, budget, warnings, refusals. */
  @Post('preflight')
  @Permissions('creative_agent.review', 'creative_agent.performance.manage')
  preflight(@Request() req: CreativeRequest, @Body() body: PreflightMetaDraftDto) {
    return this.drafts.preflight(req.user, body);
  }

  @Post('send')
  @Permissions('creative_agent.performance.manage')
  send(@Request() req: CreativeRequest, @Body() body: SendMetaDraftDto) {
    return this.drafts.send(req.user, body);
  }

  @Get('batches')
  @Permissions(...QUEUE_READERS)
  batches(@Request() req: CreativeRequest, @Query() query: ListDraftBatchesQueryDto) {
    return this.drafts.listBatches(req.user, query);
  }

  @Get('batches/:id')
  @Permissions(...QUEUE_READERS)
  batch(@Request() req: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.drafts.getBatch(req.user, id);
  }

  @Post('batches/:id/retry')
  @Permissions('creative_agent.performance.manage')
  retry(@Request() req: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.drafts.retry(req.user, id);
  }
}
