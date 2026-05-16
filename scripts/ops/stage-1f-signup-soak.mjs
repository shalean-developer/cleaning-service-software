/**
 * Stage 1F staging soak — exercises anon signUp (browser-equivalent) and DB verification.
 * Usage: node scripts/ops/stage-1f-signup-soak.mjs
 * Requires: .env.local loaded via dotenv or env vars already set.
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

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const runId = randomUUID().slice(0, 8);
const email = `test_stage1f_soak_${runId}@shalean.co.za`;
const password = `TestSoak1F!${runId}`;
const fullName = "Stage 1F Soak User";

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  const icon = pass ? "PASS" : "FAIL";
  console.log(`[${icon}] ${name}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  if (!url || !anonKey || !serviceKey) {
    console.error("Missing SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1–4: Sign up (browser-equivalent; includes role injection attempt)
  const { data: signUpData, error: signUpError } = await anon.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: "admin" },
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (signUpError) {
    record("New user can sign up", false, signUpError.message);
  } else {
    record("New user can sign up", true, email);
  }

  const userId = signUpData?.user?.id;
  const hasSession = Boolean(signUpData?.session);

  record(
    "Email confirmation path (session vs check-email)",
    true,
    hasSession
      ? "Session returned immediately (confirmations likely disabled)"
      : "No session (confirmations likely enabled — use check-email flow)",
  );

  if (!userId) {
    console.log("\nCannot continue DB checks without user id.");
    printSummary();
    process.exit(1);
  }

  // Profile row
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    record("Profile row is created", false, profileError?.message ?? "not found");
  } else {
    record("Profile row is created", true, `role=${profile.role}`);
    record(
      "Admin/cleaner cannot be created from signup metadata",
      profile.role === "customer",
      profile.role === "customer" ? "role forced to customer" : `got role=${profile.role}`,
    );
    record(
      "full_name metadata applied",
      profile.full_name === fullName,
      `full_name=${profile.full_name ?? "(null)"}`,
    );
  }

  // Customer row
  const { data: customer, error: customerError } = await service
    .from("customers")
    .select("id, profile_id, company_name")
    .eq("profile_id", userId)
    .maybeSingle();

  if (customerError || !customer) {
    record("Customer row is created", false, customerError?.message ?? "not found");
  } else {
    record("Customer row is created", true, `customers.id=${customer.id}`);
  }

  // Sign-in + acting customer (provisioned path for book/lock)
  if (hasSession) {
    const { error: signInError } = await anon.auth.signInWithPassword({ email, password });
    record("User can sign in after signup", !signInError, signInError?.message ?? "");
  } else {
    record("User can sign in after signup", false, "skipped — no session; confirm email first");
  }

  const {
    data: { user: sessionUser },
  } = await anon.auth.getUser();

  if (sessionUser && customer) {
    const { data: scopeCustomer } = await service
      .from("customers")
      .select("id")
      .eq("profile_id", sessionUser.id)
      .maybeSingle();

    record(
      "actingCustomerId would resolve (book/lock gate)",
      Boolean(scopeCustomer?.id),
      scopeCustomer?.id ? "customers row linked" : "missing",
    );
    record(
      "Booking lock would not fail PROVISIONING_INCOMPLETE",
      Boolean(scopeCustomer?.id),
      scopeCustomer?.id ? "provisioned" : "would return PROVISIONING_INCOMPLETE",
    );
  } else if (customer) {
    record("actingCustomerId would resolve (book/lock gate)", true, "verified via service role");
    record("Booking lock would not fail PROVISIONING_INCOMPLETE", true, "customers row present");
  } else {
    record("actingCustomerId would resolve (book/lock gate)", false, "no customer row");
    record("Booking lock would not fail PROVISIONING_INCOMPLETE", false, "no customer row");
  }

  // UI pages (dev server)
  for (const path of ["/sign-up", "/sign-in", "/customer", "/customer/book"]) {
    try {
      const res = await fetch(`${appUrl}${path}`, { redirect: "manual" });
      const ok = res.status === 200 || res.status === 307 || res.status === 308;
      record(`GET ${path} reachable`, ok, `status=${res.status}`);
    } catch (e) {
      record(`GET ${path} reachable`, false, e instanceof Error ? e.message : String(e));
    }
  }

  // Cleanup
  try {
    await service.from("customers").delete().eq("profile_id", userId);
    await service.from("profiles").delete().eq("id", userId);
    await service.auth.admin.deleteUser(userId);
    record("Test user cleanup", true, userId);
  } catch (e) {
    record("Test user cleanup", false, e instanceof Error ? e.message : String(e));
  }

  printSummary();
  const failed = results.filter((r) => !r.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n--- Summary: ${results.length - failed.length}/${results.length} passed ---`);
  if (failed.length) {
    console.log("Failures:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
