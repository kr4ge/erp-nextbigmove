import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
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
type UploadedSourceFile = { path: string; originalname: string; mimetype: string; size: number };

/** Same staging directory and ceiling as an analysis upload; the file is moved to object storage right after. */
function sourceUploadRoot() {
  const root = process.env.CREATIVE_AI_UPLOAD_TMP_DIR || join(process.cwd(), 'tmp', 'creative-ai-uploads');
  mkdirSync(root, { recursive: true });
  return root;
}
function maxSourceBytes() {
  const configured = Number(process.env.CREATIVE_AI_MAX_VIDEO_MB || '250');
  const maxMb = Number.isFinite(configured) && configured > 0 ? configured : 250;
  return Math.floor(maxMb * 1024 * 1024);
}

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

  /**
   * The creative's own file, uploaded at enrollment or attached later. Held in
   * storage until the Meta draft is made; every analysis reads it first.
   */
  @Post('creatives/:id/source')
  @Permissions('creative_agent.edit', 'creative_agent.edit_all')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, done) => done(null, sourceUploadRoot()),
      filename: (_req, file, done) => done(null, `${randomUUID()}${extname(file.originalname || '').toLowerCase()}`),
    }),
    limits: { files: 1, fileSize: maxSourceBytes() },
  }))
  attachSource(
    @Request() req: CreativeRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedSourceFile | undefined,
  ) {
    return this.enrollment.attachSource(req.user, id, file);
  }

  @Delete('creatives/:id/thumbnail')
  @Permissions('creative_agent.edit', 'creative_agent.edit_all')
  removeThumbnail(@Request() req: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.enrollment.removeThumbnail(req.user, id);
  }
}
