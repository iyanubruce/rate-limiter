export const createJsonResponse = (
  data: any,
  status: number = 200,
  headers: Record<string, string> = {},
) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
};

export const createErrorResponse = (
  error: string,
  status: number = 500,
  headers: Record<string, string> = {},
) => {
  return createJsonResponse({ error }, status, headers);
};
