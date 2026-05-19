import { afterEach, describe, expect, it } from "vitest";

/** Mirrors scripts/ops/lib/e2e-seed-guard.mjs */
function isLocalSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

function assertE2eSeedAllowed(env: NodeJS.ProcessEnv): void {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.trim()) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) for E2E seed.");
  }
  if (isLocalSupabaseUrl(url)) return;

  const vercel = env.VERCEL_ENV?.trim().toLowerCase();
  const appEnv = (env.APP_ENV ?? env.NEXT_PUBLIC_APP_ENV ?? env.E2E_SEED_ENV)
    ?.trim()
    .toLowerCase();
  if (
    (vercel === "production" || appEnv === "production") &&
    env.CONFIRM_E2E_SEED_PRODUCTION !== "yes"
  ) {
    throw new Error(
      "E2E seed is blocked on production. Set CONFIRM_E2E_SEED_PRODUCTION=yes to run explicitly.",
    );
  }

  if (env.CONFIRM_E2E_SEED_REMOTE !== "yes") {
    throw new Error(
      "Remote Supabase detected. E2E seed is allowed on localhost only, or set CONFIRM_E2E_SEED_REMOTE=yes (staging) or CONFIRM_E2E_SEED_PRODUCTION=yes (production).",
    );
  }
}

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("E2E seed production guard", () => {
  it("allows local Supabase without extra confirmation", () => {
    expect(() =>
      assertE2eSeedAllowed({
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "key",
      }),
    ).not.toThrow();
  });

  it("blocks remote seed without confirmation", () => {
    expect(() =>
      assertE2eSeedAllowed({
        SUPABASE_URL: "https://abc.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "key",
      }),
    ).toThrow(/CONFIRM_E2E_SEED_REMOTE/);
  });

  it("blocks production deploy target unless explicitly confirmed", () => {
    expect(() =>
      assertE2eSeedAllowed({
        SUPABASE_URL: "https://abc.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "key",
        VERCEL_ENV: "production",
        CONFIRM_E2E_SEED_REMOTE: "yes",
      }),
    ).toThrow(/CONFIRM_E2E_SEED_PRODUCTION/);
  });
});
