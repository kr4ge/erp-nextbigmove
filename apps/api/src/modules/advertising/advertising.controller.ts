import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TeamGuard } from '../../common/guards/team.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { WorkflowService } from '../workflows/workflow.service';
import { AdCreativeSyncService } from './ad-creative-sync.service';
import { AdEvaluatorService } from './ad-evaluator.service';
import { AdvertisingService } from './advertising.service';
import { AdvertisingPeriodDto } from './dto/advertising-period.dto';
import { SaveBenchmarkDto } from './dto/save-benchmark.dto';
import { CreateStrategyEntryDto, RecordStrategyResultDto } from './dto/strategy-entry.dto';
import { CreateLibraryEntryDto } from './dto/library-entry.dto';
import { ImportMetaReportDto } from './dto/import-meta-report.dto';

@Controller('advertising')
@UseGuards(JwtAuthGuard, TenantGuard, TeamGuard, PermissionsGuard)
export class AdvertisingController {
  constructor(
    private readonly advertising: AdvertisingService,
    private readonly evaluator: AdEvaluatorService,
    private readonly workflows: WorkflowService,
    private readonly creativeSync: AdCreativeSyncService,
  ) {}

  private static uploadRoot() {
    const root = process.env.MANUAL_META_UPLOAD_TMP_DIR
      || join(process.cwd(), 'tmp', 'manual-meta-uploads');
    mkdirSync(root, { recursive: true });
    return root;
  }

  /** Creatives are videos as often as stills, so they get their own ceiling. */
  private static maxCreativeBytes() {
    const maxMb = Number(process.env.AD_CREATIVE_MAX_FILE_MB || '200');
    if (!Number.isFinite(maxMb) || maxMb <= 0) return 200 * 1024 * 1024;
    return Math.floor(maxMb * 1024 * 1024);
  }

  private static maxUploadBytes() {
    const maxMb = Number(process.env.MANUAL_META_UPLOAD_MAX_FILE_MB || '10');
    if (!Number.isFinite(maxMb) || maxMb <= 0) return 10 * 1024 * 1024;
    return Math.floor(maxMb * 1024 * 1024);
  }

  /**
   * Upload a Meta Ads Manager export.
   *
   * This is a door, not a pipeline. It hands the file to the same queue the
   * workflows module uses, so the report still lands in MetaAdInsight and still
   * triggers reconciliation into ReconcileMarketing.
   *
   * That matters because this module is not the only thing reading that table —
   * marketing analytics, the marketing KPI scorecards, and sales attribution all
   * read it too. A second ingestion path that wrote somewhere else would leave
   * those three showing yesterday's world while this one showed today's.
   */
  @Post('import')
  @Permissions('advertising.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: AdvertisingController.uploadRoot(),
        filename: (_req, file, cb) => {
          const safeExt = extname(file.originalname || '').toLowerCase();
          const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          cb(null, `${token}${safeExt || '.dat'}`);
        },
      }),
      limits: { fileSize: AdvertisingController.maxUploadBytes() },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname || '').toLowerCase();
        if (!new Set(['.csv', '.xlsx', '.xls']).has(ext)) {
          cb(new BadRequestException('Unsupported file type. Use CSV, XLSX, or XLS.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async importReport(
    @Body() body: ImportMetaReportDto,
    @UploadedFile() file: any,
  ): Promise<{ jobId: string }> {
    if (!file?.path) {
      throw new BadRequestException('File is required');
    }

    const jobId = await this.workflows.enqueueManualMetaUploadFromFile({
      filePath: file.path,
      originalFileName: file.originalname || 'upload.csv',
      integrationId: body?.integrationId || undefined,
    });

    return { jobId };
  }

  /**
   * Progress of an upload. Reconciliation runs per day in the report, so a wide
   * date range takes a while — poll rather than assume.
   */
  @Get('import/:jobId')
  @Permissions('advertising.manage')
  async importStatus(@Param('jobId') jobId: string) {
    return this.workflows.getManualMetaUploadJobStatus(jobId);
  }

  /**
   * Every ad that spent or sold in the period, scored against the benchmark and
   * ranked by net contribution. Free to call — it only reads reconciled data.
   */
  @Get('position')
  @Permissions('advertising.read')
  async getPosition(@Query() query: AdvertisingPeriodDto) {
    return this.advertising.getPosition(query);
  }

  /** The benchmark every verdict is measured against. */
  @Get('benchmark')
  @Permissions('advertising.read')
  async getBenchmark() {
    return this.advertising.getBenchmarkSettings();
  }

  /**
   * Change what counts as failing.
   *
   * Behind `manage` rather than `read` — moving the floor changes every verdict
   * on every screen, so it belongs with whoever owns the numbers.
   */
  @Put('benchmark')
  @Permissions('advertising.manage')
  async saveBenchmark(@Body() dto: SaveBenchmarkDto) {
    return this.advertising.saveBenchmark(dto);
  }

  /** Connected Meta ad accounts, with what each has spent in the period. */
  @Get('accounts')
  @Permissions('advertising.read')
  async listAccounts(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.advertising.listAccounts({ startDate, endDate });
  }

  /** The swipe file — other people's ads, kept because they are worth learning from. */
  @Get('library')
  @Permissions('advertising.read')
  async listLibrary(
    @Query('q') q?: string,
    @Query('format') format?: any,
  ) {
    return this.advertising.listLibraryEntries({ q, format });
  }

  @Post('library')
  @Permissions('advertising.manage')
  async createLibraryEntry(@Body() dto: CreateLibraryEntryDto) {
    return this.advertising.createLibraryEntry(dto);
  }

  @Delete('library/:id')
  @Permissions('advertising.manage')
  async deleteLibraryEntry(@Param('id') id: string) {
    return this.advertising.deleteLibraryEntry(id);
  }

  /** The creatives that ran, with what each earned. */
  @Get('creatives')
  @Permissions('advertising.read')
  async listCreatives(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.advertising.listCreatives({ startDate, endDate });
  }

  /**
   * Ask Meta what the period's ads looked like.
   *
   * Read-only against Meta and additive here — it touches no spend data, so a
   * failed sync costs nothing but the creatives.
   */
  @Post('creatives/sync')
  @Permissions('advertising.manage')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async syncCreatives(@Query() query: AdvertisingPeriodDto) {
    return this.creativeSync.sync(query);
  }

  /** The strategy log — what was changed, and what came of it. */
  @Get('strategy')
  @Permissions('advertising.read')
  async listStrategy() {
    return this.advertising.listStrategyEntries();
  }

  @Post('strategy')
  @Permissions('advertising.manage')
  async createStrategy(@Body() dto: CreateStrategyEntryDto) {
    return this.advertising.createStrategyEntry(dto);
  }

  /** Record how a change actually turned out, once it has played out. */
  @Put('strategy/:id/result')
  @Permissions('advertising.manage')
  async recordStrategyResult(
    @Param('id') id: string,
    @Body() dto: RecordStrategyResultDto,
  ) {
    return this.advertising.recordStrategyResult(id, dto.result);
  }

  /**
   * The same position, handed to Claude for a verdict.
   *
   * Rate-limited well below the read endpoint because every call costs real
   * money — and because the answer changes with the data, not with how often
   * you ask for it.
   */
  @Post('evaluate')
  @Permissions('advertising.evaluate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async evaluate(@Query() query: AdvertisingPeriodDto) {
    const position = await this.advertising.getPosition(query);
    return this.evaluator.evaluate(position);
  }
}
