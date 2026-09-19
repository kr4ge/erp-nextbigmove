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
  UpdateCreativePromptDto,
} from './dto/creative-ai-run.dto';
import { CreativeAiRunService } from './services/creative-ai-run.service';
import { CreativeAiPolicyService } from './services/creative-ai-policy.service';
import { CreativePromptTemplateService, isPromptKind } from './services/creative-prompt-template.service';
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
    private readonly prompts: CreativePromptTemplateService,
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
      // Videos and static images are both analysable. The run service checks
      // the file against the creative's kind once the record is loaded.
      const allowedExtensions = new Set(['.mp4', '.mov', '.m4v', '.webm', '.jpg', '.jpeg', '.png', '.webp']);
      const allowedMimeTypes = new Set([
        'video/mp4',
        'video/quicktime',
        'video/x-m4v',
        'video/webm',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/octet-stream',
      ]);
      if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
        callback(new BadRequestException('Unsupported file. Use MP4, MOV, M4V, or WebM for video, or JPG, PNG, or WebP for a static creative.'), false);
        return;
      }
      callback(null, true);
    },
  }))
  start(
    @Request() req: CreativeRequest,
    @UploadedFile() video: UploadedVideoFile | undefined,
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

  @Get('runs/:id/frames')
  @Permissions('creative_agent.ai.use', 'creative_agent.ai.manage')
  frames(@Request() req: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.runs.frames(req.user, id);
  }

  @Post('runs/:id/cancel')
  @Permissions('creative_agent.ai.use', 'creative_agent.ai.manage')
  cancel(@Request() req: CreativeRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.runs.cancel(req.user, id);
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

  /**
   * The two analysis prompts. Reading them needs the same permission as the
   * settings page; changing them belongs to whoever manages creative
   * performance, since the wording decides what every analysis says.
   */
  @Get('config/prompts')
  @Permissions('creative_agent.ai.use', 'creative_agent.ai.manage')
  listPrompts(@Request() req: CreativeRequest) {
    return this.policy.prompts(req.user);
  }

  @Get('config/prompts/:kind/versions')
  @Permissions('creative_agent.ai.use', 'creative_agent.ai.manage')
  promptVersions(@Request() req: CreativeRequest, @Param('kind') kind: string) {
    return this.prompts.versions(req.user, this.promptKind(kind));
  }

  @Patch('config/prompts/:kind')
  @Permissions('creative_agent.performance.manage')
  updatePrompt(@Request() req: CreativeRequest, @Param('kind') kind: string, @Body() body: UpdateCreativePromptDto) {
    return this.prompts.update(req.user, this.promptKind(kind), body);
  }

  @Post('config/prompts/:kind/reset')
  @Permissions('creative_agent.performance.manage')
  resetPrompt(@Request() req: CreativeRequest, @Param('kind') kind: string) {
    return this.prompts.reset(req.user, this.promptKind(kind));
  }

  @Post('config/prompts/:kind/versions/:version/activate')
  @Permissions('creative_agent.performance.manage')
  activatePromptVersion(
    @Request() req: CreativeRequest,
    @Param('kind') kind: string,
    @Param('version') version: string,
  ) {
    const parsed = Number.parseInt(version, 10);
    if (!Number.isFinite(parsed) || parsed < 1) throw new BadRequestException('Version must be a positive number');
    return this.prompts.activate(req.user, this.promptKind(kind), parsed);
  }

  private promptKind(value: string) {
    const upper = value.toUpperCase();
    if (!isPromptKind(upper)) throw new BadRequestException('Prompt kind must be RUNNING_ANALYST or NEW_REVIEWER');
    return upper;
  }
}
