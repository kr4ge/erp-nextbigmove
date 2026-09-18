import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { UpsertCreativeStoreTargetDto } from './dto/creative-store-target.dto';
import { CreativeStoreTargetService } from './services/creative-store-target.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

/**
 * Target KPIs per store: what a winning creative looks like for that store.
 *
 * Anyone who works with creatives can read them, since the analysis dialog
 * shows whether a store has decided its targets. Setting them is an
 * advertising judgement and needs performance management.
 */
@Controller('creative-agent/stores')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeStoreTargetController {
  constructor(private readonly targets: CreativeStoreTargetService) {}

  /** Every active store with its targets, keyed by both the creative config and the POS store. */
  @Get('targets')
  @Permissions('creative_agent.read', 'creative_agent.read_all', 'creative_agent.ai.use', 'creative_agent.ai.manage')
  list(@Request() req: CreativeRequest) {
    return this.targets.listForTenant(req.user);
  }

  @Get(':storeConfigId/targets')
  @Permissions('creative_agent.read', 'creative_agent.read_all', 'creative_agent.ai.use', 'creative_agent.ai.manage')
  get(@Request() req: CreativeRequest, @Param('storeConfigId', ParseUUIDPipe) storeConfigId: string) {
    return this.targets.get(req.user, storeConfigId);
  }

  @Put(':storeConfigId/targets')
  @Permissions('creative_agent.performance.manage')
  upsert(
    @Request() req: CreativeRequest,
    @Param('storeConfigId', ParseUUIDPipe) storeConfigId: string,
    @Body() body: UpsertCreativeStoreTargetDto,
  ) {
    return this.targets.upsert(req.user, storeConfigId, body);
  }
}
