import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { EnrollCreativeDto, EnrollUnregisteredCreativeDto } from './dto/enroll-creative.dto';
import { UpdateCreativeDto } from './dto/update-creative.dto';
import { CreativeEnrollmentService } from './services/creative-enrollment.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };

@Controller('creative-agent')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreativeEnrollmentController {
  constructor(private readonly enrollment: CreativeEnrollmentService) {}

  @Post('creatives')
  @Permissions('creative_agent.enroll')
  enroll(@Request() req: CreativeRequest, @Body() body: EnrollCreativeDto) {
    return this.enrollment.enroll(req.user, body);
  }

  @Post('unregistered/enroll')
  @Permissions('creative_agent.enroll')
  enrollUnregistered(@Request() req: CreativeRequest, @Body() body: EnrollUnregisteredCreativeDto) {
    return this.enrollment.enrollUnregistered(req.user, body);
  }

  @Get('creatives/:id')
  @Permissions('creative_agent.read', 'creative_agent.read_all')
  get(@Request() req: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.enrollment.getById(req.user, id);
  }

  @Patch('creatives/:id')
  @Permissions('creative_agent.edit', 'creative_agent.edit_all')
  update(
    @Request() req: CreativeRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCreativeDto,
  ) {
    return this.enrollment.update(req.user, id, body);
  }
}
