#!/usr/bin/env node
/**
 * Idempotent E2E seed: services, test customer/cleaner/admin, cleaner eligibility data.
 * Safe to rerun. Does not delete non-test data.
 *
 * Usage: npm run e2e:seed
 */
import { createClient } from "@supabase/supabase-js";
import {
  E2E_AREA_SLUG,
  E2E_AVAILABILITY_DAYS,
  E2E_LABELS,
  E2E_PASSWORD,
  E2E_PREFIX,
  E2E_SERVICES,
  E2E_SERVICE_SLUGS,
  resolveE2eEmails,
} from "./lib/constants.mjs";
import { ensureE2eCleaner, ensureE2eCustomer, ensureE2eUser } from "./lib/auth.mjs";
import { loadEnvFiles, requireServiceRoleClient, upsertEnvLocal } from "./lib/env.mjs";
import { assertE2eSeedAllowed } from "../ops/lib/e2e-seed-guard.mjs";

loadEnvFiles();
assertE2eSeedAllowed();
const client = requireServiceRoleClient(createClient);
const E2E_EMAILS = resolveE2eEmails();

async function profileIdForCustomerId(customerId) {
  if (!customerId) return undefined;
  const { data, error } = await client
    .from("customers")
    .select("profile_id")
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data?.profile_id ?? undefined;
}

async function profileIdForCleanerId(cleanerId) {
  if (!cleanerId) return undefined;
  const { data, error } = await client
    .from("cleaners")
    .select("profile_id")
    .eq("id", cleanerId)
    .maybeSingle();
  if (error) throw error;
  return data?.profile_id ?? undefined;
}

async function ensureServices() {
  const { data: existing, error } = await client.from("services").select("id, name, description");
  if (error) throw error;
  const byName = new Map((existing ?? []).map((s) => [s.name, s]));

  for (const svc of E2E_SERVICES) {
    if (byName.has(svc.name)) continue;
    const { error: insErr } = await client.from("services").insert({
      name: svc.name,
      description: svc.description,
      default_duration_minutes: svc.minutes,
      base_price_cents: svc.cents,
      currency: "ZAR",
      active: true,
    });
    if (insErr) throw insErr;
  }
}

async function ensureCleanerEligibility(cleanerId) {
  for (const slug of E2E_SERVICE_SLUGS) {
    const { data: cap } = await client
      .from("cleaner_service_capabilities")
      .select("id")
      .eq("cleaner_id", cleanerId)
      .eq("service_slug", slug)
      .maybeSingle();
    if (!cap) {
      const { error } = await client
        .from("cleaner_service_capabilities")
        .insert({ cleaner_id: cleanerId, service_slug: slug });
      if (error) throw error;
    }
  }

  const { data: area } = await client
    .from("cleaner_service_areas")
    .select("id")
    .eq("cleaner_id", cleanerId)
    .eq("area_slug", E2E_AREA_SLUG)
    .maybeSingle();
  if (!area) {
    const { error } = await client
      .from("cleaner_service_areas")
      .insert({ cleaner_id: cleanerId, area_slug: E2E_AREA_SLUG });
    if (error) throw error;
  }

  const { data: avail } = await client
    .from("cleaner_availability")
    .select("id")
    .eq("cleaner_id", cleanerId)
    .limit(1);
  if ((avail ?? []).length > 0) return;

  const rows = E2E_AVAILABILITY_DAYS.map((day) => ({
    cleaner_id: cleanerId,
    day_of_week: day,
    start_time: "08:00:00",
    end_time: "18:00:00",
    timezone: "Africa/Johannesburg",
  }));
  const { error } = await client.from("cleaner_availability").insert(rows);
  if (error) throw error;
}

async function main() {
  console.log(`Seeding E2E data (${E2E_PREFIX}*)…`);

  await ensureServices();
  console.log("✓ services catalog");

  const customerProfileId = await ensureE2eUser(client, {
    email: E2E_EMAILS.customer,
    role: "customer",
    fullName: E2E_LABELS.customerName,
    profileIdHint: await profileIdForCustomerId(process.env.E2E_TEST_CUSTOMER_ID?.trim()),
  });
  const customer = await ensureE2eCustomer(client, customerProfileId);
  console.log(`✓ customer ${customer.id}`);

  const cleanerProfileId = await ensureE2eUser(client, {
    email: E2E_EMAILS.cleaner,
    role: "cleaner",
    fullName: E2E_LABELS.cleanerName,
    profileIdHint: await profileIdForCleanerId(process.env.E2E_TEST_CLEANER_ID?.trim()),
  });
  const cleaner = await ensureE2eCleaner(client, cleanerProfileId);
  await ensureCleanerEligibility(cleaner.id);
  console.log(`✓ cleaner ${cleaner.id} (area: ${E2E_AREA_SLUG})`);

  const adminProfileId = await ensureE2eUser(client, {
    email: E2E_EMAILS.admin,
    role: "admin",
    fullName: E2E_LABELS.adminName,
    profileIdHint: process.env.E2E_TEST_ADMIN_PROFILE_ID?.trim(),
  });
  console.log(`✓ admin profile ${adminProfileId}`);

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    upsertEnvLocal({ NEXT_PUBLIC_SUPABASE_URL: supabaseUrl });
    console.log("✓ NEXT_PUBLIC_SUPABASE_URL set from SUPABASE_URL");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn(
      "\n⚠ Add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (Supabase dashboard → API → anon key) for /sign-in and dashboards.",
    );
  }

  // Verify auth.users.id === profiles.id for each seeded account (prevents stale .env hints).
  for (const [label, profileId, email] of [
    ["customer", customerProfileId, E2E_EMAILS.customer],
    ["cleaner", cleanerProfileId, E2E_EMAILS.cleaner],
    ["admin", adminProfileId, E2E_EMAILS.admin],
  ]) {
    const { data: authUser, error: authErr } = await client.auth.admin.getUserById(profileId);
    if (authErr) throw authErr;
    if (!authUser.user || authUser.user.email !== email) {
      throw new Error(
        `${label} auth/profile mismatch for ${email} (profile id ${profileId}). Re-run seed.`,
      );
    }
    const { data: profile, error: profileErr } = await client
      .from("profiles")
      .select("role")
      .eq("id", profileId)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (!profile?.role) {
      throw new Error(`${label} profile missing for ${email} after seed.`);
    }
  }

  upsertEnvLocal({
    E2E_TEST_CUSTOMER_ID: customer.id,
    E2E_TEST_CLEANER_ID: cleaner.id,
    E2E_TEST_ADMIN_PROFILE_ID: adminProfileId,
    E2E_TEST_CUSTOMER_EMAIL: E2E_EMAILS.customer,
    E2E_TEST_CLEANER_EMAIL: E2E_EMAILS.cleaner,
    E2E_TEST_ADMIN_EMAIL: E2E_EMAILS.admin,
    E2E_TEST_PASSWORD: E2E_PASSWORD,
    E2E_TEST_AREA_SLUG: E2E_AREA_SLUG,
  });

  console.log("\nE2E seed complete. Credentials written to .env.local:");
  console.log(`  Customer: ${E2E_EMAILS.customer}`);
  console.log(`  Cleaner:  ${E2E_EMAILS.cleaner}`);
  console.log(`  Admin:    ${E2E_EMAILS.admin}`);
  console.log(`  Password: ${E2E_PASSWORD}`);
  console.log("\nNext: follow docs/testing/live-e2e-smoke-test.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
