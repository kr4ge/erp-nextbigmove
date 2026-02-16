import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { WorkflowExecutionStatus } from '@prisma/client';
import { WORKFLOW_QUEUE, WorkflowJobData } from '../workflow.constants';
import { WorkflowProcessorService } from './workflow-processor.service';

@Injectable()
export class WorkflowExecutionReconcilerService {
  private readonly logger = new Logger(WorkflowExecutionReconcilerService.name);
  private readonly enabled = process.env.WORKFLOW_EXECUTION_RECONCILE_ENABLED !== 'false';
  private readonly staleMinutes = (() => {
    const value = Number(process.env.WORKFLOW_EXECUTION_STALE_MINUTES || 30);
    return Number.isFinite(value) && value > 0 ? value : 30;
  })();

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowProcessor: WorkflowProcessorService,
    @InjectQueue(WORKFLOW_QUEUE) private readonly workflowQueue: Queue<WorkflowJobData>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileStaleExecutions(): Promise<void> {
    if (!this.enabled) return;

    const cutoff = new Date(Date.now() - this.staleMinutes * 60 * 1000);

    const staleExecutions = await this.prisma.workflowExecution.findMany({
      where: {
        status: { in: [WorkflowExecutionStatus.PENDING, WorkflowExecutionStatus.RUNNING] },
        updatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        status: true,
        tenantId: true,
        workflowId: true,
        startedAt: true,
        createdAt: true,
        updatedAt: true,
        errors: true,
      },
    });

    if (staleExecutions.length === 0) return;

    this.logger.warn(
      `Reconciling ${staleExecutions.length} stale workflow executions older than ${this.staleMinutes} minutes`,
    );

    for (const execution of staleExecutions) {
      try {
        const job = await this.workflowQueue.getJob(execution.id);
        if (job) {
          const state = await job.getState();
          if (state === 'active') {
            if (execution.status !== WorkflowExecutionStatus.RUNNING) {
              await this.prisma.workflowExecution.update({
                where: { id: execution.id },
                data: { status: WorkflowExecutionStatus.RUNNING, startedAt: execution.startedAt || new Date() },
              });
            }
            continue;
          }

          if (state === 'waiting' || state === 'delayed' || state === 'paused') {
            if (execution.status !== WorkflowExecutionStatus.PENDING) {
              await this.prisma.workflowExecution.update({
                where: { id: execution.id },
                data: { status: WorkflowExecutionStatus.PENDING },
              });
            }
            continue;
          }

          if (state === 'completed') {
            const completedAt = new Date();
            const startedAt = execution.startedAt || completedAt;
            const duration = completedAt.getTime() - startedAt.getTime();
            await this.prisma.workflowExecution.update({
              where: { id: execution.id },
              data: {
                status: WorkflowExecutionStatus.COMPLETED,
                completedAt,
                duration,
              },
            });
            continue;
          }

          if (state === 'failed') {
            await this.markFailed(execution.id, execution.errors, 'Queue job failed');
            continue;
          }
        }

        if (execution.status === WorkflowExecutionStatus.RUNNING) {
          await this.markFailed(
            execution.id,
            execution.errors,
            `Stale RUNNING execution (no queue job, last update ${execution.updatedAt.toISOString()})`,
          );
          await this.enqueueNextPendingForTenant(execution.tenantId);
        } else {
          await this.tryEnqueuePending(execution.id, execution.tenantId, execution.workflowId);
        }
      } catch (error: any) {
        this.logger.warn(
          `Failed to reconcile execution ${execution.id}: ${error?.message}`,
        );
      }
    }
  }

  private async tryEnqueuePending(
    executionId: string,
    tenantId: string,
    workflowId: string,
  ): Promise<void> {
    const tenantRunning = await this.prisma.workflowExecution.findFirst({
      where: { tenantId, status: WorkflowExecutionStatus.RUNNING },
      select: { id: true },
    });

    if (tenantRunning) {
      return;
    }

    const inlinePreferred =
      process.env.WORKFLOW_PROCESS_INLINE === 'true' ||
      process.env.NODE_ENV === 'development';

    if (!inlinePreferred) {
      try {
        await this.workflowQueue.add(
          { executionId, tenantId, workflowId },
          { jobId: executionId },
        );
        await this.prisma.workflowExecution.update({
          where: { id: executionId },
          data: { updatedAt: new Date() },
        });
        return;
      } catch (error: any) {
        if (String(error?.message || '').includes('Job') && String(error?.message || '').includes('exists')) {
          return;
        }
        await this.markFailed(executionId, [], `Failed to enqueue pending execution: ${error?.message}`);
        return;
      }
    }

    setImmediate(async () => {
      try {
        await this.workflowProcessor.processWorkflowExecution(executionId);
      } catch (error: any) {
        this.logger.warn(
          `Inline reconcile execution ${executionId} failed: ${error?.message}`,
        );
      }
    });
  }

  private async enqueueNextPendingForTenant(tenantId: string): Promise<void> {
    const pending = await this.prisma.workflowExecution.findFirst({
      where: { tenantId, status: WorkflowExecutionStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      select: { id: true, workflowId: true, tenantId: true },
    });

    if (!pending) return;
    await this.tryEnqueuePending(pending.id, pending.tenantId, pending.workflowId);
  }

  private async markFailed(
    executionId: string,
    existingErrors: any,
    reason: string,
  ): Promise<void> {
    const completedAt = new Date();
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      select: { startedAt: true, errors: true },
    });
    const startedAt = execution?.startedAt || completedAt;
    const duration = completedAt.getTime() - startedAt.getTime();
    const errorsSource = Array.isArray(existingErrors) ? existingErrors : execution?.errors;
    const errors = Array.isArray(errorsSource) ? errorsSource : [];

    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: WorkflowExecutionStatus.FAILED,
        completedAt,
        duration,
        errors: [
          ...errors,
          {
            date: 'N/A',
            source: 'reconciler',
            error: reason,
          },
        ],
      },
    });
  }
}
