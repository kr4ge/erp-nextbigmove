import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import {
  CreateWorkflowDto,
  ManualMetaUploadDto,
  ManualMetaUploadRowDto,
  UpdateWorkflowDto,
  WorkflowResponseDto,
  WorkflowExecutionResponseDto,
} from './dto';
import { WorkflowTriggerType, WorkflowExecutionStatus } from '@prisma/client';
import * as cronParser from 'cron-parser';
import {
  MANUAL_META_UPLOAD_JOB,
  MANUAL_META_UPLOAD_QUEUE,
  type ManualMetaUploadJobData,
  WORKFLOW_QUEUE,
  type WorkflowJobData,
} from './workflow.constants';
import { DateRangeService } from './services/date-range.service';
import { WorkflowProcessorService } from './services/workflow-processor.service';
import { WorkflowSchedulerService } from './services/workflow-scheduler.service';
import { WorkflowLogService } from './services/workflow-log.service';
import { WorkflowProgressCacheService } from './services/workflow-progress-cache.service';
import { MetaInsightService } from '../integrations/services/meta-insight.service';
import { ReconcileMarketingService } from './services/reconcile-marketing.service';
import { ReconcileSalesService } from './services/reconcile-sales.service';
import { createReadStream } from 'fs';
import { promises as fsp } from 'fs';
import { extname } from 'path';
import * as readline from 'readline';

type ManualMetaUploadStage =
  | 'QUEUED'
  | 'PARSING'
  | 'IMPORTING'
  | 'RECONCILING'
  | 'COMPLETED'
  | 'FAILED';

type ColumnKey =
  | 'accountId'
  | 'campaignId'
  | 'campaignName'
  | 'adsetId'
  | 'adsetName'
  | 'adId'
  | 'adName'
  | 'dateCreated'
  | 'amountSpent'
  | 'linkClicks'
  | 'clicks'
  | 'impressions'
  | 'websitePurchases'
  | 'reportingStarts'
  | 'reportingEnds';

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  accountId: ['accountid'],
  campaignId: ['campaignid'],
  campaignName: ['campaignname'],
  adsetId: ['adsetid'],
  adsetName: ['adsetname'],
  adId: ['adid'],
  adName: ['adname'],
  dateCreated: ['datecreated'],
  amountSpent: ['amountspent', 'amountspentphp'],
  linkClicks: ['linkclicks'],
  clicks: ['clicksall', 'clicks'],
  impressions: ['impressions'],
  websitePurchases: ['websitepurchases'],
  reportingStarts: ['reportingstarts'],
  reportingEnds: ['reportingends'],
};

