import apiClient from '@/lib/api-client';
import type {
  SendSmsMessageInput,
  SmsConversation,
  SmsDevice,
  SmsEnrollmentResponse,
  SmsHeartbeatResponse,
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

export async function fetchSmsConversations(search?: string) {
  const response = await apiClient.get<SmsConversation[]>('/sms/conversations', {
    params: {
      limit: 100,
      ...(search?.trim() ? { search: search.trim() } : {}),
    },
  });
  return response.data;
}

export async function fetchSmsConversationMessages(conversationId: string) {
  const response = await apiClient.get<SmsMessage[]>(
    `/sms/conversations/${conversationId}/messages`,
    { params: { limit: 200 } },
  );
  return response.data;
}

export async function markSmsConversationRead(conversationId: string) {
  await apiClient.post(`/sms/conversations/${conversationId}/read`);
}

export async function checkSmsDeviceHeartbeat(deviceId: string) {
  const response = await apiClient.post<SmsHeartbeatResponse>(
    `/sms/devices/${deviceId}/heartbeat-check`,
  );
  return response.data;
}
