import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreativeAiEnabledGuard } from './guards/creative-ai-enabled.guard';
import {
  ListCreativeAiRunsQueryDto,
  StartCreativeAiRunDto,
  SubmitCreativeAiProviderCodeDto,
  UpdateCreativeAiPolicyDto,
} from './dto/creative-ai-run.dto';
import { CreativeAiRunService } from './services/creative-ai-run.service';
import { CreativeAiPolicyService } from './services/creative-ai-policy.service';
import type { CreativeActor } from './types/creative-actor.type';

type CreativeRequest = { user: CreativeActor };
type UploadedVideoFile = {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
};

@Controller('creative-agent/ai')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, CreativeAiEnabledGuard)
export class CreativeAiController {
  constructor(
    private readonly runs: CreativeAiRunService,
    private readonly policy: CreativeAiPolicyService,
  ) {}

  private static buildUploadRoot() {
    const root = process.env.CREATIVE_AI_UPLOAD_TMP_DIR
      || join(process.cwd(), 'tmp', 'creative-ai-uploads');
    mkdirSync(root, { recursive: true });
    return root;
  }

  private static maxUploadBytes() {
    const configured = Number(process.env.CREATIVE_AI_MAX_VIDEO_MB || '250');
    const maxMb = Number.isFinite(configured) && configured > 0 ? configured : 250;
    return Math.floor(maxMb * 1024 * 1024);
  }

  @Post('runs')
  @Permissions('creative_agent.ai.use')
  @UseInterceptors(FileInterceptor('video', {
    storage: diskStorage({
      destination: CreativeAiController.buildUploadRoot(),
      filename: (_req, file, callback) => {
        const extension = extname(file.originalname || '').toLowerCase();
        callback(null, `${Date.now()}-${randomUUID()}${extension || '.video'}`);
      },
    }),
    limits: { files: 1, fileSize: CreativeAiController.maxUploadBytes() },
    fileFilter: (_req, file, callback) => {
      const extension = extname(file.originalname || '').toLowerCase();
      const allowedExtensions = new Set(['.mp4', '.mov', '.m4v', '.webm']);
      const allowedMimeTypes = new Set([
        'video/mp4',
        'video/quicktime',
        'video/x-m4v',
        'video/webm',
        'application/octet-stream',
      ]);
      if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
        callback(new BadRequestException('Unsupported video. Use MP4, MOV, M4V, or WebM.'), false);
        return;
      }
      callback(null, true);
    },
  }))
  start(
    @Request() req: CreativeRequest,
    @UploadedFile() video: UploadedVideoFile,
    @Body() body: StartCreativeAiRunDto,
  ) {
    return this.runs.start(req.user, body, video);
  }

  @Get('runs')
  @Permissions('creative_agent.ai.use', 'creative_agent.ai.manage')
  list(@Request() req: CreativeRequest, @Query() query: ListCreativeAiRunsQueryDto) {
    return this.runs.list(req.user, query);
  }

  @Get('runs/:id')
  @Permissions('creative_agent.ai.use', 'creative_agent.ai.manage')
  get(@Request() req: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.runs.get(req.user, id);
  }

  @Get('config')
  @Permissions('creative_agent.ai.use', 'creative_agent.ai.manage')
  config(@Request() req: CreativeRequest) {
    return this.policy.get(req.user);
  }

  @Patch('config')
  @Permissions('creative_agent.ai.manage')
  updateConfig(@Request() req: CreativeRequest, @Body() body: UpdateCreativeAiPolicyDto) {
    return this.policy.update(req.user, body);
  }

  @Post('providers/:provider/test')
  @Permissions('creative_agent.ai.manage')
  testProvider(@Request() req: CreativeRequest, @Param('provider') provider: string) {
    return this.policy.test(req.user, provider);
  }

  @Post('providers/:provider/login')
  @Permissions('creative_agent.ai.manage')
  startProviderLogin(@Request() req: CreativeRequest, @Param('provider') provider: string) {
    return this.policy.startLogin(req.user, provider);
  }

  @Get('providers/:provider/login/:loginId')
  @Permissions('creative_agent.ai.manage')
  providerLoginStatus(
    @Request() req: CreativeRequest,
    @Param('provider') provider: string,
    @Param('loginId') loginId: string,
  ) {
    return this.policy.loginStatus(req.user, provider, loginId);
  }

  @Post('providers/:provider/login/:loginId/code')
  @Permissions('creative_agent.ai.manage')
  submitProviderLoginCode(
    @Request() req: CreativeRequest,
    @Param('provider') provider: string,
    @Param('loginId') loginId: string,
    @Body() body: SubmitCreativeAiProviderCodeDto,
  ) {
    return this.policy.submitLoginCode(req.user, provider, loginId, body.code);
  }

  @Post('providers/:provider/logout')
  @Permissions('creative_agent.ai.manage')
  logoutProvider(@Request() req: CreativeRequest, @Param('provider') provider: string) {
    return this.policy.logout(req.user, provider);
  }
}