const REQUIRED_COLUMNS: ColumnKey[] = [
  'accountId',
  'campaignId',
  'campaignName',
  'adsetId',
  'adId',
  'adName',
  'amountSpent',
  'linkClicks',
  'clicks',
  'impressions',
  'websitePurchases',
  'reportingStarts',
  'reportingEnds',
];

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly teamContext: TeamContextService,
    private readonly dateRangeService: DateRangeService,
    private readonly workflowProcessor: WorkflowProcessorService,
    private readonly schedulerService: WorkflowSchedulerService,
    private readonly workflowLogService: WorkflowLogService,
    private readonly workflowProgressCache: WorkflowProgressCacheService,
    private readonly metaInsightService: MetaInsightService,
    private readonly reconcileMarketingService: ReconcileMarketingService,
    private readonly reconcileSalesService: ReconcileSalesService,
    @InjectQueue(WORKFLOW_QUEUE) private readonly workflowQueue: Queue<WorkflowJobData>,
    @InjectQueue(MANUAL_META_UPLOAD_QUEUE)
    private readonly manualMetaUploadQueue: Queue<ManualMetaUploadJobData>,
  ) {}

  private async buildAccessWhere(id?: string) {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    if (!isAdmin && allowedTeams.length === 0) {
      return { tenantId, where: null, allowedTeams, isAdmin };
    }

    const base: any = { tenantId };
    if (id) base.id = id;

    const restrictAdminToScope = isAdmin && allowedTeams.length > 0;

    if (isAdmin && !restrictAdminToScope) {
      return { tenantId, where: base, allowedTeams, isAdmin };
    }

    return {
      tenantId,
      allowedTeams,
      isAdmin,
      where: {
        ...base,
        OR: [
          { teamId: { in: allowedTeams } },
          { sharedTeams: { some: { teamId: { in: allowedTeams } } } },
        ],
      },
    };
  }

  private computeNextRunAt(schedule?: string | null): Date | null {
    if (!schedule) return null;
    try {
      const interval = cronParser.parseExpression(schedule);
      return interval.next().toDate();
    } catch {
      return null;
    }
  }

  private normalizeAccountId(value: string): string {
    return String(value || '').trim().replace(/^act_/i, '');
  }

  private isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private assertWholeNumber(value: number, label: string, rowNumber: number): number {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw new BadRequestException(`Row ${rowNumber}: ${label} must be a non-negative whole number`);
    }
    return value;
  }

  private buildMetaUploadIntegrationWhere(
    tenantId: string,
    allowedTeams: string[],
    isAdmin: boolean,
    integrationId: string,
  ) {
    const base: any = {
      id: integrationId,
      tenantId,
      provider: 'META_ADS',
    };

    const restrictAdminToScope = isAdmin && allowedTeams.length > 0;
    if (isAdmin && !restrictAdminToScope) {
      return base;
    }

    if (!isAdmin && allowedTeams.length === 0) {
      return null;
    }

    return {
      ...base,
      OR: [
        { teamId: { in: allowedTeams } },
        { sharedTeams: { some: { teamId: { in: allowedTeams } } } },
      ],
    };
  }

  private buildMetaUploadAccountWhere(
    tenantId: string,
    allowedTeams: string[],
    isAdmin: boolean,
    integrationId?: string,
  ) {
    const base: any = {
      tenantId,
      ...(integrationId ? { integrationId } : {}),
    };

    const restrictAdminToScope = isAdmin && allowedTeams.length > 0;
    if (isAdmin && !restrictAdminToScope) {
      return base;
    }

    if (!isAdmin && allowedTeams.length === 0) {
      return null;
    }

    return {
      ...base,
      OR: [
        { teamId: { in: allowedTeams } },
        { integration: { sharedTeams: { some: { teamId: { in: allowedTeams } } } } },
      ],
    };
  }

  private toUploadedRawInsight(row: ManualMetaUploadRowDto) {
    const websitePurchases = Number(row.websitePurchases || 0);

    return {
      campaign_id: row.campaignId.trim(),
      campaign_name: row.campaignName.trim(),
      adset_id: row.adsetId.trim(),
      ad_id: row.adId.trim(),
      ad_name: row.adName.trim(),
      date_start: row.reportingStarts.trim(),
      spend: String(row.amountSpent),
      inline_link_clicks: String(row.linkClicks),
      clicks: String(row.clicks),
      impressions: String(row.impressions),
      created_time: row.dateCreated?.trim() || null,
      actions: [
        {
          action_type: 'landing_page_view',
          value: String(websitePurchases),
        },
      ],
    };
  }

  private normalizeHeader(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private toCellString(value: unknown): string {
    return String(value ?? '').trim();
  }

  private parseDecimal(value: unknown, label: string, rowNumber: number): number {
    const normalized = this.toCellString(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(`Row ${rowNumber}: ${label} must be a non-negative number`);
    }
    return parsed;
  }

  private parseWholeNumber(value: unknown, label: string, rowNumber: number): number {
    const raw = this.toCellString(value);
    if (raw === '') {
      return 0;
    }

    const normalized = raw.replace(/,/g, '').replace(/[^\d.-]/g, '');
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      throw new BadRequestException(`Row ${rowNumber}: ${label} must be a non-negative whole number`);
    }
    return parsed;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  private normalizeDate(value: unknown, label: string, rowNumber: number, required = true): string {
    const text = this.toCellString(value);
    if (!text) {
      if (required) {
        throw new BadRequestException(`Row ${rowNumber}: ${label} is required`);
      }
      return '';
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }

    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, month, day, year] = slashMatch;
      return `${year}-${this.pad(Number(month))}-${this.pad(Number(day))}`;
    }

    const slashShortYearMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (slashShortYearMatch) {
      const [, month, day, shortYear] = slashShortYearMatch;
      const year = 2000 + Number(shortYear);
      return `${year}-${this.pad(Number(month))}-${this.pad(Number(day))}`;
    }

    const dashMatch = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dashMatch) {
      const [, month, day, year] = dashMatch;
      return `${year}-${this.pad(Number(month))}-${this.pad(Number(day))}`;
    }

    const dashShortYearMatch = text.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
    if (dashShortYearMatch) {
      const [, month, day, shortYear] = dashShortYearMatch;
      const year = 2000 + Number(shortYear);
      return `${year}-${this.pad(Number(month))}-${this.pad(Number(day))}`;
    }

    throw new BadRequestException(`Row ${rowNumber}: ${label} must be a valid date`);
  }

  private resolveColumnIndexes(headerRow: unknown[]): Record<ColumnKey, number> {
    const normalizedHeaders = headerRow.map((value) => this.normalizeHeader(value));
    const indexes = {} as Record<ColumnKey, number>;

    (Object.keys(HEADER_ALIASES) as ColumnKey[]).forEach((key) => {
      indexes[key] = normalizedHeaders.findIndex((header) =>
        HEADER_ALIASES[key].includes(header),
      );
    });

    const missing = REQUIRED_COLUMNS.filter((key) => indexes[key] < 0);
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required header(s): ${missing.join(', ')}`);
    }

    return indexes;
  }

  private getCell(row: unknown[], index: number): unknown {
    if (index < 0) return '';
    return row[index] ?? '';
  }

  private isEmptyRow(row: unknown[]): boolean {
    return row.every((cell) => this.toCellString(cell) === '');
  }

  private isSummaryRow(row: unknown[], indexes: Record<ColumnKey, number>): boolean {
    const accountId = this.toCellString(this.getCell(row, indexes.accountId)).toLowerCase();
    const campaignId = this.toCellString(this.getCell(row, indexes.campaignId));
    const adsetId = this.toCellString(this.getCell(row, indexes.adsetId));
    const adId = this.toCellString(this.getCell(row, indexes.adId));
    const adName = this.toCellString(this.getCell(row, indexes.adName));

    return (
      accountId === 'multiple'
      && campaignId === ''
      && adsetId === ''
      && adId === ''
      && adName === ''
    );
  }

  private hasRequiredIdentityValues(
    row: unknown[],
    indexes: Record<ColumnKey, number>,
  ): boolean {
    return [
      indexes.accountId,
      indexes.campaignId,
      indexes.campaignName,
      indexes.adsetId,
      indexes.adId,
      indexes.adName,
    ].every((index) => this.toCellString(this.getCell(row, index)) !== '');
  }

  private parseUploadRow(
    row: unknown[],
    rowNumber: number,
    indexes: Record<ColumnKey, number>,
  ): ManualMetaUploadRowDto | null {
    if (this.isEmptyRow(row)) return null;
    if (this.isSummaryRow(row, indexes)) return null;
    if (!this.hasRequiredIdentityValues(row, indexes)) return null;

    const reportingStarts = this.normalizeDate(
      this.getCell(row, indexes.reportingStarts),
      'Reporting starts',
      rowNumber,
    );
    const reportingEnds = this.normalizeDate(
      this.getCell(row, indexes.reportingEnds),
      'Reporting ends',
      rowNumber,
    );

    return {
      accountId: this.toCellString(this.getCell(row, indexes.accountId)),
      campaignId: this.toCellString(this.getCell(row, indexes.campaignId)),
      campaignName: this.toCellString(this.getCell(row, indexes.campaignName)),
      adsetId: this.toCellString(this.getCell(row, indexes.adsetId)),
      adsetName: this.toCellString(this.getCell(row, indexes.adsetName)) || undefined,
      adId: this.toCellString(this.getCell(row, indexes.adId)),
      adName: this.toCellString(this.getCell(row, indexes.adName)),
      dateCreated: this.normalizeDate(
        this.getCell(row, indexes.dateCreated),
        'Date created',
        rowNumber,
        false,
      ) || undefined,
      amountSpent: this.parseDecimal(this.getCell(row, indexes.amountSpent), 'Amount spent', rowNumber),
      linkClicks: this.parseWholeNumber(this.getCell(row, indexes.linkClicks), 'Link clicks', rowNumber),
      clicks: this.parseWholeNumber(this.getCell(row, indexes.clicks), 'Clicks (all)', rowNumber),
      impressions: this.parseWholeNumber(this.getCell(row, indexes.impressions), 'Impressions', rowNumber),
      websitePurchases: this.parseWholeNumber(
        this.getCell(row, indexes.websitePurchases),
        'Website purchases',
        rowNumber,
      ),
      reportingStarts,
      reportingEnds,
    };
  }

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];

      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === ',' && !inQuotes) {
        out.push(current);
        current = '';
        continue;
      }

      current += ch;
    }

    out.push(current);
    return out;
  }

  private async updateManualUploadJobProgress(
    job: Job<ManualMetaUploadJobData>,
    progress: {
      stage: ManualMetaUploadStage;
      message: string;
      processedRows?: number;
      totalRows?: number | null;
      insightsUpserted?: number;
      datesProcessed?: string[];
      failedReason?: string | null;
    },
  ) {
    const processedRows = progress.processedRows ?? 0;
    const totalRows = progress.totalRows ?? null;
    const insightsUpserted = progress.insightsUpserted ?? 0;
    const datesProcessed = progress.datesProcessed ?? [];
    const percent = totalRows && totalRows > 0
      ? Math.min(100, Math.round((processedRows / totalRows) * 100))
      : null;

    await job.progress({
      stage: progress.stage,
      message: progress.message,
      processedRows,
      totalRows,
      insightsUpserted,
      datesProcessed,
      percent,
      failedReason: progress.failedReason ?? null,
    });
  }

  async enqueueManualMetaUploadFromFile(input: {
    filePath: string;
    originalFileName: string;
    integrationId?: string;
  }): Promise<string> {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    const job = await this.manualMetaUploadQueue.add(
      MANUAL_META_UPLOAD_JOB,
      {
        tenantId,
        integrationId: input.integrationId,
        allowedTeams,
        isAdmin,
        filePath: input.filePath,
        originalFileName: input.originalFileName,
      },
      {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    await this.updateManualUploadJobProgress(job as unknown as Job<ManualMetaUploadJobData>, {
      stage: 'QUEUED',
      message: 'Upload queued',
      processedRows: 0,
      totalRows: null,
      insightsUpserted: 0,
      datesProcessed: [],
    });

    return String(job.id);
  }

  async getManualMetaUploadJobStatus(jobId: string) {
    const job = await this.manualMetaUploadQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Upload job not found');
    }

    const state = await job.getState();
    const progress = await job.progress();

    return {
      jobId: String(job.id),
      state,
      progress: (typeof progress === 'object' && progress) ? progress : {
        stage: state === 'completed' ? 'COMPLETED' : 'QUEUED',
        message: state,
        processedRows: 0,
        totalRows: null,
        insightsUpserted: 0,
        datesProcessed: [],
        percent: null,
      },
      failedReason: job.failedReason || null,
      result: job.returnvalue || null,
      createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    };
  }

  private async processManualMetaChunk(params: {
    tenantId: string;
    selectedIntegrationTeamId: string | null;
    accountMap: Map<string, { accountId: string; teamId: string | null; integrationId: string }>;
    rows: ManualMetaUploadRowDto[];
    affectedDates: Set<string>;
  }): Promise<number> {
    const groupedInsights = new Map<string, { teamId: string | null; rawInsights: any[] }>();

    for (const row of params.rows) {
      const accountId = this.normalizeAccountId(row.accountId);
      const account = params.accountMap.get(accountId);
      const teamId = account?.teamId ?? params.selectedIntegrationTeamId ?? null;
      const existingGroup = groupedInsights.get(accountId);
      if (existingGroup) {
        existingGroup.rawInsights.push(this.toUploadedRawInsight(row));
      } else {
        groupedInsights.set(accountId, {
          teamId,
          rawInsights: [this.toUploadedRawInsight(row)],
        });
      }
      params.affectedDates.add(row.reportingStarts);
    }

    let upserted = 0;
    for (const [accountId, group] of groupedInsights.entries()) {
      upserted += await this.metaInsightService.upsertMetaInsights(
        params.tenantId,
        accountId,
        group.rawInsights,
        group.teamId,
        1,
      );
    }

    return upserted;
  }

  private async resolveManualUploadAccounts(params: {
    tenantId: string;
    allowedTeams: string[];
    isAdmin: boolean;
    integrationId?: string;
  }): Promise<{
    selectedIntegrationTeamId: string | null;
    accountMap: Map<string, { accountId: string; teamId: string | null; integrationId: string }>;
  }> {
    let selectedIntegration: { id: string; teamId: string | null } | null = null;

    if (params.integrationId) {
      const integrationWhere = this.buildMetaUploadIntegrationWhere(
        params.tenantId,
        params.allowedTeams,
        params.isAdmin,
        params.integrationId,
      );

      if (!integrationWhere) {
        throw new NotFoundException('Meta integration not found');
      }

      selectedIntegration = await this.prisma.integration.findFirst({
        where: integrationWhere,
        select: {
          id: true,
          teamId: true,
        },
      });

      if (!selectedIntegration) {
        throw new NotFoundException('Meta integration not found');
      }
    }

    const accountWhere = this.buildMetaUploadAccountWhere(
      params.tenantId,
      params.allowedTeams,
      params.isAdmin,
      selectedIntegration?.id,
    );

    if (!accountWhere) {
      throw new BadRequestException('No accessible Meta ad accounts found for this upload');
    }

    const accounts = await this.prisma.metaAdAccount.findMany({
      where: accountWhere,
      select: {
        accountId: true,
        teamId: true,
        integrationId: true,
      },
    });

    const accountMap = new Map(
      accounts.map((account) => [
        this.normalizeAccountId(account.accountId),
        account,
      ]),
    );

    return {
      selectedIntegrationTeamId: selectedIntegration?.teamId ?? null,
      accountMap,
    };
  }

  async processManualMetaUploadJob(
    job: Job<ManualMetaUploadJobData>,
  ): Promise<{
    rowsReceived: number;
    insightsUpserted: number;
    datesProcessed: string[];
    reconcileMarketingCompleted: boolean;
    reconcileSalesCompleted: boolean;
  }> {
    const chunkSize = Math.max(1, Number(process.env.MANUAL_META_UPLOAD_BATCH_SIZE || '500'));
    let rowsReceived = 0;
    let insightsUpserted = 0;
    const affectedDates = new Set<string>();

    await this.updateManualUploadJobProgress(job, {
      stage: 'PARSING',
      message: 'Preparing upload context',
      processedRows: 0,
      totalRows: null,
      insightsUpserted: 0,
      datesProcessed: [],
    });

    const { selectedIntegrationTeamId, accountMap } = await this.resolveManualUploadAccounts({
      tenantId: job.data.tenantId,
      allowedTeams: job.data.allowedTeams,
      isAdmin: job.data.isAdmin,
      integrationId: job.data.integrationId,
    });

    const fileExt = extname(job.data.originalFileName || job.data.filePath).toLowerCase();

    const processChunk = async (
      chunk: ManualMetaUploadRowDto[],
      totalRows: number | null,
      message: string,
    ) => {
      if (chunk.length === 0) return;
      await this.updateManualUploadJobProgress(job, {
        stage: 'IMPORTING',
        message,
        processedRows: rowsReceived,
        totalRows,
        insightsUpserted,
        datesProcessed: Array.from(affectedDates).sort((a, b) => a.localeCompare(b)),
      });

      insightsUpserted += await this.processManualMetaChunk({
        tenantId: job.data.tenantId,
        selectedIntegrationTeamId,
        accountMap,
        rows: chunk,
        affectedDates,
      });
    };

    try {
      if (fileExt === '.csv') {
        const stream = createReadStream(job.data.filePath, { encoding: 'utf8' });
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

        let headerParsed = false;
        let indexes: Record<ColumnKey, number> | null = null;
        let lineNumber = 0;
        const buffer: ManualMetaUploadRowDto[] = [];

        for await (const line of rl) {
          lineNumber += 1;
          const row = this.parseCsvLine(line);

          if (!headerParsed) {
            indexes = this.resolveColumnIndexes(row);
            headerParsed = true;
            continue;
          }

          if (!indexes) continue;
          const parsedRow = this.parseUploadRow(row, lineNumber, indexes);
          if (!parsedRow) {
            continue;
          }

          rowsReceived += 1;
          buffer.push(parsedRow);

          if (buffer.length >= chunkSize) {
            const chunk = buffer.splice(0, buffer.length);
            await processChunk(chunk, null, 'Importing CSV rows');
          }
        }

        if (!headerParsed) {
          throw new BadRequestException('The selected file does not contain any header row');
        }

        if (buffer.length > 0) {
          const chunk = buffer.splice(0, buffer.length);
          await processChunk(chunk, null, 'Importing CSV rows');
        }
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        const XLSX = await import('xlsx');
        const xlsx = (XLSX as any).default || XLSX;
        const workbook = xlsx.readFile(job.data.filePath);
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new BadRequestException('The selected file does not contain any sheets');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const sheetRef = worksheet?.['!ref'];
        if (!sheetRef) {
          throw new BadRequestException('The selected sheet does not contain any rows');
        }

        const range = xlsx.utils.decode_range(sheetRef);
        const headerRowIdx = range.s.r;
        const totalDataRows = Math.max(0, range.e.r - headerRowIdx);

        const headerEncodedRange = xlsx.utils.encode_range({
          s: { r: headerRowIdx, c: range.s.c },
          e: { r: headerRowIdx, c: range.e.c },
        });
        const headerRows = xlsx.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: '',
          range: headerEncodedRange,
        }) as unknown[][];

        const indexes = this.resolveColumnIndexes(headerRows?.[0] || []);
        const dataStart = headerRowIdx + 1;
        const buffer: ManualMetaUploadRowDto[] = [];

        for (let start = dataStart; start <= range.e.r; start += chunkSize) {
          const end = Math.min(start + chunkSize - 1, range.e.r);
          const encodedRange = xlsx.utils.encode_range({
            s: { r: start, c: range.s.c },
            e: { r: end, c: range.e.c },
          });
          const rows = xlsx.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: '',
            range: encodedRange,
          }) as unknown[][];

          rows.forEach((row, idx) => {
            const rowNumber = start + idx + 1;
            const parsedRow = this.parseUploadRow(Array.isArray(row) ? row : [], rowNumber, indexes);
            if (!parsedRow) return;
            rowsReceived += 1;
            buffer.push(parsedRow);
          });

          if (buffer.length >= chunkSize) {
            const chunk = buffer.splice(0, buffer.length);
            await processChunk(chunk, totalDataRows, 'Importing spreadsheet rows');
          } else {
            await this.updateManualUploadJobProgress(job, {
              stage: 'PARSING',
              message: 'Parsing spreadsheet rows',
              processedRows: rowsReceived,
              totalRows: totalDataRows,
              insightsUpserted,
              datesProcessed: Array.from(affectedDates).sort((a, b) => a.localeCompare(b)),
            });
          }
        }

        if (buffer.length > 0) {
          const chunk = buffer.splice(0, buffer.length);
          await processChunk(chunk, totalDataRows, 'Importing spreadsheet rows');
        }
      } else {
        throw new BadRequestException('Unsupported file type. Use CSV, XLSX, or XLS.');
      }

      if (rowsReceived === 0) {
        throw new BadRequestException('The selected file does not contain any importable rows');
      }

      const datesProcessed = Array.from(affectedDates).sort((a, b) => a.localeCompare(b));
      await this.updateManualUploadJobProgress(job, {
        stage: 'RECONCILING',
        message: 'Running reconcile jobs',
        processedRows: rowsReceived,
        totalRows: rowsReceived,
        insightsUpserted,
        datesProcessed,
      });

      for (const date of datesProcessed) {
        await this.reconcileMarketingService.reconcileDay(job.data.tenantId, date, null);
      }
      for (const date of datesProcessed) {
        await this.reconcileSalesService.aggregateDay(job.data.tenantId, date, null);
      }

      const result = {
        rowsReceived,
        insightsUpserted,
        datesProcessed,
        reconcileMarketingCompleted: true,
        reconcileSalesCompleted: true,
      };

      await this.updateManualUploadJobProgress(job, {
        stage: 'COMPLETED',
        message: 'Upload completed',
        processedRows: rowsReceived,
        totalRows: rowsReceived,
        insightsUpserted,
        datesProcessed,
      });

      return result;
    } catch (error: any) {
      await this.updateManualUploadJobProgress(job, {
        stage: 'FAILED',
        message: error?.message || 'Upload failed',
        processedRows: rowsReceived,
        totalRows: rowsReceived || null,
        insightsUpserted,
        datesProcessed: Array.from(affectedDates).sort((a, b) => a.localeCompare(b)),
        failedReason: error?.message || 'Upload failed',
      });
      throw error;
    } finally {
      try {
        await fsp.unlink(job.data.filePath);
      } catch {
        // ignore cleanup failure
      }
    }
  }

  /**
   * Create a new workflow for the current tenant
   */
  async create(createWorkflowDto: CreateWorkflowDto): Promise<WorkflowResponseDto> {
    const { tenantId } = await this.teamContext.getContext();
    const { name, description, schedule, config, teamId: payloadTeamId, sharedTeamIds } =
      createWorkflowDto;

    // Validate and get effective team ID - restricts non-admins to their teams only
    const effectiveTeamId = await this.teamContext.validateAndGetTeamId(payloadTeamId);

    // Validate cron expression if schedule is provided
    if (schedule) {
      try {
        cronParser.parseExpression(schedule);
      } catch (error) {
        throw new BadRequestException('Invalid cron expression format');
      }
    }

    const validSharedIds =
      Array.isArray(sharedTeamIds) && sharedTeamIds.length > 0
        ? (
            await this.prisma.team.findMany({
              where: { tenantId, id: { in: sharedTeamIds } },
              select: { id: true },
            })
          ).map((t) => t.id)
        : [];

    // Create workflow
    const workflow = await this.prisma.workflow.create({
      data: {
        name,
        description,
        schedule,
        config: config ? (config as any) : {},
        tenantId,
        teamId: effectiveTeamId,
        enabled: true,
        sharedTeams:
          validSharedIds.length > 0
            ? {
                createMany: {
                  data: validSharedIds.map((tid) => ({ teamId: tid })),
                  skipDuplicates: true,
                },
              }
            : undefined,
      },
      include: { sharedTeams: true },
    });

    // Register cron job if schedule is provided
    if (schedule) {
      await this.schedulerService.registerWorkflowCron(workflow.id, schedule);
    }

    return new WorkflowResponseDto(workflow);
  }

  /**
   * Get all workflows for the current tenant
   * Non-admins only see workflows from their teams
   */
  async findAll(): Promise<WorkflowResponseDto[]> {
    const { where } = await this.buildAccessWhere();
    if (!where) return [];

    const workflows = await this.prisma.workflow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        sharedTeams: true,
        executions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        },
      },
    });

    return workflows.map((workflow) => {
      const lastRunAt = workflow.executions?.[0]?.createdAt || null;
      const nextRunAt = workflow.enabled ? this.computeNextRunAt(workflow.schedule) : null;
      return new WorkflowResponseDto({ ...workflow, lastRunAt, nextRunAt });
    });
  }

  async uploadManualMeta(
    payload: ManualMetaUploadDto,
  ): Promise<{
    rowsReceived: number;
    insightsUpserted: number;
    datesProcessed: string[];
    reconcileMarketingCompleted: boolean;
    reconcileSalesCompleted: boolean;
  }> {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];
    let selectedIntegration: { id: string; teamId: string | null } | null = null;

    if (payload.integrationId) {
      const integrationWhere = this.buildMetaUploadIntegrationWhere(
        tenantId,
        allowedTeams,
        isAdmin,
        payload.integrationId,
      );

      if (!integrationWhere) {
        throw new NotFoundException('Meta integration not found');
      }

      selectedIntegration = await this.prisma.integration.findFirst({
        where: integrationWhere,
        select: {
          id: true,
          teamId: true,
        },
      });

      if (!selectedIntegration) {
        throw new NotFoundException('Meta integration not found');
      }
    }

    const accountWhere = this.buildMetaUploadAccountWhere(
      tenantId,
      allowedTeams,
      isAdmin,
      selectedIntegration?.id,
    );

    if (!accountWhere) {
      throw new BadRequestException('No accessible Meta ad accounts found for this upload');
    }

    const accounts = await this.prisma.metaAdAccount.findMany({
      where: accountWhere,
      select: {
        accountId: true,
        teamId: true,
        integrationId: true,
      },
    });

    const accountMap = new Map(
      accounts.map((account) => [this.normalizeAccountId(account.accountId), account]),
    );
    const groupedInsights = new Map<
      string,
      {
        teamId: string | null;
        rawInsights: any[];
      }
    >();
    const affectedDates = new Set<string>();

    payload.rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const accountId = this.normalizeAccountId(row.accountId);
      const reportingStart = row.reportingStarts.trim();
      const reportingEnd = row.reportingEnds.trim();
      const dateCreated = row.dateCreated?.trim() || '';

      if (!accountId) {
        throw new BadRequestException(`Row ${rowNumber}: Account ID is required`);
      }
      if (!this.isIsoDate(reportingStart)) {
        throw new BadRequestException(`Row ${rowNumber}: Reporting starts must be YYYY-MM-DD`);
      }
      if (!this.isIsoDate(reportingEnd)) {
        throw new BadRequestException(`Row ${rowNumber}: Reporting ends must be YYYY-MM-DD`);
      }
      if (reportingStart !== reportingEnd) {
        throw new BadRequestException(
          `Row ${rowNumber}: Reporting starts and Reporting ends must be the same date`,
        );
      }
      if (dateCreated && !this.isIsoDate(dateCreated)) {
        throw new BadRequestException(`Row ${rowNumber}: Date created must be YYYY-MM-DD`);
      }
      if (!Number.isFinite(row.amountSpent) || row.amountSpent < 0) {
        throw new BadRequestException(`Row ${rowNumber}: Amount spent must be a non-negative number`);
      }

      this.assertWholeNumber(row.linkClicks, 'Link clicks', rowNumber);
      this.assertWholeNumber(row.clicks, 'Clicks (all)', rowNumber);
      this.assertWholeNumber(row.impressions, 'Impressions', rowNumber);
      this.assertWholeNumber(row.websitePurchases, 'Website purchases', rowNumber);

      const account = accountMap.get(accountId);
      const teamId = account?.teamId ?? selectedIntegration?.teamId ?? null;
      const existingGroup = groupedInsights.get(accountId);
      if (existingGroup) {
        existingGroup.rawInsights.push(this.toUploadedRawInsight(row));
      } else {
        groupedInsights.set(accountId, {
          teamId,
          rawInsights: [this.toUploadedRawInsight(row)],
        });
      }

      affectedDates.add(reportingStart);
    });

    let insightsUpserted = 0;
    for (const [accountId, group] of groupedInsights.entries()) {
      insightsUpserted += await this.metaInsightService.upsertMetaInsights(
        tenantId,
        accountId,
        group.rawInsights,
        group.teamId,
        1,
      );
    }

    const datesProcessed = Array.from(affectedDates).sort((a, b) => a.localeCompare(b));
    for (const date of datesProcessed) {
      await this.reconcileMarketingService.reconcileDay(tenantId, date, null);
    }
    for (const date of datesProcessed) {
      await this.reconcileSalesService.aggregateDay(tenantId, date, null);
    }

    return {
      rowsReceived: payload.rows.length,
      insightsUpserted,
      datesProcessed,
      reconcileMarketingCompleted: true,
      reconcileSalesCompleted: true,
    };
  }

  /**
   * Get a single workflow by ID
   */
  async findOne(id: string): Promise<WorkflowResponseDto> {
    const { where } = await this.buildAccessWhere(id);
    if (!where) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const workflow = await this.prisma.workflow.findFirst({
      where,
      include: {
        sharedTeams: true,
        executions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const lastRunAt = workflow.executions?.[0]?.createdAt || null;
    const nextRunAt = workflow.enabled ? this.computeNextRunAt(workflow.schedule) : null;
    return new WorkflowResponseDto({ ...workflow, lastRunAt, nextRunAt });
  }

  /**
   * Update a workflow
   */
  async update(id: string, updateWorkflowDto: UpdateWorkflowDto): Promise<WorkflowResponseDto> {
    const { where, tenantId } = await this.buildAccessWhere(id);

    if (!where) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    // Verify workflow exists and user has access
    const existingWorkflow = await this.prisma.workflow.findFirst({
      where,
      include: { sharedTeams: true },
    });

    if (!existingWorkflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const { name, description, schedule, config, enabled, teamId: payloadTeamId, sharedTeamIds } =
      updateWorkflowDto;

    // Validate and get effective team ID - restricts non-admins to their teams only
    const effectiveTeamId = await this.teamContext.validateAndGetTeamId(payloadTeamId);

    // Validate cron expression if schedule is being updated
    if (schedule) {
      try {
        cronParser.parseExpression(schedule);
      } catch (error) {
        throw new BadRequestException('Invalid cron expression format');
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (schedule !== undefined) updateData.schedule = schedule;
    if (config !== undefined) updateData.config = config;
    if (enabled !== undefined) updateData.enabled = enabled;

    const validSharedIds =
      Array.isArray(sharedTeamIds) && sharedTeamIds.length > 0
        ? (
            await this.prisma.team.findMany({
              where: { tenantId, id: { in: sharedTeamIds } },
              select: { id: true },
            })
          ).map((t) => t.id)
        : [];

    // Update workflow
    const updatedWorkflow = await this.prisma.$transaction(async (tx) => {
      await tx.workflow.update({
        where: { id },
        data: updateData,
      });

      if (sharedTeamIds !== undefined) {
        // remove missing
        await tx.workflowSharedTeam.deleteMany({
          where: {
            workflowId: id,
            ...(validSharedIds.length > 0 ? { teamId: { notIn: validSharedIds } } : {}),
          },
        });
        if (validSharedIds.length > 0) {
          await tx.workflowSharedTeam.createMany({
            data: validSharedIds.map((tid) => ({ workflowId: id, teamId: tid })),
            skipDuplicates: true,
          });
        } else {
          await tx.workflowSharedTeam.deleteMany({ where: { workflowId: id } });
        }
      }

      return tx.workflow.findUnique({
        where: { id },
        include: { sharedTeams: true },
      });
    });

    if (!updatedWorkflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    await this.schedulerService.updateWorkflowSchedule(
      id,
      updatedWorkflow.schedule,
      updatedWorkflow.enabled,
    );

    return new WorkflowResponseDto(updatedWorkflow);
  }

  /**
   * Delete a workflow
   */
  async remove(id: string): Promise<void> {
    const { where } = await this.buildAccessWhere(id);

    if (!where) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    // Verify workflow exists and user has access
    const workflow = await this.prisma.workflow.findFirst({
      where,
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    // Delete workflow (cascade will delete executions)
    await this.prisma.workflow.delete({
      where: { id },
    });
  }

  /**
   * Enable a workflow
   */
  async enable(id: string): Promise<WorkflowResponseDto> {
    const { where } = await this.buildAccessWhere(id);

    if (!where) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const workflow = await this.prisma.workflow.findFirst({
      where,
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const updatedWorkflow = await this.prisma.workflow.update({
      where: { id },
      data: { enabled: true },
      include: { sharedTeams: true },
    });

    await this.schedulerService.updateWorkflowSchedule(
      id,
      updatedWorkflow.schedule,
      updatedWorkflow.enabled,
    );

    return new WorkflowResponseDto(updatedWorkflow);
  }

  /**
   * Disable a workflow
   */
  async disable(id: string): Promise<WorkflowResponseDto> {
    const { where } = await this.buildAccessWhere(id);

    if (!where) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const workflow = await this.prisma.workflow.findFirst({
      where,
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const updatedWorkflow = await this.prisma.workflow.update({
      where: { id },
      data: { enabled: false },
      include: { sharedTeams: true },
    });

    await this.schedulerService.updateWorkflowSchedule(
      id,
      updatedWorkflow.schedule,
      updatedWorkflow.enabled,
    );

    return new WorkflowResponseDto(updatedWorkflow);
  }

  /**
   * Get all executions for a workflow
   */
  async getExecutions(workflowId: string): Promise<WorkflowExecutionResponseDto[]> {
    const { where, tenantId } = await this.buildAccessWhere(workflowId);
    if (!where) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found`);
    }

    // Verify workflow exists and user has access
    const workflow = await this.prisma.workflow.findFirst({
      where,
      include: { sharedTeams: true },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found`);
    }

    const executions = await this.prisma.workflowExecution.findMany({
      where: { workflowId, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return executions.map((execution) => new WorkflowExecutionResponseDto(execution));
  }

  /**
   * Get a single execution by ID
   */
  async getExecution(executionId: string): Promise<WorkflowExecutionResponseDto> {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId, tenantId },
      include: { workflow: { include: { sharedTeams: true } } },
    });

    if (!execution) {
      throw new NotFoundException(`Workflow execution with ID ${executionId} not found`);
    }

    if (
      !isAdmin &&
      execution.workflow &&
      !allowedTeams.some((t) => t === execution.workflow.teamId) &&
      !(execution.workflow.sharedTeams || []).some((st) => allowedTeams.includes(st.teamId))
    ) {
      throw new NotFoundException(`Workflow execution with ID ${executionId} not found`);
    }

    const cachedProgress = await this.workflowProgressCache.getProgress(executionId);
    return new WorkflowExecutionResponseDto({
      ...execution,
      metaProcessed: cachedProgress?.metaProcessed,
      metaTotal: cachedProgress?.metaTotal,
      posProcessed: cachedProgress?.posProcessed,
      posTotal: cachedProgress?.posTotal,
      currentDate: cachedProgress?.date,
    });
  }

  /**
   * Get execution logs for a single execution by ID
   */
  async getExecutionLogs(executionId: string, limit = 200): Promise<any[]> {
    const { tenantId } = await this.teamContext.getContext();
    // Reuse access check from getExecution
    await this.getExecution(executionId);
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    return this.workflowLogService.getExecutionLogs(executionId, tenantId, safeLimit);
  }

  /**
   * Manually trigger a workflow execution
   * Returns the created execution record
   */
  async triggerManual(
    workflowId: string,
    dateRangeSince?: string,
    dateRangeUntil?: string,
  ): Promise<WorkflowExecutionResponseDto> {
    const { where, tenantId } = await this.buildAccessWhere(workflowId);
    if (!where) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found`);
    }
    const { teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    // Verify workflow exists and user has access
    const workflow = await this.prisma.workflow.findFirst({
      where,
      include: { sharedTeams: true },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found`);
    }

    if (!workflow.enabled) {
      throw new BadRequestException('Cannot trigger a disabled workflow');
    }

    const existingPending = await this.prisma.workflowExecution.findFirst({
      where: {
        workflowId: workflow.id,
        status: WorkflowExecutionStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (existingPending) {
      throw new BadRequestException(
        `Workflow already has a PENDING execution (${existingPending.id}).`,
      );
    }

    const tenantRunning = await this.prisma.workflowExecution.findFirst({
      where: {
        tenantId,
        status: WorkflowExecutionStatus.RUNNING,
      },
      select: { id: true },
    });

    // Calculate date range if not provided
    let since = dateRangeSince;
    let until = dateRangeUntil;

    if (!since || !until) {
      const config = workflow.config as any;
      // Prefer workflow-level date range; fall back to legacy per-source config
      const dateRangeConfig =
        config.dateRange ||
        config.sources?.meta?.dateRange ||
        config.sources?.pos?.dateRange;

      if (!dateRangeConfig) {
        throw new BadRequestException('No date range configured for workflow');
      }

      const calculatedRange = this.dateRangeService.calculateDateRange(dateRangeConfig);
      since = calculatedRange.since;
      until = calculatedRange.until;
    }

    // Create execution record (use workflow's teamId)
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId,
        tenantId,
        teamId: workflow.teamId || null,
        triggerType: WorkflowTriggerType.MANUAL,
        status: WorkflowExecutionStatus.PENDING,
        dateRangeSince: since,
        dateRangeUntil: until,
      },
    });

    if (tenantRunning) {
      this.logger.log(
        `Tenant ${tenantId} already has a running execution; queued ${execution.id} as PENDING`,
      );
      return new WorkflowExecutionResponseDto(execution);
    }

    // Enqueue Bull job to process this execution (or inline fallback)
    const inlinePreferred =
      process.env.WORKFLOW_PROCESS_INLINE === 'true' ||
      process.env.NODE_ENV === 'development';

    let enqueued = false;

    if (!inlinePreferred) {
      try {
        await this.workflowQueue.add(
          {
            executionId: execution.id,
            tenantId,
            workflowId,
          },
          { jobId: execution.id },
        );
        enqueued = true;
      } catch (error: any) {
        if (String(error?.message || '').includes('Job') && String(error?.message || '').includes('exists')) {
          enqueued = true;
        } else {
          this.logger.warn(
            `Queue enqueue failed for execution ${execution.id}, falling back to inline processing: ${error?.message}`,
          );
        }
      }
    }

    if (!enqueued) {
      this.runExecutionInline(execution.id);
    }

    return new WorkflowExecutionResponseDto(execution);
  }

  /**
   * Cancel a running workflow execution
   */
  async cancelExecution(executionId: string): Promise<WorkflowExecutionResponseDto> {
    const { tenantId, teamIds, userTeams, isAdmin } = await this.teamContext.getContext();
    const allowedTeams = (teamIds && teamIds.length > 0 ? teamIds : userTeams) || [];

    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const execution = await this.prisma.workflowExecution.findFirst({
      where: {
        id: executionId,
        tenantId,
      },
      include: { workflow: { include: { sharedTeams: true } } },
    });

    if (!execution) {
      throw new NotFoundException(`Workflow execution with ID ${executionId} not found`);
    }

    if (
      !isAdmin &&
      execution.workflow &&
      !allowedTeams.some((t) => t === execution.workflow.teamId) &&
      !(execution.workflow.sharedTeams || []).some((st) => allowedTeams.includes(st.teamId))
    ) {
      throw new NotFoundException(`Workflow execution with ID ${executionId} not found`);
    }

    if (execution.status !== WorkflowExecutionStatus.RUNNING && execution.status !== WorkflowExecutionStatus.PENDING) {
      throw new BadRequestException('Can only cancel PENDING or RUNNING executions');
    }

    const updatedExecution = await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: WorkflowExecutionStatus.CANCELLED,
        completedAt: new Date(),
        duration: execution.startedAt
          ? new Date().getTime() - execution.startedAt.getTime()
          : 0,
      },
    });

    // Note: Bull jobs will check execution status before processing
    // If status is CANCELLED, the processor will skip execution
    try {
      await this.workflowLogService.deleteExecutionLogs(executionId, tenantId);
    } catch (error) {
      this.logger.warn(
        `Failed to delete logs for execution ${executionId}: ${error?.message}`,
      );
    }

    return new WorkflowExecutionResponseDto(updatedExecution);
  }

  /**
   * Inline processor fallback (when queue is disabled/unavailable)
   * Fire-and-forget to keep API response fast.
   */
  private runExecutionInline(executionId: string) {
    setImmediate(async () => {
      try {
        await this.workflowProcessor.processWorkflowExecution(executionId);
      } catch (error) {
        this.logger.error(
          `Inline workflow execution ${executionId} failed: ${error?.message}`,
          error?.stack,
        );
        // Mark execution as failed to avoid stuck PENDING state
        await this.prisma.workflowExecution.update({
          where: { id: executionId },
          data: {
            status: WorkflowExecutionStatus.FAILED,
            completedAt: new Date(),
            errors: [
              {
                date: 'N/A',
                source: 'system',
                error: error?.message || 'Inline execution failed',
              },
            ],
          },
        });
        try {
          await this.workflowLogService.deleteExecutionLogs(executionId);
        } catch (deleteError) {
          this.logger.warn(
            `Failed to delete logs for execution ${executionId}: ${deleteError?.message}`,
          );
        }
      }
    });
  }

}
