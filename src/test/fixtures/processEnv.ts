/** Partial process.env for tests without requiring full NodeJS.ProcessEnv. */
export function testProcessEnv(
  partial: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? "test",
    ...partial,
  };
}
