import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import { IntegrationService } from '../../integrations/integration.service';
import { IntegrationProvider } from '../../integrations/dto/create-integration.dto';
import { ProviderFactory } from '../../integrations/providers/provider.factory';
import { MetaAdsProvider } from '../../integrations/providers/meta-ads.provider';
import { PancakePosProvider } from '../../integrations/providers/pancake-pos.provider';
import { MetaInsightService } from '../../integrations/services/meta-insight.service';
import { PosOrderService } from '../../integrations/services/pos-order.service';
import { DateRangeService } from './date-range.service';
import { WorkflowExecutionStatus } from '@prisma/client';
import { WorkflowExecutionGateway } from '../gateways/workflow-execution.gateway';
import { WorkflowLogService } from './workflow-log.service';
import { ReconcileMarketingService } from './reconcile-marketing.service';
import { ReconcileSalesService } from './reconcile-sales.service';
import { WorkflowProgressCacheService } from './workflow-progress-cache.service';
import { WORKFLOW_QUEUE, WorkflowJobData } from '../workflow.constants';

interface WorkflowExecutionContext {
  executionId: string;
  workflowId: string;
  tenantId: string;
  teamId: string | null;
  config: any;
  dateRangeSince: string;
  dateRangeUntil: string;
}

interface ExecutionError {
  date: string;
  source: string;
  accountId?: string;
  shopId?: string;
  error: string;
}

@Injectable()
export class WorkflowProcessorService {
  private readonly logger = new Logger(WorkflowProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly integrationService: IntegrationService,
    private readonly providerFactory: ProviderFactory,
    private readonly metaInsightService: MetaInsightService,
    private readonly posOrderService: PosOrderService,
    private readonly dateRangeService: DateRangeService,
    private readonly executionGateway: WorkflowExecutionGateway,
    private readonly workflowLogService: WorkflowLogService,
    private readonly workflowProgressCache: WorkflowProgressCacheService,
    private readonly reconcileMarketingService: ReconcileMarketingService,
    private readonly reconcileSalesService: ReconcileSalesService,
    @InjectQueue(WORKFLOW_QUEUE) private readonly workflowQueue: Queue<WorkflowJobData>,
  ) {}

