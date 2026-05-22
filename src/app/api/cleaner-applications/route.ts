import { submitCleanerApplication } from "@/features/cleaner-applications/server/submitCleanerApplication";
import { cleanerApplicationSubmitSchema } from "@/features/cleaner-applications/schema";
import { clientIpFromRequest, checkSimpleRateLimit } from "@/lib/http/simpleRateLimit";

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limit = checkSimpleRateLimit(`cleaner-apply:${ip}`, 8, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json(
      {
        ok: false,
        error: "RATE_LIMITED",
        message: "Too many applications from this network. Please try again later.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = cleanerApplicationSubmitSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      {
        ok: false,
        error: "INVALID_PAYLOAD",
        message: first?.message ?? "Invalid application.",
      },
      { status: 400 },
    );
  }

  const result = await submitCleanerApplication(parsed.data);

  if (!result.ok) {
    const status =
      result.code === "SPAM_REJECTED"
        ? 400
        : result.code === "INVALID_PHONE" || result.code === "INVALID_EMAIL"
          ? 400
          : 500;
    return Response.json(
      { ok: false, error: result.code, message: result.message },
      { status },
    );
  }

  return Response.json({
    ok: true,
    status: result.status,
    duplicateLikely: result.duplicateLikely,
    message: result.message,
  });
}
