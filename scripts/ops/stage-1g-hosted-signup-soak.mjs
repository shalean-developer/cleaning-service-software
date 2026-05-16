/**
 * Stage 1G hosted staging soak — pages + signUp against deployed origin.
 * Usage: HOSTED_STAGING_URL=https://your-preview.vercel.app node scripts/ops/stage-1g-hosted-signup-soak.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

loadEnvLocal();

const hostedUrl = (process.env.HOSTED_STAGING_URL ?? "").replace(/\/$/, "");
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const runId = randomUUID().slice(0, 8);
const email = `test_stage1g_hosted_${runId}@shalean.co.za`;
const password = `TestSoak1G!${runId}`;
const fullName = "Stage 1G Hosted Soak";

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  const icon = pass ? "PASS" : "FAIL";
  console.log(`[${icon}] ${name}${detail ? `: ${detail}` : ""}`);
}

async function fetchPage(path) {
  const res = await fetch(`${hostedUrl}${path}`, { redirect: "manual" });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  if (!hostedUrl) {
    console.error("Set HOSTED_STAGING_URL to the Vercel preview or staging alias.");
    process.exit(1);
  }
  if (!url || !anonKey || !serviceKey) {
    console.error("Missing Supabase env vars.");
    process.exit(1);
  }

  console.log(`Hosted URL: ${hostedUrl}`);
  console.log(`Supabase project: ${url}\n`);

  // UI checks
  try {
    const signIn = await fetchPage("/sign-in");
    record(
      "/sign-in shows Create one (ENABLE_CUSTOMER_SIGNUP + 1D deployed)",
      signIn.text.includes("Create one"),
      `status=${signIn.status}`,
    );
    record("/sign-in loads", signIn.status === 200, `status=${signIn.status}`);
  } catch (e) {
    record("/sign-in loads", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const signUp = await fetchPage("/sign-up");
    const hasForm = signUp.text.includes("Create account");
    const hasUnavailable = signUp.text.includes("not available yet");
    record(
      "/sign-up loads (form or unavailable)",
      signUp.status === 200 && (hasForm || hasUnavailable),
      `status=${signUp.status} form=${hasForm} unavailable=${hasUnavailable}`,
    );
    record("/sign-up route exists (not 404)", signUp.status !== 404, `status=${signUp.status}`);
  } catch (e) {
    record("/sign-up loads", false, e instanceof Error ? e.message : String(e));
  }

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const redirectTo = `${hostedUrl}/auth/callback`;
  const { data: signUpData, error: signUpError } = await anon.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: "admin" },
      emailRedirectTo: redirectTo,
    },
  });

  if (signUpError) {
    const redirectBlocked = /redirect|url|invalid/i.test(signUpError.message);
    record("New user can sign up (Supabase)", false, signUpError.message);
    record(
      "Auth redirect URL allows hosted /auth/callback",
      !redirectBlocked,
      redirectBlocked ? signUpError.message : "signup blocked for other reason",
    );
  } else {
    record("New user can sign up (Supabase)", true, email);
    record("Auth redirect URL allows hosted /auth/callback", true, redirectTo);
  }

  const userId = signUpData?.user?.id;
  if (userId) {
    const { data: profile } = await service
      .from("profiles")
      .select("role, full_name")
      .eq("id", userId)
      .maybeSingle();
    record("Profile row created", Boolean(profile?.role), `role=${profile?.role ?? "null"}`);
    record(
      "Role escalation blocked",
      profile?.role === "customer",
      profile?.role ?? "no profile",
    );

    const { data: customer } = await service
      .from("customers")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();
    record("Customer row created", Boolean(customer?.id), customer?.id ?? "missing");

    if (signUpData.session) {
      const { error: signInError } = await anon.auth.signInWithPassword({ email, password });
      record("Sign-in after signup", !signInError, signInError?.message ?? "");
    }

    record(
      "Booking lock gate (customers row)",
      Boolean(customer?.id),
      customer?.id ? "provisioned" : "PROVISIONING_INCOMPLETE risk",
    );

    for (const path of ["/customer", "/customer/book"]) {
      try {
        const page = await fetchPage(path);
        record(
          `GET ${path} (unauthenticated)`,
          page.status === 307 || page.status === 308 || page.status === 302,
          `status=${page.status}`,
        );
      } catch (e) {
        record(`GET ${path}`, false, e instanceof Error ? e.message : String(e));
      }
    }

    try {
      await service.from("customers").delete().eq("profile_id", userId);
      await service.from("profiles").delete().eq("id", userId);
      await service.auth.admin.deleteUser(userId);
      record("Test user cleanup", true, userId);
    } catch (e) {
      record("Test user cleanup", false, e instanceof Error ? e.message : String(e));
    }
  }

  printSummary();
  process.exit(results.some((r) => !r.pass) ? 1 : 0);
}

function printSummary() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n--- Summary: ${results.length - failed.length}/${results.length} passed ---`);
  if (failed.length) {
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
