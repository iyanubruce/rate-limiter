export const createJsonResponse = (
  data: any,
  status: number = 200,
  headers: Record<string, string> = {},
  message?: string,
) => {
  let body: any;

  if (typeof data === "string") {
    body = { message: data };
  } else if (message) {
    body = { message, data };
  } else {
    body = data;
  }

  return new Response(JSON.stringify(body), {
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
