import apiClient from '@/lib/api-client';
import type {
  SendSmsMessageInput,
  SmsDevice,
  SmsEnrollmentResponse,
  SmsMessage,
  SmsOverviewResponse,
} from '../_types/sms';

export async function fetchSmsOverview() {
  const response = await apiClient.get<SmsOverviewResponse>('/sms/overview');
  return response.data;
}

export async function fetchSmsDevices() {
  const response = await apiClient.get<SmsDevice[]>('/sms/devices');
  return response.data;
}

export async function createSmsDeviceEnrollment() {
  const response = await apiClient.post<SmsEnrollmentResponse>(
    '/sms/devices/enrollment',
  );
  return response.data;
}

export async function sendSmsMessage(payload: SendSmsMessageInput) {
  const response = await apiClient.post<SmsMessage>('/sms/messages', payload);
  return response.data;
}
