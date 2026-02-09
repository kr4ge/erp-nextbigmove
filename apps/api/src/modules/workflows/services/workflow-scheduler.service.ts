import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DateRangeService } from './date-range.service';
import { WorkflowTriggerType } from '@prisma/client';
import { WORKFLOW_QUEUE, WorkflowJobData } from '../processors/workflow.processor';
import { WorkflowProcessorService } from './workflow-processor.service';

@Injectable()
export class WorkflowSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly dateRangeService: DateRangeService,
    private readonly workflowProcessor: WorkflowProcessorService,
    @InjectQueue(WORKFLOW_QUEUE) private readonly workflowQueue: Queue<WorkflowJobData>,
  ) {}

  /**
   * Initialize all scheduled workflows on module start
   */
  async onModuleInit() {
    this.logger.log('Initializing workflow scheduler...');
    await this.syncAllScheduledWorkflows();
  }

  /**
   * Sync all enabled workflows with schedules
   * Registers cron jobs for all scheduled workflows
   */
  async syncAllScheduledWorkflows(): Promise<void> {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        enabled: true,
        schedule: { not: null },
      },
    });

    this.logger.log(`Found ${workflows.length} scheduled workflows to sync`);

    for (const workflow of workflows) {
      try {
        await this.registerWorkflowCron(workflow.id, workflow.schedule!);
      } catch (error) {
        this.logger.error(
          `Failed to register cron for workflow ${workflow.id}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Register a cron job for a specific workflow
   * @param workflowId - Workflow ID
   * @param cronExpression - Cron expression (e.g., "0 2 * * *" for daily at 2am)
   */
  async registerWorkflowCron(
    workflowId: string,
    cronExpression: string,
  ): Promise<void> {
    const jobName = `workflow-${workflowId}`;

    // Remove existing job if it exists
    try {
      const existingJob = this.schedulerRegistry.getCronJob(jobName);
      if (existingJob) {
        existingJob.stop();
        this.schedulerRegistry.deleteCronJob(jobName);
        this.logger.log(`Removed existing cron job for workflow ${workflowId}`);
      }
    } catch (error) {
      // Job doesn't exist, continue
    }

    // Create new cron job
    const job = new CronJob(cronExpression, async () => {
      await this.executeScheduledWorkflow(workflowId);
    });

    // Register and start the job
    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();

    this.logger.log(
      `Registered cron job for workflow ${workflowId} with schedule "${cronExpression}"`,
    );
  }

  /**
   * Unregister a cron job for a specific workflow
   * @param workflowId - Workflow ID
   */
  async unregisterWorkflowCron(workflowId: string): Promise<void> {
    const jobName = `workflow-${workflowId}`;

    try {
      const job = this.schedulerRegistry.getCronJob(jobName);
      if (job) {
        job.stop();
        this.schedulerRegistry.deleteCronJob(jobName);
        this.logger.log(`Unregistered cron job for workflow ${workflowId}`);
      }
    } catch (error) {
      this.logger.warn(`No cron job found for workflow ${workflowId}`);
    }
  }

  /**
   * Execute a scheduled workflow
   * Called by cron job at scheduled time
   */
  private async executeScheduledWorkflow(workflowId: string): Promise<void> {
    this.logger.log(`Executing scheduled workflow ${workflowId}`);

    try {
      // Get workflow details
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow) {
        this.logger.error(`Workflow ${workflowId} not found, skipping execution`);
        return;
      }

      if (!workflow.enabled) {
        this.logger.warn(`Workflow ${workflowId} is disabled, skipping execution`);
        return;
      }

      const existing = await this.prisma.workflowExecution.findFirst({
        where: {
          workflowId: workflow.id,
          status: { in: ['PENDING', 'RUNNING'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true },
      });
      if (existing) {
        this.logger.warn(
          `Workflow ${workflowId} already has a ${existing.status} execution (${existing.id}); skipping scheduled run`,
        );
        return;
      }

      const config = workflow.config as any;
      // Prefer workflow-level date range; fall back to legacy per-source config
      const dateRangeConfig =
        config.dateRange ||
        config.sources?.meta?.dateRange ||
        config.sources?.pos?.dateRange;
      if (!dateRangeConfig) {
        this.logger.error(`No date range configured for workflow ${workflowId}`);
        return;
      }

      const calculatedRange = this.dateRangeService.calculateDateRange(dateRangeConfig);

      // Create execution record
      const execution = await this.prisma.workflowExecution.create({
        data: {
          workflowId: workflow.id,
          tenantId: workflow.tenantId,
          teamId: workflow.teamId,
          triggerType: WorkflowTriggerType.SCHEDULED,
          status: 'PENDING',
          dateRangeSince: calculatedRange.since,
          dateRangeUntil: calculatedRange.until,
        },
      });

      this.logger.log(
        `Created execution ${execution.id} for scheduled workflow ${workflowId}`,
      );

      const inlinePreferred =
        process.env.WORKFLOW_PROCESS_INLINE === 'true' ||
        process.env.NODE_ENV === 'development';

      let enqueued = false;

      if (!inlinePreferred) {
        try {
          await this.workflowQueue.add({
            executionId: execution.id,
            tenantId: workflow.tenantId,
            workflowId: workflow.id,
            // teamId is kept in DB; cls will set from execution record
          });
          enqueued = true;
        } catch (error) {
          this.logger.error(
            `Failed to enqueue execution ${execution.id}, falling back to inline processing: ${error?.message}`,
            error.stack,
          );
        }
      }

      if (!enqueued) {
        this.runExecutionInline(execution.id);
      }

      if (enqueued) {
        this.logger.log(
          `Enqueued execution ${execution.id} for processing`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to execute scheduled workflow ${workflowId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Update workflow schedule
   * Re-registers cron job with new schedule
   */
  async updateWorkflowSchedule(
    workflowId: string,
    cronExpression: string | null,
    enabled: boolean,
  ): Promise<void> {
    // Unregister existing cron if it exists
    await this.unregisterWorkflowCron(workflowId);

    // Register new cron if schedule exists and workflow is enabled
    if (cronExpression && enabled) {
      await this.registerWorkflowCron(workflowId, cronExpression);
    }
  }

  /**
   * Inline fallback when queue is unavailable
   */
  private runExecutionInline(executionId: string) {
    setImmediate(async () => {
      try {
        await this.workflowProcessor.processWorkflowExecution(executionId);
      } catch (error) {
        this.logger.error(
          `Inline scheduled execution ${executionId} failed: ${error?.message}`,
          error?.stack,
        );
        await this.prisma.workflowExecution.update({
          where: { id: executionId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errors: [
              {
                date: 'N/A',
                source: 'system',
                error: error?.message || 'Inline scheduled execution failed',
              },
            ],
          },
        });
      }
    });
  }
}
