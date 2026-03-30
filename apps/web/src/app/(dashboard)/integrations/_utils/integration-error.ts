export const parseIntegrationErrorMessage = (error: unknown): string => {
  const err = error as {
    response?: { data?: unknown };
    data?: unknown;
    message?: string;
  };
  const data = err?.response?.data || err?.data;

  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      // keep raw string
    }
  }

  if (parsed && typeof parsed === 'object') {
    const parsedRecord = parsed as Record<string, unknown>;
    const message =
      typeof parsedRecord.message === 'string' ? parsedRecord.message : '';
    const errorCode = parsedRecord.error_code;

    if (errorCode === 105 || message.toLowerCase().includes('api_key is invalid')) {
      return 'Invalid API key. Please check your API key and try again.';
    }
    if (errorCode === 101 || message.toLowerCase().includes('unauthorized')) {
      return 'Unauthorized. Please check your credentials.';
    }
    if (message.toLowerCase().includes('missing api key')) {
      return 'Missing API key for this store. Please check your integration settings.';
    }
    if (message.toLowerCase().includes('not found')) {
      return 'Resource not found. Please verify your settings.';
    }
    if (message.toLowerCase().includes('rate limit')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (message) {
      return message;
    }
  }

  if (typeof error === 'string') {
    try {
      const jsonError = JSON.parse(error);
      if (jsonError.message) {
        return parseIntegrationErrorMessage({ data: jsonError });
      }
    } catch {
      return error;
    }
  }

  if (typeof err.message === 'string') {
    try {
      const jsonMsg = JSON.parse(err.message);
      return parseIntegrationErrorMessage({ data: jsonMsg });
    } catch {
      return err.message;
    }
  }

  return 'An unexpected error occurred. Please try again.';
};
