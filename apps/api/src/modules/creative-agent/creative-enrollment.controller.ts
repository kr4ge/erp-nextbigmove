import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import type { UploadedImageFile } from '../../common/services/media-assets.service';
import { EnrollCreativeDto, EnrollUnregisteredCreativeDto } from './dto/enroll-creative.dto';
import { UpdateCreativeDto } from './dto/update-creative.dto';
import { CreativeEnrollmentService } from './services/creative-enrollment.service';
import type { CreativeActor } from './types/creative-actor.type';

const CREATIVE_THUMBNAIL_MAX_FILE_MB = Math.max(1, Number(process.env.OBJECT_STORAGE_CREATIVE_THUMBNAIL_MAX_FILE_MB || '8'));

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

  @Get('stores/:storeId/items')
  @Permissions('creative_agent.enroll')
  listStoreItems(@Request() req: CreativeRequest, @Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.enrollment.listStoreItems(req.user, storeId);
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

  @Post('creatives/:id/thumbnail')
  @Permissions('creative_agent.edit', 'creative_agent.edit_all')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: CREATIVE_THUMBNAIL_MAX_FILE_MB * 1024 * 1024 },
  }))
  uploadThumbnail(
    @Request() req: CreativeRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedImageFile,
  ) {
    return this.enrollment.uploadThumbnail(req.user, id, file);
  }

  @Delete('creatives/:id/thumbnail')
  @Permissions('creative_agent.edit', 'creative_agent.edit_all')
  removeThumbnail(@Request() req: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.enrollment.removeThumbnail(req.user, id);
  }
}
