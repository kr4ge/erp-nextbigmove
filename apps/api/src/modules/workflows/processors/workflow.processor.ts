import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed, OnQueueStalled } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { WorkflowProcessorService } from '../services/workflow-processor.service';
import { WORKFLOW_QUEUE, WorkflowJobData } from '../workflow.constants';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { WorkflowExecutionStatus } from '@prisma/client';

@Processor(WORKFLOW_QUEUE)
export class WorkflowQueueProcessor {
  private readonly logger = new Logger(WorkflowQueueProcessor.name);

  constructor(
    private readonly workflowProcessor: WorkflowProcessorService,
    private readonly prisma: PrismaService,
  ) {}

  @Process()
  async handleWorkflowExecution(job: Job<WorkflowJobData>) {
    const { executionId, tenantId, workflowId } = job.data;

    this.logger.log(
      `Processing workflow execution job ${job.id} for execution ${executionId}`,
    );

    try {
      // Check if execution was cancelled before starting
      // The processor will handle status checks internally

      await this.workflowProcessor.processWorkflowExecution(executionId);

      this.logger.log(
        `Successfully completed workflow execution ${executionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process workflow execution ${executionId}: ${error.message}`,
        error.stack,
      );

      // Re-throw to mark job as failed
      throw error;
    }
  }

  @OnQueueActive()
  async onActive(job: Job<WorkflowJobData>) {
    const executionId = job.data?.executionId;
    if (!executionId) return;

    try {
      const execution = await this.prisma.workflowExecution.findUnique({
        where: { id: executionId },
        select: { status: true, startedAt: true },
      });

      if (!execution) return;

      if (execution.status === WorkflowExecutionStatus.PENDING) {
        await this.prisma.workflowExecution.update({
          where: { id: executionId },
          data: {
            status: WorkflowExecutionStatus.RUNNING,
            startedAt: execution.startedAt || new Date(),
          },
        });
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to mark execution ${executionId} as RUNNING from queue active: ${error?.message}`,
      );
    }
  }

  @OnQueueCompleted()
  async onCompleted(job: Job<WorkflowJobData>) {
    const executionId = job.data?.executionId;
    if (!executionId) return;

    try {
      const execution = await this.prisma.workflowExecution.findUnique({
        where: { id: executionId },
        select: { status: true, startedAt: true },
      });

      if (!execution) return;

      if (
        execution.status === WorkflowExecutionStatus.COMPLETED ||
        execution.status === WorkflowExecutionStatus.FAILED ||
        execution.status === WorkflowExecutionStatus.CANCELLED
      ) {
        return;
      }

      const completedAt = new Date();
      const startedAt = execution.startedAt || completedAt;
      const duration = completedAt.getTime() - startedAt.getTime();

      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: WorkflowExecutionStatus.COMPLETED,
          completedAt,
          duration,
        },
      });
    } catch (error: any) {
      this.logger.warn(
        `Failed to mark execution ${executionId} as COMPLETED from queue: ${error?.message}`,
      );
    }
  }

  @OnQueueFailed()
  async onFailed(job: Job<WorkflowJobData>, error: any) {
    const executionId = job.data?.executionId;
    if (!executionId) return;

    try {
      const execution = await this.prisma.workflowExecution.findUnique({
        where: { id: executionId },
        select: { status: true, startedAt: true, errors: true },
      });

      if (!execution) return;

      if (
        execution.status === WorkflowExecutionStatus.FAILED ||
        execution.status === WorkflowExecutionStatus.CANCELLED ||
        execution.status === WorkflowExecutionStatus.COMPLETED
      ) {
        return;
      }

      const completedAt = new Date();
      const startedAt = execution.startedAt || completedAt;
      const duration = completedAt.getTime() - startedAt.getTime();
      const existingErrors = Array.isArray(execution.errors) ? execution.errors : [];

      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: WorkflowExecutionStatus.FAILED,
          completedAt,
          duration,
          errors: [
            ...existingErrors,
            {
              date: 'N/A',
              source: 'queue',
              error: error?.message || 'Queue job failed',
              jobId: job.id,
            },
          ],
        },
      });
    } catch (err: any) {
      this.logger.warn(
        `Failed to mark execution ${executionId} as FAILED from queue: ${err?.message}`,
      );
    }
  }

  @OnQueueStalled()
  async onStalled(job: Job<WorkflowJobData>) {
    const executionId = job.data?.executionId;
    if (!executionId) return;
    this.logger.warn(`Workflow job stalled for execution ${executionId} (job ${job.id})`);
  }
}
