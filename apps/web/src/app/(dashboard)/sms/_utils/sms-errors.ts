export function parseSmsError(error: unknown, fallback: string) {
  const candidate = error as {
    response?: {
      status?: number;
      data?: { message?: string | string[] };
    };
    message?: string;
  };
  const responseMessage = candidate.response?.data?.message;
  const message = Array.isArray(responseMessage)
    ? responseMessage.join(', ')
    : responseMessage || candidate.message;

  if (!message) {
    return fallback;
  }

  return candidate.response?.status
    ? `${message} (HTTP ${candidate.response.status})`
    : message;
}
