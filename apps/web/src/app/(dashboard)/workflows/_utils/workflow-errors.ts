type ApiLikeError = {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
};

export function parseWorkflowError(error: unknown, fallback: string) {
  const apiError = error as ApiLikeError;
  return apiError?.response?.data?.message || apiError?.message || fallback;
}
