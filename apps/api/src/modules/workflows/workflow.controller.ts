import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  WorkflowResponseDto,
  WorkflowExecutionResponseDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TeamGuard } from '../../common/guards/team.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('workflows')
@UseGuards(JwtAuthGuard, TenantGuard, TeamGuard, PermissionsGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  /**
   * Create a new workflow
   * Requires workflow.create permission
   */
  @Post()
  @Permissions('workflow.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createWorkflowDto: CreateWorkflowDto,
  ): Promise<WorkflowResponseDto> {
    return this.workflowService.create(createWorkflowDto);
  }

  /**
   * Get all workflows for the current tenant
   */
  @Get()
  @Permissions('workflow.read')
  async findAll(): Promise<WorkflowResponseDto[]> {
    return this.workflowService.findAll();
  }

  /**
   * Get a single execution by ID (no workflowId required)
   */
  @Get('executions/:executionId')
  @Permissions('workflow.view_executions')
  async getExecutionById(
    @Param('executionId') executionId: string,
  ): Promise<WorkflowExecutionResponseDto> {
    return this.workflowService.getExecution(executionId);
  }

  /**
   * Get execution logs by ID
   */
  @Get('executions/:executionId/logs')
  @Permissions('workflow.view_executions')
  async getExecutionLogs(
    @Param('executionId') executionId: string,
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    const safeLimit = limit ? parseInt(limit, 10) : 200;
    return this.workflowService.getExecutionLogs(executionId, safeLimit);
  }

  /**
   * Get workflow by ID
   */
  @Get(':id')
  @Permissions('workflow.read')
  async findOne(@Param('id') id: string): Promise<WorkflowResponseDto> {
    return this.workflowService.findOne(id);
  }

  /**
   * Update a workflow
   * Requires workflow.update permission
   */
  @Patch(':id')
  @Permissions('workflow.update')
  async update(
    @Param('id') id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
  ): Promise<WorkflowResponseDto> {
    return this.workflowService.update(id, updateWorkflowDto);
  }

  /**
   * Delete a workflow
   * Requires workflow.delete permission
   */
  @Delete(':id')
  @Permissions('workflow.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.workflowService.remove(id);
  }

  /**
   * Enable a workflow
   * Requires workflow.update permission
   */
  @Post(':id/enable')
  @Permissions('workflow.update')
  async enable(@Param('id') id: string): Promise<WorkflowResponseDto> {
    return this.workflowService.enable(id);
  }

  /**
   * Disable a workflow
   * Requires workflow.update permission
   */
  @Post(':id/disable')
  @Permissions('workflow.update')
  async disable(@Param('id') id: string): Promise<WorkflowResponseDto> {
    return this.workflowService.disable(id);
  }

  /**
   * Get all executions for a workflow
   */
  @Get(':id/executions')
  @Permissions('workflow.view_executions')
  async getExecutions(
    @Param('id') workflowId: string,
  ): Promise<WorkflowExecutionResponseDto[]> {
    return this.workflowService.getExecutions(workflowId);
  }

  /**
   * Get a single execution by ID
   */
  @Get(':workflowId/executions/:executionId')
  @Permissions('workflow.view_executions')
  async getExecution(
    @Param('executionId') executionId: string,
  ): Promise<WorkflowExecutionResponseDto> {
    return this.workflowService.getExecution(executionId);
  }

  /**
   * Manually trigger a workflow execution
   * Requires workflow.execute permission
   */
  @Post(':id/trigger')
  @Permissions('workflow.execute')
  @HttpCode(HttpStatus.CREATED)
  async triggerManual(
    @Param('id') workflowId: string,
    @Body() body?: { dateRangeSince?: string; dateRangeUntil?: string },
  ): Promise<WorkflowExecutionResponseDto> {
    return this.workflowService.triggerManual(
      workflowId,
      body?.dateRangeSince,
      body?.dateRangeUntil,
    );
  }

  /**
   * Cancel a running workflow execution
   * Requires workflow.execute permission
   */
  @Post(':workflowId/executions/:executionId/cancel')
  @Permissions('workflow.execute')
  async cancelExecution(
    @Param('executionId') executionId: string,
  ): Promise<WorkflowExecutionResponseDto> {
    return this.workflowService.cancelExecution(executionId);
  }
}
