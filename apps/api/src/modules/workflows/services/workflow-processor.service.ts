import { Injectable, Logger } from '@nestjs/common';
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
import { IntegrationStatus, WorkflowExecutionStatus } from '@prisma/client';
import { WorkflowExecutionGateway } from '../gateways/workflow-execution.gateway';
import { WorkflowLogService } from './workflow-log.service';
import { ReconcileMarketingService } from './reconcile-marketing.service';
import { ReconcileSalesService } from './reconcile-sales.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

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
    private readonly reconcileMarketingService: ReconcileMarketingService,
    private readonly reconcileSalesService: ReconcileSalesService,
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

      const [metaAccountCount, posStoreCount] = await Promise.all([
        metaEnabled
          ? this.prisma.metaAdAccount.count({
              where: { tenantId: context.tenantId },
            })
          : Promise.resolve(0),
        posEnabled
          ? this.prisma.posStore.count({
              where: { tenantId: context.tenantId },
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

        if (!this.isValidDateString(date)) {
          const errorObj: ExecutionError = {
            date,
            source: 'validation',
            error: `Invalid date format: ${date}`,
          };
          errors.push(errorObj);
          this.emitAndLog(executionId, 'execution:error', context.tenantId, {
            executionId,
            date,
            source: 'validation',
            error: errorObj.error,
            timestamp: new Date().toISOString(),
          }, 'error', `Invalid date format for ${date}`);

          await this.prisma.workflowExecution.update({
            where: { id: executionId },
            data: { daysProcessed: { increment: 1 } },
          });
          completedDays = currentDay;
          incrementUnits(unitsPerDay, date);
          continue;
        }

        if (this.isFutureDate(date)) {
          const errorObj: ExecutionError = {
            date,
            source: 'validation',
            error: `Date is in the future: ${date}`,
          };
          errors.push(errorObj);
          this.emitAndLog(executionId, 'execution:error', context.tenantId, {
            executionId,
            date,
            source: 'validation',
            error: errorObj.error,
            timestamp: new Date().toISOString(),
          }, 'warn', `Skipping future date ${date}`);

          await this.prisma.workflowExecution.update({
            where: { id: executionId },
            data: { daysProcessed: { increment: 1 } },
          });
          completedDays = currentDay;
          incrementUnits(unitsPerDay, date);
          continue;
        }

        this.logger.log(`Processing date ${date} for execution ${executionId}`);
        this.emitAndLog(executionId, 'execution:date_started', context.tenantId, {
          executionId,
          date,
          day: currentDay,
          totalDays,
          timestamp: new Date().toISOString(),
        }, 'info', `Processing date ${date} (${currentDay}/${totalDays})`);

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
        try {
          await this.reconcileMarketingService.reconcileDay(
            context.tenantId,
            date,
            context.teamId ?? null,
          );
        } catch (error) {
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
        try {
          await this.reconcileSalesService.aggregateDay(
            context.tenantId,
            date,
            context.teamId ?? null,
          );
          // Notify listeners that marketing/sales data has been updated
          this.executionGateway.emitTenantEvent(
            context.tenantId,
            context.teamId ?? null,
            'marketing:updated',
            {
              tenantId: context.tenantId,
              teamId: context.teamId ?? null,
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
        this.logger.warn(`Workflow execution ${executionId} completed with ${errors.length} errors`);
        this.emitAndLog(executionId, 'execution:completed_with_errors', context.tenantId, {
          executionId,
          workflowId: context.workflowId,
          tenantId: context.tenantId,
          duration,
          errorCount: errors.length,
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
    const metaAccounts = await this.prisma.metaAdAccount.findMany({
      where: { tenantId: context.tenantId, teamId: context.teamId || undefined },
      include: { integration: true },
    });

    if (metaAccounts.length === 0) {
      this.logger.warn(`No Meta ad accounts found for tenant ${context.tenantId}`);
      return errors;
    }

    // Get rate limit config
    const metaDelayMs = context.config.rateLimit?.metaDelayMs || 3000;

    // Process each account sequentially with rate limiting
    for (const account of metaAccounts) {
      if (await this.isCancelled(context.executionId)) {
        this.logger.warn(`Execution ${context.executionId} cancelled during Meta fetch`);
        return errors;
      }

      this.logger.log(`Fetching Meta insights for account ${account.accountId} on ${date}`);

      const registerError = (
        errorMessage: string,
        level: 'info' | 'warn' | 'error' = 'error',
      ) => {
        const errorObj: ExecutionError = {
          date,
          source: 'meta',
          accountId: account.accountId,
          error: errorMessage,
        };
        errors.push(errorObj);
        this.emitAndLog(context.executionId, 'execution:error', context.tenantId, {
          executionId: context.executionId,
          date,
          source: 'meta',
          accountId: account.accountId,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }, level, `Meta error for ${account.accountId} on ${date}: ${errorMessage}`);
      };

      if (!account.accountId) {
        registerError('Missing Meta account ID', 'error');
        onAccountComplete?.();
        continue;
      }

      if (account.enabled === false || (account.status && account.status !== IntegrationStatus.ACTIVE)) {
        registerError('Meta account is not active or disabled', 'warn');
        onAccountComplete?.();
        continue;
      }

      if (account.accountStatus && account.accountStatus !== 1) {
        registerError(`Meta account status is inactive (${account.accountStatus})`, 'warn');
        onAccountComplete?.();
        continue;
      }

      if (account.integration?.enabled === false || account.integration?.status !== IntegrationStatus.ACTIVE) {
        registerError('Integration is not active or disabled', 'warn');
        onAccountComplete?.();
        continue;
      }

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
        registerError(`Failed to decrypt credentials: ${err?.message || 'unknown error'}`, 'error');
        onAccountComplete?.();
        continue;
      }

      if (!credentials?.accessToken) {
        registerError('Missing Meta access token', 'error');
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
      } catch (error) {
        registerError((error as Error).message || 'Meta fetch failed', 'error');
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
        timestamp: new Date().toISOString(),
      }, 'info', `Meta fetched ${upserted} rows for ${account.accountId} on ${date}`);

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
    const posStores = await this.prisma.posStore.findMany({
      where: { tenantId: context.tenantId, teamId: context.teamId || undefined },
      include: { integration: true },
    });

    if (posStores.length === 0) {
      this.logger.warn(`No POS stores found for tenant ${context.tenantId}`);
      return errors;
    }

    // Get rate limit config
    const posDelayMs = context.config.rateLimit?.posDelayMs || 3000;

    // Process each store sequentially with rate limiting
    for (const store of posStores) {
      if (await this.isCancelled(context.executionId)) {
        this.logger.warn(`Execution ${context.executionId} cancelled during POS fetch`);
        return errors;
      }

      this.logger.log(`Fetching POS orders for shop ${store.shopId} on ${date}`);

      const registerError = (
        errorMessage: string,
        level: 'info' | 'warn' | 'error' = 'error',
      ) => {
        const errorObj: ExecutionError = {
          date,
          source: 'pos',
          shopId: store.shopId,
          error: errorMessage,
        };
        errors.push(errorObj);
        this.emitAndLog(context.executionId, 'execution:error', context.tenantId, {
          executionId: context.executionId,
          date,
          source: 'pos',
          shopId: store.shopId,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }, level, `POS error for ${store.shopId} on ${date}: ${errorMessage}`);
      };

      if (!store.shopId) {
        registerError('Missing POS shop ID', 'error');
        onStoreComplete?.();
        continue;
      }

      if (!store.apiKey) {
        registerError('Missing POS API key', 'error');
        onStoreComplete?.();
        continue;
      }

      if (store.enabled === false || (store.status && store.status !== IntegrationStatus.ACTIVE)) {
        registerError('POS store is not active or disabled', 'warn');
        onStoreComplete?.();
        continue;
      }

      if (store.integration?.enabled === false || store.integration?.status !== IntegrationStatus.ACTIVE) {
        registerError('Integration is not active or disabled', 'warn');
        onStoreComplete?.();
        continue;
      }

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
      } catch (error) {
        registerError((error as Error).message || 'POS fetch failed', 'error');
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
        timestamp: new Date().toISOString(),
      }, 'info', `POS fetched ${upserted} orders for ${store.shopId} on ${date}`);

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

  private isValidDateString(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return false;
    }
    return dayjs.tz(date, 'Asia/Manila').isValid();
  }

  private isFutureDate(date: string): boolean {
    const target = dayjs.tz(date, 'Asia/Manila').startOf('day');
    const today = dayjs().tz('Asia/Manila').startOf('day');
    return target.isAfter(today);
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
}
