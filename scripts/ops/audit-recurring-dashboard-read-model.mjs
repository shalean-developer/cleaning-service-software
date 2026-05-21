#!/usr/bin/env node
/**
 * Audit recurring dashboard read paths vs raw booking_series (dry-run).
 *
 * Usage: npm run ops:audit:recurring-dashboard
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

loadEnvFiles();

function envFingerprint(url) {
  if (!url) return "(missing)";
  try {
    const host = new URL(url).hostname;
    return `${host.slice(0, 6)}…${host.slice(-10)}`;
  } catch {
    return "(invalid url)";
  }
}

function loadEnvKey(name) {
  const path = resolve(".env.local");
  if (!existsSync(path)) return null;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() === name) {
      return trimmed.slice(eq + 1).trim();
    }
  }
  return null;
}

const serviceUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
const nextPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  null;

console.log("Recurring dashboard read-model audit (dry-run)\n");
console.log("Environment");
console.log(`  ops / service_role URL:     ${envFingerprint(serviceUrl)}`);
console.log(`  Next.js NEXT_PUBLIC URL:  ${envFingerprint(nextPublicUrl)}`);
console.log(
  `  URLs match:                 ${serviceUrl && nextPublicUrl ? String(serviceUrl === nextPublicUrl) : "n/a"}`,
);
console.log(`  .env.local NEXT_PUBLIC:    ${envFingerprint(loadEnvKey("NEXT_PUBLIC_SUPABASE_URL"))}`);
console.log("");

const serviceClient = requireServiceRoleClient(createClient);
const anonClient =
  serviceUrl && anonKey
    ? createClient(serviceUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const { data: seriesRows, error: seriesError } = await serviceClient
  .from("booking_series")
  .select(
    "id, customer_id, status, frequency, next_occurrence_at, created_from_booking_id, created_at",
  )
  .order("created_at", { ascending: false });
if (seriesError) {
  console.error(seriesError.message);
  process.exit(1);
}

const series = seriesRows ?? [];
const statusSet = new Set(series.map((s) => s.status ?? "(null)"));

console.log(`Raw booking_series count (service_role): ${series.length}`);
console.log(`Distinct statuses: ${[...statusSet].join(", ") || "(none)"}`);
console.log("");

if (anonClient) {
  const { data: anonSeries, error: anonError } = await anonClient
    .from("booking_series")
    .select("id");
  console.log("Unauthenticated (anon) SELECT booking_series");
  console.log(`  rows: ${anonSeries?.length ?? 0}${anonError ? `  error: ${anonError.message}` : ""}`);
  if ((anonSeries?.length ?? 0) === 0 && series.length > 0) {
    console.log(
      "  ⚠ Anon sees 0 rows while service_role sees data — RLS enabled without anon policy (expected).",
    );
    console.log(
      "  ⚠ Authenticated dashboards need booking_series_select_admin / _customer policies.",
    );
  }
  console.log("");
}

const customerIds = [...new Set(series.map((s) => s.customer_id))];
const { data: customers } = await serviceClient
  .from("customers")
  .select("id, profile_id")
  .in("id", customerIds.length > 0 ? customerIds : ["00000000-0000-0000-0000-000000000000"]);
const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

let missingCustomer = 0;
let missingAnchor = 0;
for (const s of series) {
  if (!customerById.has(s.customer_id)) missingCustomer += 1;
  const { data: anchor } = await serviceClient
    .from("bookings")
    .select("id")
    .eq("id", s.created_from_booking_id)
    .maybeSingle();
  if (!anchor) missingAnchor += 1;
}

console.log("Referential integrity (service_role)");
console.log(`  series with missing customer row: ${missingCustomer}`);
console.log(`  series with missing anchor booking: ${missingAnchor}`);
console.log("");

const { data: allCustomers } = await serviceClient.from("customers").select("id, profile_id");
console.log("Per-customer series ownership");
for (const c of allCustomers ?? []) {
  const owned = series.filter((s) => s.customer_id === c.id);
  if (owned.length === 0) continue;
  console.log(`  customer ${c.id.slice(0, 8)}… profile ${String(c.profile_id).slice(0, 8)}… → ${owned.length} series`);
}

const orphanSeries = series.filter((s) => !customerById.has(s.customer_id));
if (orphanSeries.length > 0) {
  console.log("\nOrphan customer_id on series (admin UI should show Archived customer):");
  for (const s of orphanSeries) {
    console.log(`  series ${s.id} → customer_id ${s.customer_id}`);
  }
}

const testProfileId = process.env.OPS_AUDIT_CUSTOMER_PROFILE_ID?.trim();
if (testProfileId) {
  const { data: testCustomer } = await serviceClient
    .from("customers")
    .select("id")
    .eq("profile_id", testProfileId)
    .maybeSingle();
  const matched = testCustomer
    ? series.filter((s) => s.customer_id === testCustomer.id).length
    : 0;
  console.log(`\nTest customer profile ${testProfileId.slice(0, 8)}…`);
  console.log(`  resolved customer_id: ${testCustomer?.id ?? "(none)"}`);
  console.log(`  matched series count: ${matched}`);
} else {
  console.log(
    "\nSet OPS_AUDIT_CUSTOMER_PROFILE_ID in .env.local to compare a logged-in customer account.",
  );
}

console.log("\nAdmin read model (simulated): no status filter → expect", series.length, "items after RLS policies.");
console.log("Customer read model: filtered by auth_customer_id() — only own customer_id rows.");
