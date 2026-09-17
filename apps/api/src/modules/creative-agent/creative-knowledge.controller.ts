import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreativeAiEnabledGuard } from './guards/creative-ai-enabled.guard';
import {
  DecideEnrollmentReviewDto,
  ListEnrollmentReviewsQueryDto,
  ListKnowledgeEntriesQueryDto,
  PromoteKnowledgeEntryDto,
  RequestEnrollmentReviewDto,
} from './dto/creative-knowledge.dto';
import { CreativeKnowledgeService } from './services/creative-knowledge.service';
import { CreativeEnrollmentReviewService } from './services/creative-enrollment-review.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

/**
 * The knowledge base and the enrollment gate.
 *
 * Reading is open to anyone who can read creatives, because the library is
 * meant to be studied. Promoting and retiring entries is an advertiser decision
 * and needs ai.manage, since what goes in the corpus determines what the gate
 * concludes.
 */
@Controller('creative-agent/knowledge')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CreativeAiEnabledGuard)
export class CreativeKnowledgeController {
  constructor(
    private readonly knowledge: CreativeKnowledgeService,
    private readonly reviews: CreativeEnrollmentReviewService,
  ) {}

  /** Browse a store's knowledge base. */
  @Get('entries')
  @Permissions('creative_agent.read')
  list(@Request() request: CreativeRequest, @Query() query: ListKnowledgeEntriesQueryDto) {
    return this.knowledge.list(request.user, query);
  }

  /** One entry with its full structural record. */
  @Get('entries/:id')
  @Permissions('creative_agent.read')
  detail(@Request() request: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.knowledge.detail(request.user, id);
  }

  /** How ready each store's corpus is to inform the gate. */
  @Get('coverage')
  @Permissions('creative_agent.read')
  coverage(@Request() request: CreativeRequest, @Query('storeId') storeId?: string) {
    return this.knowledge.coverage(request.user, storeId);
  }

  /** Add an analyzed creative to its store's knowledge base. */
  @Post('entries/:creativeId')
  @Permissions('creative_agent.ai.manage')
  promote(
    @Request() request: CreativeRequest,
    @Param('creativeId', ParseUUIDPipe) creativeId: string,
    @Body() body: PromoteKnowledgeEntryDto,
  ) {
    return this.knowledge.promote(request.user, creativeId, body);
  }

  /** Stop an entry informing the gate, without deleting its history. */
  @Post('entries/:id/retire')
  @Permissions('creative_agent.ai.manage')
  retire(@Request() request: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.knowledge.retire(request.user, id);
  }

  @Post('entries/:id/restore')
  @Permissions('creative_agent.ai.manage')
  restore(@Request() request: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.knowledge.restore(request.user, id);
  }

  /** Ask the gate to judge an enrolled creative against its store's corpus. */
  @Post('reviews')
  @Permissions('creative_agent.ai.use')
  requestReview(@Request() request: CreativeRequest, @Body() body: RequestEnrollmentReviewDto) {
    return this.reviews.request(request.user, body.creativeId, {
      runId: body.runId,
      shadow: body.shadow,
    });
  }

  @Get('reviews')
  @Permissions('creative_agent.read')
  listReviews(@Request() request: CreativeRequest, @Query() query: ListEnrollmentReviewsQueryDto) {
    return this.reviews.list(request.user, query);
  }

  /**
   * Record a person's ruling on a recommendation. This is what shadow mode
   * measures, and what the publish guard requires.
   */
  @Post('reviews/:id/decide')
  @Permissions('creative_agent.review')
  decide(
    @Request() request: CreativeRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DecideEnrollmentReviewDto,
  ) {
    return this.reviews.decide(request.user, id, body);
  }

  /** How often the gate and the team agree. Decides when shadow mode can end. */
  @Get('reviews/calibration')
  @Permissions('creative_agent.read')
  calibration(@Request() request: CreativeRequest, @Query('storeId') storeId?: string) {
    return this.reviews.calibration(request.user, storeId);
  }
}
