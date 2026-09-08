import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateStrategyEntryDto, UpdateStrategyResultDto } from './dto/creative-strategy.dto';
import { CreativeStrategyService } from './services/creative-strategy.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

/**
 * The Strategy Log. Both creative_agent.read and read_all get in — unlike
 * Creative Insights, a manager reading the roll-up is the point, and every
 * write is scoped to the author's own entries inside the service.
 */
@Controller('creative-agent/strategy')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeStrategyController {
  constructor(private readonly strategy: CreativeStrategyService) {}

  @Get()
  @Permissions('creative_agent.read', 'creative_agent.read_all')
  list(@Request() req: CreativeRequest) {
    return this.strategy.list(req.user);
  }

  @Post()
  @Permissions('creative_agent.read', 'creative_agent.read_all')
  create(@Request() req: CreativeRequest, @Body() dto: CreateStrategyEntryDto) {
    return this.strategy.create(req.user, dto);
  }

  @Patch(':id/result')
  @Permissions('creative_agent.read', 'creative_agent.read_all')
  recordResult(
    @Request() req: CreativeRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStrategyResultDto,
  ) {
    return this.strategy.recordResult(req.user, id, dto);
  }

  @Delete(':id')
  @Permissions('creative_agent.read', 'creative_agent.read_all')
  remove(@Request() req: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.strategy.remove(req.user, id);
  }
}
