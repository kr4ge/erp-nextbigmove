import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { WorkflowProcessorService } from '../services/workflow-processor.service';

export const WORKFLOW_QUEUE = 'workflow-execution';

export interface WorkflowJobData {
  executionId: string;
  tenantId: string;
  workflowId: string;
}

@Processor(WORKFLOW_QUEUE)
export class WorkflowQueueProcessor {
  private readonly logger = new Logger(WorkflowQueueProcessor.name);

  constructor(private readonly workflowProcessor: WorkflowProcessorService) {}

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
}
