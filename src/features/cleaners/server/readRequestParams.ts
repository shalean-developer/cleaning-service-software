export async function readRequestParams(request: Request): Promise<Record<string, unknown>> {
  const url = new URL(request.url);
  const fromQuery: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    fromQuery[key] = value;
  });

  if (request.method === "GET") {
    return fromQuery;
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return fromQuery;
  }

  return { ...fromQuery, ...(body as Record<string, unknown>) };
}
