import axios from 'axios';

export function parseRequestError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim().length > 0) return message;
    if (typeof error.message === 'string' && error.message.trim().length > 0) return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

