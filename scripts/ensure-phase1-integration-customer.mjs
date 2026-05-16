/**
 * Locates or creates test_phase1_integration_seed customer and writes .env.local entry.
 * Usage: node scripts/ensure-phase1-integration-customer.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PREFIX = "test_phase1_";
const SEED_COMPANY = `${PREFIX}integration_seed`;
const SEED_EMAIL = `${SEED_COMPANY}@shalean.co.za`;

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findSeedCustomer() {
  const { data, error } = await client
    .from("customers")
    .select("id, profile_id, company_name")
    .eq("company_name", SEED_COMPANY)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: rows, error: anyErr } = await client
    .from("customers")
    .select("id, profile_id, company_name")
    .like("company_name", `${PREFIX}%`)
    .limit(1);
  if (anyErr) throw anyErr;
  return rows?.[0] ?? null;
}

async function createSeedFromOrphanProfile() {
  const { data: profiles, error } = await client
    .from("profiles")
    .select("id")
    .eq("role", "customer")
    .limit(100);
  if (error) throw error;

  for (const profile of profiles ?? []) {
    const { data: linked } = await client
      .from("customers")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (linked) continue;

    const { data: created, error: insErr } = await client
      .from("customers")
      .insert({ profile_id: profile.id, company_name: SEED_COMPANY })
      .select("id, profile_id, company_name")
      .single();
    if (insErr) throw insErr;
    return created;
  }
  return null;
}

async function createSeedViaAuth() {
  let page = 1;
  let profileId = null;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = (data.users ?? []).find((u) => u.email === SEED_EMAIL);
    if (match) {
      profileId = match.id;
      break;
    }
    if ((data.users ?? []).length < 200) break;
    page += 1;
  }

  if (!profileId) {
    const { data, error } = await client.auth.admin.createUser({
      email: SEED_EMAIL,
      password: "integration-test-password",
      email_confirm: true,
      user_metadata: { phase1_integration: true, role: "customer" },
    });
    if (error) throw error;
    profileId = data.user?.id ?? null;
  }

  if (!profileId) return null;

  await client.from("profiles").upsert(
    { id: profileId, role: "customer", full_name: "Phase 1 integration seed" },
    { onConflict: "id" },
  );

  const { data: customer, error: custErr } = await client
    .from("customers")
    .insert({ profile_id: profileId, company_name: SEED_COMPANY })
    .select("id, profile_id, company_name")
    .single();
  if (custErr) throw custErr;
  return customer;
}

function upsertEnvLocal(customerId) {
  const envPath = resolve(process.cwd(), ".env.local");
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split("\n") : [];
  const key = "BOOKING_COMMAND_INTEGRATION_CUSTOMER_ID";
  const entry = `${key}=${customerId}`;
  let found = false;
  const out = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return entry;
    }
    return line;
  });
  if (!found) out.push(entry);
  writeFileSync(envPath, out.filter((l, i, a) => l !== "" || i < a.length - 1).join("\n") + "\n");
}

async function createSeedViaRpc() {
  const { data, error } = await client.rpc("phase1_ensure_integration_seed_customer");
  if (error) {
    if (error.code === "PGRST202" || error.message?.includes("phase1_ensure")) {
      return null;
    }
    throw error;
  }
  if (!data) return null;
  const { data: row, error: lookupErr } = await client
    .from("customers")
    .select("id, profile_id, company_name")
    .eq("id", data)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  return row;
}

let customer = await findSeedCustomer();
if (!customer) {
  customer = await createSeedFromOrphanProfile();
}
if (!customer) {
  try {
    customer = await createSeedViaRpc();
  } catch (e) {
    console.error("RPC phase1_ensure_integration_seed_customer failed:", e.message);
  }
}
if (!customer) {
  try {
    customer = await createSeedViaAuth();
  } catch (e) {
    console.error("Auth createUser failed:", e.message);
  }
}

if (!customer) {
  console.error(
    "Could not locate or create a test_phase1_ customer. Create one manually and set BOOKING_COMMAND_INTEGRATION_CUSTOMER_ID.",
  );
  process.exit(1);
}

upsertEnvLocal(customer.id);
console.log(`Integration seed customer: ${customer.id}`);
console.log(`company_name: ${customer.company_name}`);
console.log("Updated .env.local with BOOKING_COMMAND_INTEGRATION_CUSTOMER_ID");
