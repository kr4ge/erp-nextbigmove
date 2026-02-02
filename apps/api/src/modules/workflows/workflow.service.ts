import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamContextService } from '../../common/services/team-context.service';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  WorkflowResponseDto,
  WorkflowExecutionResponseDto,
} from './dto';
import { WorkflowTriggerType, WorkflowExecutionStatus } from '@prisma/client';
import * as cronParser from 'cron-parser';
import { WORKFLOW_QUEUE, WorkflowJobData } from './processors/workflow.processor';
import { DateRangeService } from './services/date-range.service';
import { WorkflowProcessorService } from './services/workflow-processor.service';
import { WorkflowSchedulerService } from './services/workflow-scheduler.service';
import { WorkflowLogService } from './services/workflow-log.service';

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
    @InjectQueue(WORKFLOW_QUEUE) private readonly workflowQueue: Queue<WorkflowJobData>,
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

    return new WorkflowExecutionResponseDto(execution);
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

    // Enqueue Bull job to process this execution (or inline fallback)
    const inlinePreferred =
      process.env.WORKFLOW_PROCESS_INLINE === 'true' ||
      process.env.NODE_ENV === 'development';

    let enqueued = false;

    if (!inlinePreferred) {
      try {
        await this.workflowQueue.add({
          executionId: execution.id,
          tenantId,
          workflowId,
        });
        enqueued = true;
      } catch (error) {
        this.logger.warn(
          `Queue enqueue failed for execution ${execution.id}, falling back to inline processing: ${error?.message}`,
        );
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
