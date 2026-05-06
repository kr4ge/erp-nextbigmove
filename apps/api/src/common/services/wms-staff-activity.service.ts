import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, WmsStaffActivityOutcome, WmsStaffActivityPlatform } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RequestClientContextService } from './request-client-context.service';

type RecordStaffActivityParams = {
  tenantId?: string | null;
  actorId?: string | null;
  teamId?: string | null;
  platform?: WmsStaffActivityPlatform;
  sessionId?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  actionType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  taskType?: string | null;
  taskId?: string | null;
  storeId?: string | null;
  warehouseId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  outcome?: WmsStaffActivityOutcome;
  reasonCode?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type RecordStaffActivityFromRequestParams = Omit<
  RecordStaffActivityParams,
  'platform' | 'deviceId' | 'deviceName' | 'ipAddress' | 'userAgent'
> & {
  request?: Request | null;
};

@Injectable()
export class WmsStaffActivityService {
  private readonly logger = new Logger(WmsStaffActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestClientContextService: RequestClientContextService,
  ) {}

  async record(params: RecordStaffActivityParams) {
    try {
      await this.prisma.wmsStaffActivity.create({
        data: {
          tenantId: params.tenantId ?? null,
          actorId: params.actorId ?? null,
          teamId: params.teamId ?? null,
          platform: params.platform,
          sessionId: params.sessionId ?? null,
          deviceId: params.deviceId ?? null,
          deviceName: params.deviceName ?? null,
          actionType: params.actionType,
          resourceType: params.resourceType ?? null,
          resourceId: params.resourceId ?? null,
          taskType: params.taskType ?? null,
          taskId: params.taskId ?? null,
          storeId: params.storeId ?? null,
          warehouseId: params.warehouseId ?? null,
          fromStatus: params.fromStatus ?? null,
          toStatus: params.toStatus ?? null,
          outcome: params.outcome,
          reasonCode: params.reasonCode ?? null,
          metadata: params.metadata ?? undefined,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to persist WMS staff activity for ${params.actionType}`);
      this.logger.debug(error instanceof Error ? error.stack : String(error));
    }
  }

  async recordFromRequest(params: RecordStaffActivityFromRequestParams) {
    const clientContext = this.requestClientContextService.resolve(params.request);

    await this.record({
      ...params,
      platform: clientContext.platform,
      deviceId: clientContext.deviceId,
      deviceName: clientContext.deviceName,
      ipAddress: clientContext.ipAddress,
      userAgent: clientContext.userAgent,
    });
  }
}
