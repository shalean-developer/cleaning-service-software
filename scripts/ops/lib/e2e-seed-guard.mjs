/**
 * Blocks E2E seed from polluting production unless explicitly confirmed.
 */

export function isLocalSupabaseUrl(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

function isProductionDeployTarget() {
  const vercel = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (vercel === "production") return true;
  const appEnv = (
    process.env.APP_ENV ??
    process.env.NEXT_PUBLIC_APP_ENV ??
    process.env.E2E_SEED_ENV
  )
    ?.trim()
    .toLowerCase();
  return appEnv === "production";
}

/**
 * @throws {Error} when seed must not run
 */
export function assertE2eSeedAllowed() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.trim()) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) for E2E seed.");
  }

  if (isLocalSupabaseUrl(url)) return;

  if (isProductionDeployTarget() && process.env.CONFIRM_E2E_SEED_PRODUCTION !== "yes") {
    throw new Error(
      "E2E seed is blocked on production. Set CONFIRM_E2E_SEED_PRODUCTION=yes to run explicitly.",
    );
  }

  if (process.env.CONFIRM_E2E_SEED_REMOTE !== "yes") {
    throw new Error(
      "Remote Supabase detected. E2E seed is allowed on localhost only, or set CONFIRM_E2E_SEED_REMOTE=yes (staging) or CONFIRM_E2E_SEED_PRODUCTION=yes (production).",
    );
  }
}
