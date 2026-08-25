import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateCreativeReviewCommentDto } from './dto/create-creative-review-comment.dto';
import { ListCreativeAssetsQueryDto } from './dto/list-creative-assets-query.dto';
import { CreativeAssetsService } from './services/creative-assets.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

@Controller('creative-agent')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeAssetsController {
  constructor(private readonly assets: CreativeAssetsService) {}

  @Get('assets')
  @Permissions('creative_agent.read', 'creative_agent.read_all', 'creative_agent.edit')
  list(@Request() req: CreativeRequest, @Query() query: ListCreativeAssetsQueryDto) {
    return this.assets.list(req.user, query);
  }

  @Get('creatives/:id/comments')
  @Permissions('creative_agent.read', 'creative_agent.read_all', 'creative_agent.edit', 'creative_agent.review')
  comments(@Request() req: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.assets.comments(req.user, id);
  }

  @Post('creatives/:id/comments')
  @Permissions('creative_agent.read', 'creative_agent.edit', 'creative_agent.review')
  addComment(
    @Request() req: CreativeRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCreativeReviewCommentDto,
  ) {
    return this.assets.addComment(req.user, id, body);
  }
}
