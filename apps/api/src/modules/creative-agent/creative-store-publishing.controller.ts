import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { UpsertCreativeStorePublishingDto } from './dto/creative-store-publishing.dto';
import { CreativeStorePublishingService } from './services/creative-store-publishing.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

const READERS = [
  'creative_agent.read', 'creative_agent.read_all', 'creative_agent.review',
  'creative_agent.performance.manage', 'creative_agent.stores.manage',
] as const;

/**
 * Where a store launches: ad account, page, Instagram, budget, and the pixel
 * and landing page per product. Read by anyone who works with creatives so the
 * send dialog can say what is missing; changed by whoever manages the store
 * or its performance.
 */
@Controller('creative-agent/stores')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeStorePublishingController {
  constructor(private readonly publishing: CreativeStorePublishingService) {}

  @Get(':storeConfigId/publishing')
  @Permissions(...READERS)
  get(@Request() req: CreativeRequest, @Param('storeConfigId', ParseUUIDPipe) storeConfigId: string) {
    return this.publishing.get(req.user, storeConfigId);
  }

  @Put(':storeConfigId/publishing')
  @Permissions('creative_agent.performance.manage', 'creative_agent.stores.manage')
  upsert(
    @Request() req: CreativeRequest,
    @Param('storeConfigId', ParseUUIDPipe) storeConfigId: string,
    @Body() body: UpsertCreativeStorePublishingDto,
  ) {
    return this.publishing.upsert(req.user, storeConfigId, body);
  }

  /** Pages and pixels the tenant's Meta token can see, so nobody copies ids by hand. */
  @Get(':storeConfigId/publishing/meta-options')
  @Permissions(...READERS)
  metaOptions(
    @Request() req: CreativeRequest,
    @Param('storeConfigId', ParseUUIDPipe) storeConfigId: string,
    @Query('adAccountId') adAccountId?: string,
  ) {
    return this.publishing.metaOptions(req.user, storeConfigId, adAccountId?.trim() || null);
  }
}
