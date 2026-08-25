import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateCreativeAliasDto, LinkUnregisteredCreativeDto, UnlinkMetaAdDto } from './dto/creative-alias.dto';
import { CreativeAliasService } from './services/creative-alias.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

@Controller('creative-agent')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeAliasController {
  constructor(private readonly aliases: CreativeAliasService) {}

  @Post('unregistered/link')
  @Permissions('creative_agent.alias.manage')
  link(@Request() req: CreativeRequest, @Body() body: LinkUnregisteredCreativeDto) {
    return this.aliases.linkUnregistered(req.user, body);
  }

  @Post('meta-links/unlink')
  @HttpCode(200)
  @Permissions('creative_agent.alias.manage')
  unlink(@Request() req: CreativeRequest, @Body() body: UnlinkMetaAdDto) {
    return this.aliases.unlinkMetaAd(req.user, body.accountId, body.adId);
  }

  @Post('creatives/:id/aliases')
  @Permissions('creative_agent.alias.manage')
  create(
    @Request() req: CreativeRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCreativeAliasDto,
  ) {
    return this.aliases.create(req.user, id, body);
  }

  @Delete('creatives/:creativeId/aliases/:aliasId')
  @Permissions('creative_agent.alias.manage')
  remove(
    @Request() req: CreativeRequest,
    @Param('creativeId', ParseUUIDPipe) creativeId: string,
    @Param('aliasId', ParseUUIDPipe) aliasId: string,
  ) {
    return this.aliases.remove(req.user, creativeId, aliasId);
  }
}