  /**
   * Main workflow execution processor
   * Processes one date at a time, fetching Meta first then POS
   * Best-effort: logs errors and continues
   */
  async processWorkflowExecution(executionId: string): Promise<void> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { workflow: true },
    });

    if (!execution) {
      throw new Error(`Workflow execution ${executionId} not found`);
    }

    // Check if execution was cancelled
    if (execution.status === WorkflowExecutionStatus.CANCELLED) {
      this.logger.warn(`Workflow execution ${executionId} was cancelled, skipping processing`);
      await this.clearExecutionLogs(executionId, execution.tenantId);
      return;
    }

    // Ensure tenant context is set for downstream services (Prisma, integrations)
    return this.runWithTenantContext(execution.tenantId, execution.teamId || null, async () => {
      await this.processExecutionWithContext(execution);
    });
  }

  private async processExecutionWithContext(
    execution: any,
  ): Promise<void> {
    // Ensure tenant context is set for downstream services
    this.cls.set('tenantId', execution.tenantId);
    this.cls.set('teamId', execution.teamId || null);
    this.cls.set('userRole', 'SYSTEM');

    const executionId = execution.id;

    const context: WorkflowExecutionContext = {
      executionId,
      workflowId: execution.workflowId,
      tenantId: execution.tenantId,
      teamId: execution.teamId || null,
      config: execution.workflow.config as any,
      dateRangeSince: execution.dateRangeSince || '',
      dateRangeUntil: execution.dateRangeUntil || '',
    };

    this.logger.log(`Starting workflow execution ${executionId} for tenant ${context.tenantId}`);
    this.emitAndLog(executionId, 'execution:started', context.tenantId, {
      executionId,
      workflowId: context.workflowId,
      tenantId: context.tenantId,
      timestamp: new Date().toISOString(),
    }, 'info', 'Execution started');

    try {
      let cancellationAnnounced = false;
      const announceCancellation = (date?: string) => {
        if (cancellationAnnounced) return;
        cancellationAnnounced = true;
        this.logger.warn(`Execution ${executionId} was cancelled${date ? ` near date ${date}` : ''}`);
        this.emitAndLog(executionId, 'execution:cancelled', context.tenantId, {
          executionId,
          date,
          timestamp: new Date().toISOString(),
        }, 'warn', date ? `Execution cancelled near date ${date}` : 'Execution cancelled');
      };

      const checkCancellation = async (date?: string): Promise<boolean> => {
        const cancelled = await this.isCancelled(executionId);
        if (cancelled) {
          announceCancellation(date);
          await this.clearExecutionLogs(executionId, context.tenantId);
          return true;
        }
        return false;
      };

      // Update status to RUNNING
      await this.updateExecutionStatus(executionId, WorkflowExecutionStatus.RUNNING, {
        startedAt: new Date(),
      });

      // Get date array
      const dates = this.dateRangeService.getDateArray(
        context.dateRangeSince,
        context.dateRangeUntil,
      );

      const totalDays = dates.length;
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: { totalDays },
      });

      const errors: ExecutionError[] = [];

      const metaEnabled = !!context.config.sources?.meta?.enabled;
      const posEnabled = !!context.config.sources?.pos?.enabled;

      const sharedAccessFilter = this.buildSharedIntegrationWhere(context.teamId);
      const [metaAccountCount, posStoreCount] = await Promise.all([
        metaEnabled
          ? this.prisma.metaAdAccount.count({
              where: sharedAccessFilter
                ? { tenantId: context.tenantId, ...sharedAccessFilter }
                : { tenantId: context.tenantId },
            })
          : Promise.resolve(0),
        posEnabled
          ? this.prisma.posStore.count({
              where: sharedAccessFilter
                ? { tenantId: context.tenantId, ...sharedAccessFilter }
                : { tenantId: context.tenantId },
            })
          : Promise.resolve(0),
      ]);

      const dailyUnitSources =
        (metaEnabled ? metaAccountCount : 0) +
        (posEnabled ? posStoreCount : 0);
      const unitsPerDay = dailyUnitSources > 0 ? dailyUnitSources : 1;
      const totalUnits = totalDays * unitsPerDay;
      let unitsProcessed = 0;

      // Process each date sequentially (oldest to newest)
      let completedDays = 0;

      const emitProgressValue = (dateTag?: string) => {
        this.emitAndLog(executionId, 'execution:progress', context.tenantId, {
          executionId,
          date: dateTag,
          progress: {
            current: unitsProcessed,
            total: totalUnits,
          },
          dayProgress: {
            completedDays,
            totalDays,
          },
          timestamp: new Date().toISOString(),
        }, 'info', `Execution progress updated (${unitsProcessed.toFixed(2)}/${totalUnits})`);
      };

      const incrementUnits = (amount = 1, dateTag?: string) => {
        unitsProcessed = Math.min(unitsProcessed + amount, totalUnits);
        emitProgressValue(dateTag);
      };

      // Emit initial progress event so clients can render 0%
      emitProgressValue();

      const useDayFallback = dailyUnitSources === 0;

      for (const date of dates) {
        const currentDay = completedDays + 1;
        const unitsAtDayStart = unitsProcessed;

        // Respect cancellation before processing this date
        if (await checkCancellation(date)) {
          return;
        }

        this.logger.log(`Processing date ${date} for execution ${executionId}`);
        this.emitAndLog(executionId, 'execution:date_started', context.tenantId, {
          executionId,
          date,
          day: currentDay,
          totalDays,
          metaTotal: metaEnabled ? metaAccountCount : 0,
          posTotal: posEnabled ? posStoreCount : 0,
          timestamp: new Date().toISOString(),
        }, 'info', `Processing date ${date} (${currentDay}/${totalDays})`);

        await this.workflowProgressCache.setProgress(executionId, {
          date,
          metaProcessed: 0,
          posProcessed: 0,
          metaTotal: metaEnabled ? metaAccountCount : 0,
          posTotal: posEnabled ? posStoreCount : 0,
        });

        // Fetch Meta ads if enabled
        if (metaEnabled) {
          try {
            const metaErrors = await this.fetchMetaForDate(context, date, () =>
              incrementUnits(1, date),
            );
            if (metaErrors.length > 0) {
              errors.push(...metaErrors);
            }
            if (await checkCancellation(date)) {
              return;
            }
          } catch (error) {
            const errorObj: ExecutionError = {
              date,
              source: 'meta',
              error: error.message,
            };
            errors.push(errorObj);
            this.emitAndLog(executionId, 'execution:error', context.tenantId, {
              executionId,
              date,
              error: error.message,
              source: 'meta',
              timestamp: new Date().toISOString(),
            }, 'error', `Meta fetch failed on ${date}: ${error.message}`);
          }
        }

        // Fetch POS if enabled
        if (posEnabled) {
          try {
            const posErrors = await this.fetchPosForDate(context, date, () =>
              incrementUnits(1, date),
            );
            if (posErrors.length > 0) {
              errors.push(...posErrors);
            }
            if (await checkCancellation(date)) {
              return;
            }
          } catch (error) {
            const errorObj: ExecutionError = {
              date,
              source: 'pos',
              error: error.message,
            };
            errors.push(errorObj);
            this.emitAndLog(executionId, 'execution:error', context.tenantId, {
              executionId,
              date,
              error: error.message,
              source: 'pos',
              timestamp: new Date().toISOString(),
            }, 'error', `POS fetch failed on ${date}: ${error.message}`);
          }
        }

        // Reconcile marketing (ad-level) after both sources succeed
        let reconcileOk = true;
        try {
          // Reconcile tenant-wide so shared integrations/shops are included
          await this.reconcileMarketingService.reconcileDay(
            context.tenantId,
            date,
            null,
          );
        } catch (error) {
          reconcileOk = false;
          const errorObj: ExecutionError = {
            date,
            source: 'reconcile',
            error: (error as Error).message,
          };
          errors.push(errorObj);
          this.emitAndLog(executionId, 'execution:error', context.tenantId, {
            executionId,
            date,
            error: (error as Error).message,
            source: 'reconcile',
            timestamp: new Date().toISOString(),
          }, 'error', `Reconciliation failed on ${date}: ${(error as Error).message}`);
        }

        // Aggregate sales (campaign-level) after reconcile_marketing
        if (reconcileOk) {
          try {
            // Aggregate tenant-wide to match reconciliation scope
            await this.reconcileSalesService.aggregateDay(
              context.tenantId,
              date,
              null,
            );
            // Notify listeners that marketing/sales data has been updated
            this.executionGateway.emitTenantEvent(
              context.tenantId,
              null,
              'marketing:updated',
              {
                tenantId: context.tenantId,
                teamId: null,
                date,
                source: 'reconcile_sales',
              },
            );
          } catch (error) {
            const errorObj: ExecutionError = {
              date,
              source: 'reconcile_sales',
              error: (error as Error).message,
            };
            errors.push(errorObj);
            this.emitAndLog(executionId, 'execution:error', context.tenantId, {
              executionId,
              date,
              error: (error as Error).message,
              source: 'reconcile_sales',
              timestamp: new Date().toISOString(),
            }, 'error', `Reconcile sales failed on ${date}: ${(error as Error).message}`);
          }
        } else {
          this.emitAndLog(executionId, 'execution:reconcile_sales_skipped', context.tenantId, {
            executionId,
            date,
            source: 'reconcile_sales',
            reason: 'Reconcile marketing failed',
            timestamp: new Date().toISOString(),
          }, 'warn', `Reconcile sales skipped on ${date} (reconcile failed)`);
        }

        // Update progress
        await this.prisma.workflowExecution.update({
          where: { id: executionId },
          data: { daysProcessed: { increment: 1 } },
        });
        completedDays = currentDay;

        if (useDayFallback && unitsProcessed === unitsAtDayStart) {
          incrementUnits(1, date);
        } else {
          emitProgressValue(date);
        }

        if (await checkCancellation(date)) {
          return;
        }
      }

      if (await checkCancellation()) {
        return;
      }

      // Complete execution (with or without errors)
      const completedAt = new Date();
      const startedAt = execution.startedAt || new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      const hasErrors = errors.length > 0;

      await this.updateExecutionStatus(executionId, WorkflowExecutionStatus.COMPLETED, {
        completedAt,
        duration,
        errors,
      });

      if (hasErrors) {
        const summary = this.summarizeErrors(errors);
        this.logger.warn(
          `Workflow execution ${executionId} completed with ${errors.length} errors${summary.message ? ` (${summary.message})` : ''}`,
        );
        this.emitAndLog(executionId, 'execution:completed_with_errors', context.tenantId, {
          executionId,
          workflowId: context.workflowId,
          tenantId: context.tenantId,
          duration,
          errorCount: errors.length,
          errorSummary: summary,
          timestamp: new Date().toISOString(),
        }, 'warn', `Execution completed with ${errors.length} errors in ${duration}ms`);
      } else {
        this.logger.log(`Workflow execution ${executionId} completed successfully`);
        this.emitAndLog(executionId, 'execution:completed', context.tenantId, {
          executionId,
          workflowId: context.workflowId,
          tenantId: context.tenantId,
          duration,
          timestamp: new Date().toISOString(),
        }, 'info', `Execution completed in ${duration}ms`);
      }
      await this.clearExecutionLogs(executionId, context.tenantId);
    } catch (error) {
      this.logger.error(`Workflow execution ${executionId} failed: ${error.message}`, error.stack);

      await this.failExecution(executionId, [
        {
        date: 'N/A',
        source: 'system',
        error: error.message,
      },
      ]);

      this.emitAndLog(executionId, 'execution:failed', context.tenantId, {
        executionId,
        workflowId: context.workflowId,
        tenantId: context.tenantId,
        error: error.message,
        timestamp: new Date().toISOString(),
      }, 'error', `Execution failed: ${error.message}`);
      await this.clearExecutionLogs(executionId, context.tenantId);
      throw error;
    } finally {
      try {
        await this.enqueueNextPendingForTenant(context.tenantId);
      } catch (enqueueError) {
        this.logger.warn(
          `Failed to enqueue next pending execution for tenant ${context.tenantId}: ${enqueueError?.message}`,
        );
      }
    }
  }

  private async enqueueNextPendingForTenant(tenantId: string): Promise<void> {
    const running = await this.prisma.workflowExecution.findFirst({
      where: {
        tenantId,
        status: WorkflowExecutionStatus.RUNNING,
      },
      select: { id: true },
    });
    if (running) {
      return;
    }

    const nextPending = await this.prisma.workflowExecution.findFirst({
      where: {
        tenantId,
        status: WorkflowExecutionStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, workflowId: true, tenantId: true },
    });

    if (!nextPending) {
      return;
    }

    const inlinePreferred =
      process.env.WORKFLOW_PROCESS_INLINE === 'true' ||
      process.env.NODE_ENV === 'development';

    let enqueued = false;

    if (!inlinePreferred) {
      try {
        await this.workflowQueue.add(
          {
            executionId: nextPending.id,
            tenantId: nextPending.tenantId,
            workflowId: nextPending.workflowId,
          },
          { jobId: nextPending.id },
        );
        enqueued = true;
      } catch (error: any) {
        if (String(error?.message || '').includes('Job') && String(error?.message || '').includes('exists')) {
          enqueued = true;
        } else {
          this.logger.error(
            `Failed to enqueue pending execution ${nextPending.id}: ${error?.message}`,
            error?.stack,
          );
        }
      }
    }

    if (!enqueued) {
      setImmediate(async () => {
        try {
          await this.processWorkflowExecution(nextPending.id);
        } catch (error) {
          this.logger.error(
            `Inline workflow execution ${nextPending.id} failed: ${error?.message}`,
            error?.stack,
          );
        }
      });
    }
  }

  private async runWithTenantContext<T>(
    tenantId: string,
    teamId: string | null,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.cls.run(async () => {
      this.cls.set('tenantId', tenantId);
      this.cls.set('teamId', teamId);
      // mark as system context
      this.cls.set('userRole', 'SYSTEM');
      return fn();
    });
  }

  /**
   * Fetch Meta ad insights for all accounts on a specific date
   */
  private async fetchMetaForDate(
    context: WorkflowExecutionContext,
    date: string,
    onAccountComplete?: () => void,
  ): Promise<ExecutionError[]> {
    // Make sure CLS has tenant for integration service
    this.cls.set('tenantId', context.tenantId);
    this.cls.set('userRole', 'SYSTEM');

    const errors: ExecutionError[] = [];

    // Get all Meta ad accounts for tenant
    const sharedAccessFilter = this.buildSharedIntegrationWhere(context.teamId);
    const metaAccounts = await this.prisma.metaAdAccount.findMany({
      where: sharedAccessFilter
        ? { tenantId: context.tenantId, ...sharedAccessFilter }
        : { tenantId: context.tenantId },
      include: { integration: true },
    });

    if (metaAccounts.length === 0) {
      this.logger.warn(`No Meta ad accounts found for tenant ${context.tenantId}`);
      return errors;
    }

    // Get rate limit config
    const metaDelayMs = context.config.rateLimit?.metaDelayMs || 3000;

    const metaTotal = metaAccounts.length;

    // Process each account sequentially with rate limiting
    for (const account of metaAccounts) {
      if (await this.isCancelled(context.executionId)) {
        this.logger.warn(`Execution ${context.executionId} cancelled during Meta fetch`);
        return errors;
      }

      this.logger.log(`Fetching Meta insights for account ${account.accountId} on ${date}`);

      const registerError = (message: string, metaError?: any) => {
        const errorObj: ExecutionError = {
          date,
          source: 'meta',
          accountId: account.accountId,
          error: message,
        };
        if (metaError !== undefined) {
          (errorObj as any).metaError = metaError;
        }
        errors.push(errorObj);
        this.emitAndLog(context.executionId, 'execution:error', context.tenantId, {
          executionId: context.executionId,
          date,
          source: 'meta',
          accountId: account.accountId,
          error: message,
          metaError,
          timestamp: new Date().toISOString(),
        }, 'error', `Meta fetch failed for ${account.accountId} on ${date}: ${message}`);
      };

      // Get decrypted credentials
      let credentials: any;
      try {
        credentials = await this.integrationService.getDecryptedCredentials(
          account.integrationId,
          context.tenantId,
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to decrypt credentials for integration ${account.integrationId} (tenant ${context.tenantId}): ${err?.message}`,
        );
        registerError(`Failed to decrypt credentials: ${err?.message || 'unknown error'}`);
        onAccountComplete?.();
        continue;
      }

      // Create provider
      const provider = this.providerFactory.createProvider(
        IntegrationProvider.META_ADS,
        credentials,
        account.integration.config as any,
      ) as MetaAdsProvider;

      // Determine currency multiplier (only for non-PHP accounts)
      const multiplier =
        account.currency && account.currency.toUpperCase() !== 'PHP'
          ? Number(account.currencyMultiplier || 1) || 1
          : 1;

      // Fetch insights
      let rawInsights: any[] = [];
      try {
        rawInsights = await provider.fetchAdInsights(account.accountId, date);
      } catch (err: any) {
        registerError(err?.message || 'Meta fetch failed', err?.metaError);
        onAccountComplete?.();
        await new Promise(resolve => setTimeout(resolve, metaDelayMs));
        continue;
      }

      let upserted = 0;
      if (rawInsights.length > 0) {
        const targetTeamId = account.teamId || account.integration?.teamId || context.teamId || null;
        // Persist to database
        upserted = await this.metaInsightService.upsertMetaInsights(
          context.tenantId,
          account.accountId,
          rawInsights,
          targetTeamId,
          multiplier,
        );

        // Update execution counter
        if (upserted > 0) {
          await this.prisma.workflowExecution.update({
            where: { id: context.executionId },
            data: { metaFetched: { increment: upserted } },
          });
        }
      }

      this.logger.log(
        `Meta fetch completed for account ${account.accountId} with ${upserted} rows on ${date}`,
      );
      this.emitAndLog(context.executionId, 'execution:meta_fetched', context.tenantId, {
        executionId: context.executionId,
        accountId: account.accountId,
        date,
        count: upserted,
        processed: 1,
        total: metaTotal,
        timestamp: new Date().toISOString(),
      }, 'info', `Meta fetched ${upserted} rows for ${account.accountId} on ${date}`);

      await this.workflowProgressCache.bumpMetaProcessed(context.executionId, metaTotal, date);

      onAccountComplete?.();

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, metaDelayMs));
    }

    return errors;
  }

  /**
   * Fetch POS orders for all stores on a specific date
   */
  private async fetchPosForDate(
    context: WorkflowExecutionContext,
    date: string,
    onStoreComplete?: () => void,
  ): Promise<ExecutionError[]> {
    this.cls.set('tenantId', context.tenantId);
    this.cls.set('userRole', 'SYSTEM');

    const errors: ExecutionError[] = [];

    // Get all POS stores for tenant
    const sharedAccessFilter = this.buildSharedIntegrationWhere(context.teamId);
    const posStores = await this.prisma.posStore.findMany({
      where: sharedAccessFilter
        ? { tenantId: context.tenantId, ...sharedAccessFilter }
        : { tenantId: context.tenantId },
    });

    if (posStores.length === 0) {
      this.logger.warn(`No POS stores found for tenant ${context.tenantId}`);
      return errors;
    }

    // Get rate limit config
    const posDelayMs = context.config.rateLimit?.posDelayMs || 3000;

    const posTotal = posStores.length;

    // Process each store sequentially with rate limiting
    for (const store of posStores) {
      if (await this.isCancelled(context.executionId)) {
        this.logger.warn(`Execution ${context.executionId} cancelled during POS fetch`);
        return errors;
      }

      this.logger.log(`Fetching POS orders for shop ${store.shopId} on ${date}`);

      const registerError = (message: string) => {
        const errorObj: ExecutionError = {
          date,
          source: 'pos',
          shopId: store.shopId,
          error: message,
        };
        errors.push(errorObj);
        this.emitAndLog(context.executionId, 'execution:error', context.tenantId, {
          executionId: context.executionId,
          date,
          source: 'pos',
          shopId: store.shopId,
          error: message,
          timestamp: new Date().toISOString(),
        }, 'error', `POS fetch failed for ${store.shopId} on ${date}: ${message}`);
      };

      // Create provider
      const provider = this.providerFactory.createProvider(
        IntegrationProvider.PANCAKE_POS,
        { apiKey: store.apiKey },
        { shopId: store.shopId },
      ) as PancakePosProvider;

      // Fetch orders
      let rawOrders: any[] = [];
      try {
        rawOrders = await provider.fetchOrders(store.shopId, date);
      } catch (err: any) {
        registerError(err?.message || 'POS fetch failed');
        onStoreComplete?.();
        if (posDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, posDelayMs));
        }
        continue;
      }

      let upserted = 0;
      if (rawOrders.length > 0) {
        const targetTeamId = store.teamId || context.teamId || null;
        // Persist to database
        upserted = await this.posOrderService.upsertPosOrders(
          context.tenantId,
          store.id,
          rawOrders,
          targetTeamId,
        );

        // Update execution counter
        if (upserted > 0) {
          await this.prisma.workflowExecution.update({
            where: { id: context.executionId },
            data: { posFetched: { increment: upserted } },
          });
        }
      }

      this.logger.log(`POS fetch completed for shop ${store.shopId} with ${upserted} orders on ${date}`);
      this.emitAndLog(context.executionId, 'execution:pos_fetched', context.tenantId, {
        executionId: context.executionId,
        shopId: store.shopId,
        date,
        count: upserted,
        processed: 1,
        total: posTotal,
        timestamp: new Date().toISOString(),
      }, 'info', `POS fetched ${upserted} orders for ${store.shopId} on ${date}`);

      await this.workflowProgressCache.bumpPosProcessed(context.executionId, posTotal, date);

      onStoreComplete?.();

      // Rate limiting delay (optional, skip when set to 0)
      if (posDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, posDelayMs));
      }
    }

    return errors;
  }

  /**
   * Update execution status
   */
  private async updateExecutionStatus(
    executionId: string,
    status: WorkflowExecutionStatus,
    additional?: any,
  ): Promise<void> {
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status,
        ...additional,
      },
    });
  }

  private buildSharedIntegrationWhere(teamId: string | null): { OR: any[] } | undefined {
    if (!teamId) {
      return undefined;
    }
    return {
      OR: [
        { teamId },
        { integration: { teamId } },
        { integration: { sharedTeams: { some: { teamId } } } },
      ],
    };
  }

  /**
   * Fail execution with errors
   */
  private async failExecution(
    executionId: string,
    errors: ExecutionError[],
    lastProcessedDate?: string,
  ): Promise<void> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      select: { startedAt: true, tenantId: true },
    });

    const completedAt = new Date();
    const startedAt = execution?.startedAt || new Date();
    const duration = completedAt.getTime() - startedAt.getTime();

    await this.updateExecutionStatus(executionId, WorkflowExecutionStatus.FAILED, {
      errors,
      completedAt,
      duration,
    });

    this.logger.error(
      `Workflow execution ${executionId} failed on date ${lastProcessedDate || 'unknown'}`,
    );
  }

  private async clearExecutionLogs(executionId: string, tenantId?: string) {
    try {
      await this.workflowLogService.deleteExecutionLogs(executionId, tenantId);
    } catch (error) {
      this.logger.warn(
        `Failed to delete logs for execution ${executionId}: ${error?.message}`,
      );
    }
  }

  private async isCancelled(executionId: string): Promise<boolean> {
    const exec = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      select: { status: true },
    });
    return exec?.status === WorkflowExecutionStatus.CANCELLED;
  }

  private emitAndLog(
    executionId: string,
    event: string,
    tenantId: string,
    payload: any,
    level: 'info' | 'warn' | 'error' = 'info',
    message?: string,
  ) {
    this.executionGateway.emitExecutionEvent(executionId, event, payload);
    this.workflowLogService.createLog({
      executionId,
      tenantId,
      level,
      event,
      message: message || event,
      metadata: payload,
    });
  }

  private summarizeErrors(errors: ExecutionError[]) {
    const metaAccounts = new Set<string>();
    const posShops = new Set<string>();
    const counts: Record<string, number> = {};

    for (const err of errors) {
      counts[err.source] = (counts[err.source] || 0) + 1;
      if (err.source === 'meta' && err.accountId) {
        metaAccounts.add(err.accountId);
      }
      if (err.source === 'pos' && err.shopId) {
        posShops.add(err.shopId);
      }
    }

    const parts: string[] = [];
    if (counts.meta) {
      const list = Array.from(metaAccounts).slice(0, 5).join(', ');
      parts.push(`meta ${counts.meta}${list ? ` (accounts: ${list}${metaAccounts.size > 5 ? ', ...' : ''})` : ''}`);
    }
    if (counts.pos) {
      const list = Array.from(posShops).slice(0, 5).join(', ');
      parts.push(`pos ${counts.pos}${list ? ` (shops: ${list}${posShops.size > 5 ? ', ...' : ''})` : ''}`);
    }

    return {
      counts,
      metaAccounts: Array.from(metaAccounts),
      posShops: Array.from(posShops),
      message: parts.join('; '),
    };
  }
}
