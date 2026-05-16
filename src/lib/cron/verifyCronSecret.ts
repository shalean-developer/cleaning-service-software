import "server-only";

/**
 * Validates cron invocations via Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 */
export function verifyCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${expected}`) return true;

  const headerSecret = request.headers.get("x-cron-secret");
  return headerSecret === expected;
}
