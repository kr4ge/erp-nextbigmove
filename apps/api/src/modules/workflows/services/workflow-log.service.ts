import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class WorkflowLogService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(params: {
    executionId: string;
    tenantId: string;
    level: 'info' | 'warn' | 'error';
    event: string;
    message: string;
    metadata?: any;
  }) {
    const { executionId, tenantId, level, event, message, metadata } = params;
    // Use any cast to avoid type mismatch until Prisma client is regenerated
    const client: any = this.prisma as any;
    return client.workflowExecutionLog.create({
      data: {
        executionId,
        tenantId,
        level,
        event,
        message,
        metadata: metadata || {},
      },
    });
  }

  async getExecutionLogs(executionId: string, tenantId: string) {
    const client: any = this.prisma as any;
    return client.workflowExecutionLog.findMany({
      where: { executionId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
