import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type DispatchMessage = {
  messageId: string;
  tenantId: string;
  externalDeviceId: string;
  externalSimId: string;
  subscriptionId: string;
  senderPhone: string;
  recipientPhone: string;
  body: string;
  expiresAt: string | null;
  idempotencyKey: string;
};

type DispatchResponse = {
  gatewayMessageId: string;
  acceptedAt: string;
};

type EnrollmentResponse = {
  enrollmentToken: string;
  expiresAt: string;
};

@Injectable()
export class SmsGatewayClient {
  constructor(private readonly config: ConfigService) {}

  async createEnrollment(tenantId: string): Promise<EnrollmentResponse> {
    const { baseUrl, apiKey, timeoutMs } = this.getConfiguration();
    const response = await fetch(`${baseUrl}/api/v1/enrollments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ tenantId }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(
        `SMS gateway rejected enrollment (${response.status}): ${responseBody.slice(0, 500)}`,
      );
    }

    return response.json() as Promise<EnrollmentResponse>;
  }

  async dispatch(message: DispatchMessage): Promise<DispatchResponse> {
    const { baseUrl, apiKey, timeoutMs } = this.getConfiguration();

    const response = await fetch(`${baseUrl}/api/v1/messages/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': message.idempotencyKey,
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`SMS gateway rejected dispatch (${response.status}): ${responseBody.slice(0, 500)}`);
    }

    return response.json() as Promise<DispatchResponse>;
  }

  private getConfiguration() {
    const baseUrl = this.config.get<string>('SMS_GATEWAY_BASE_URL')?.replace(/\/+$/, '');
    const apiKey = this.config.get<string>('SMS_GATEWAY_API_KEY');
    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException('SMS gateway is not configured');
    }

    return {
      baseUrl,
      apiKey,
      timeoutMs: Number(this.config.get<string>('SMS_GATEWAY_REQUEST_TIMEOUT_MS') ?? 15000),
    };
  }
}
