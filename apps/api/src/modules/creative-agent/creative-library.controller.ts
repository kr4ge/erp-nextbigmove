import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ListCreativeLibraryQueryDto } from './dto/list-creative-library-query.dto';
import { CreativeLibraryService } from './services/creative-library.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

@Controller('creative-agent')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeLibraryController {
  constructor(private readonly library: CreativeLibraryService) {}

  @Get('library')
  @Permissions('creative_agent.read', 'creative_agent.read_all')
  list(@Request() req: CreativeRequest, @Query() query: ListCreativeLibraryQueryDto) {
    return this.library.list(req.user, query);
  }

  @Get('unregistered')
  @Permissions('creative_agent.read_all', 'creative_agent.alias.manage')
  listUnregistered(@Request() req: CreativeRequest, @Query() query: ListCreativeLibraryQueryDto) {
    return this.library.listUnregistered(req.user, query);
  }
}
