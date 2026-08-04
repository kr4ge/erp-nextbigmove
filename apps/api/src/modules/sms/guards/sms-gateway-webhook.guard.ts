import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { SMS_GATEWAY_SIGNATURE_TOLERANCE_SECONDS } from '../sms.constants';

@Injectable()
export class SmsGatewayWebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const timestamp = this.readHeader(request, 'x-sms-timestamp');
    const nonce = this.readHeader(request, 'x-sms-nonce');
    const signature = this.readHeader(request, 'x-sms-signature');
    const secret = this.config.get<string>('SMS_GATEWAY_WEBHOOK_SECRET');

    if (!timestamp || !nonce || !signature || !secret || !request.rawBody) {
      throw new UnauthorizedException('Invalid SMS gateway signature');
    }

    const timestampSeconds = Number(timestamp);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isFinite(timestampSeconds)
      || Math.abs(nowSeconds - timestampSeconds) > SMS_GATEWAY_SIGNATURE_TOLERANCE_SECONDS
    ) {
      throw new UnauthorizedException('Expired SMS gateway signature');
    }

    const signedPayload = `${timestamp}.${nonce}.${request.rawBody.toString('utf8')}`;
    const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (
      signatureBuffer.length !== expectedBuffer.length
      || !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid SMS gateway signature');
    }

    return true;
  }

  private readHeader(request: Request, key: string) {
    const value = request.headers[key];
    return Array.isArray(value) ? value[0] : value;
  }
}
