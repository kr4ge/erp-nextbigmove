import { isAxiosError } from 'axios';
import apiClient from '@/lib/api-client';
import type {
  UndeliverablesAssignmentsResponse,
  UndeliverableRemarkOptionsResponse,
  UndeliverablesResponse,
  UndeliverableRemarksResponse,
} from '../_types/undeliverables';

function parseUndeliverablesError(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message) && message.length > 0) {
      return String(message[0]);
    }
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

export async function fetchUndeliverables(params: {
  startDate: string;
  endDate: string;
  view?: 'needs_remarks' | 'with_remarks';
  storeIds?: string[];
  statuses?: string[];
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const response = await apiClient.get<UndeliverablesResponse>('/orders/undeliverables', {
      params: {
        start_date: params.startDate,
        end_date: params.endDate,
        ...(params.view ? { view: params.view } : {}),
        ...(params.storeIds && params.storeIds.length > 0 ? { store_id: params.storeIds } : {}),
        ...(params.statuses && params.statuses.length > 0 ? { status: params.statuses } : {}),
        ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        ...(params.page ? { page: params.page } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(parseUndeliverablesError(error, 'Failed to load undeliverables.'));
  }
}

export async function fetchUndeliverableAssignments() {
  try {
    const response = await apiClient.get<UndeliverablesAssignmentsResponse>('/orders/undeliverables/assignments');
    return response.data;
  } catch (error) {
    throw new Error(parseUndeliverablesError(error, 'Failed to load undeliverables assignments.'));
  }
}

export async function saveUndeliverableAssignments(userId: string, storeIds: string[]) {
  try {
    const response = await apiClient.put<{ success: boolean; user_id: string; store_ids: string[] }>(
      `/orders/undeliverables/assignments/${userId}`,
      { storeIds },
    );
    return response.data;
  } catch (error) {
    throw new Error(parseUndeliverablesError(error, 'Failed to save undeliverables assignments.'));
  }
}

export async function fetchUndeliverableRemarks(orderId: string) {
  try {
    const response = await apiClient.get<UndeliverableRemarksResponse>(`/orders/undeliverables/${orderId}/remarks`);
    return response.data;
  } catch (error) {
    throw new Error(parseUndeliverablesError(error, 'Failed to load undeliverables remarks.'));
  }
}

export async function fetchUndeliverableRemarkOptions() {
  try {
    const response = await apiClient.get<UndeliverableRemarkOptionsResponse>('/orders/undeliverables/remark-options');
    return response.data;
  } catch (error) {
    throw new Error(parseUndeliverablesError(error, 'Failed to load undeliverables remark options.'));
  }
}

export async function createUndeliverableRemark(orderId: string, remarkOptionId: string) {
  try {
    const response = await apiClient.post(`/orders/undeliverables/${orderId}/remarks`, { remarkOptionId });
    return response.data;
  } catch (error) {
    throw new Error(parseUndeliverablesError(error, 'Failed to create undeliverables remark.'));
  }
}

export async function updateUndeliverableRemark(remarkId: string, remarkOptionId: string) {
  try {
    const response = await apiClient.patch(`/orders/undeliverables/remarks/${remarkId}`, { remarkOptionId });
    return response.data;
  } catch (error) {
    throw new Error(parseUndeliverablesError(error, 'Failed to update undeliverables remark.'));
  }
}

export async function deleteUndeliverableRemark(remarkId: string) {
  try {
    const response = await apiClient.post(`/orders/undeliverables/remarks/${remarkId}/delete`);
    return response.data;
  } catch (error) {
    throw new Error(parseUndeliverablesError(error, 'Failed to delete undeliverables remark.'));
  }
}

export async function createUndeliverableRemarkOption(remark: string) {
  try {
    const response = await apiClient.post('/orders/undeliverables/remark-options', { remark });
    return response.data;
  } catch (error) {
    throw new Error(parseUndeliverablesError(error, 'Failed to create undeliverables remark option.'));
  }
}

export async function updateUndeliverableRemarkOption(remarkOptionId: string, remark: string) {
  try {
    const response = await apiClient.patch(`/orders/undeliverables/remark-options/${remarkOptionId}`, { remark });
    return response.data;
  } catch (error) {
    throw new Error(parseUndeliverablesError(error, 'Failed to update undeliverables remark option.'));
  }
}

export async function deleteUndeliverableRemarkOption(remarkOptionId: string) {
  try {
    const response = await apiClient.post(`/orders/undeliverables/remark-options/${remarkOptionId}/delete`);
    return response.data;
  } catch (error) {
    throw new Error(parseUndeliverablesError(error, 'Failed to delete undeliverables remark option.'));
  }
}
