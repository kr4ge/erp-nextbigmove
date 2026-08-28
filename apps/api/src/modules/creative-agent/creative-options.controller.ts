import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateCreativeOptionDto } from './dto/create-creative-option.dto';
import { CreativeOptionsService } from './services/creative-options.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

/** Tenant-wide hook types and formats for the enrollment and edit dialogs. */
@Controller('creative-agent')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeOptionsController {
  constructor(private readonly options: CreativeOptionsService) {}

  @Get('options')
  @Permissions('creative_agent.read', 'creative_agent.read_all', 'creative_agent.enroll', 'creative_agent.edit')
  list(@Request() req: CreativeRequest) {
    return this.options.list(req.user);
  }

  @Post('options')
  @Permissions('creative_agent.enroll')
  create(@Request() req: CreativeRequest, @Body() body: CreateCreativeOptionDto) {
    return this.options.create(req.user, body.field, body.label);
  }
}
