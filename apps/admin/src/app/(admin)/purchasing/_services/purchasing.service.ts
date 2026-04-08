import apiClient from '@/lib/api-client';
import type { CreateWmsStockReceiptInput, WmsStockReceipt } from '../_types/purchasing';

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (
      error as { response?: { data?: { message?: string | string[] } } }
    ).response;
    const message = response?.data?.message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message) && message.length > 0) {
      return message.join(', ');
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function fetchStockReceipts() {
  const response = await apiClient.get<WmsStockReceipt[]>('/wms/purchasing/receipts');
  return response.data;
}

export async function createStockReceipt(payload: CreateWmsStockReceiptInput) {
  try {
    const response = await apiClient.post<WmsStockReceipt>('/wms/purchasing/receipts', payload);
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, 'Unable to post stock receipt.'),
    );
  }
}
