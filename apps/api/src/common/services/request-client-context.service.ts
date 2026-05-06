import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { WmsStaffActivityPlatform } from '@prisma/client';

export type ResolvedClientContext = {
  platform: WmsStaffActivityPlatform;
  deviceId: string | null;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

@Injectable()
export class RequestClientContextService {
  resolve(request?: Request | null): ResolvedClientContext {
    const platformHeader = this.readHeader(request, 'x-client-platform');
    const forwardedFor = this.readHeader(request, 'x-forwarded-for');
    const userAgent = this.readHeader(request, 'user-agent');
    const ipAddress = forwardedFor?.split(',')[0]?.trim()
      || request?.ip
      || request?.socket?.remoteAddress
      || null;

    return {
      platform:
        platformHeader?.toLowerCase() === 'stox'
          ? WmsStaffActivityPlatform.STOX
          : WmsStaffActivityPlatform.WEB,
      deviceId: this.readHeader(request, 'x-device-id'),
      deviceName: this.readHeader(request, 'x-device-name'),
      ipAddress,
      userAgent,
    };
  }

  private readHeader(request: Request | null | undefined, key: string) {
    const headerValue = request?.headers?.[key];
    if (Array.isArray(headerValue)) {
      return headerValue[0] ?? null;
    }

    return typeof headerValue === 'string' && headerValue.trim().length > 0
      ? headerValue.trim()
      : null;
  }
}
