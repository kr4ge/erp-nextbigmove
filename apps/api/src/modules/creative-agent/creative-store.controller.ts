import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreativeStoreService } from './services/creative-store.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

@Controller('creative-agent')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeStoreController {
  constructor(private readonly stores: CreativeStoreService) {}

  @Get('stores')
  @Permissions('creative_agent.read', 'creative_agent.read_all', 'creative_agent.enroll', 'creative_agent.stores.manage')
  list(@Request() req: CreativeRequest) {
    return this.stores.list(req.user);
  }
}
