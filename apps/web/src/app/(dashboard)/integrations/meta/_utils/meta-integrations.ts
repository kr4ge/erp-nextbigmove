type ApiLikeError = {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
};

export function parseMetaIntegrationError(error: unknown, fallback: string) {
  const apiError = error as ApiLikeError;
  return apiError?.response?.data?.message || apiError?.message || fallback;
}

export function formatMetaDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
