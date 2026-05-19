#!/usr/bin/env node
/**
 * Demote mock/test admin profiles to customer (profiles.role only).
 *
 * Targets:
 *   - Emails containing test_phase2_
 *   - test_e2e_admin@shalean.co.za (or E2E_TEST_ADMIN_EMAIL)
 *
 * Never touches:
 *   - admin@shalean.co.za
 *   - Any other account
 *
 * Does NOT delete auth.users, profiles, or audit rows.
 *
 * Usage:
 *   CONFIRM_DEMOTE_MOCK_ADMINS=yes npm run ops:demote-mock-admins
 *   CONFIRM_DEMOTE_MOCK_ADMINS=yes npm run ops:demote-mock-admins -- --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import { resolveE2eEmails } from "../e2e/lib/constants.mjs";

const PROTECTED_PRODUCTION_ADMIN_EMAIL = "admin@shalean.co.za";

const args = process.argv.slice(2);

function usage() {
  console.log(`Demote mock/test admin profiles to customer

Required:
  CONFIRM_DEMOTE_MOCK_ADMINS=yes
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Targets (role admin → customer):
  - *test_phase2_*@* (email contains test_phase2_)
  - test_e2e_admin@shalean.co.za (or E2E_TEST_ADMIN_EMAIL)

Protected (never modified):
  - ${PROTECTED_PRODUCTION_ADMIN_EMAIL}

Usage:
  CONFIRM_DEMOTE_MOCK_ADMINS=yes npm run ops:demote-mock-admins
  CONFIRM_DEMOTE_MOCK_ADMINS=yes npm run ops:demote-mock-admins -- --dry-run

Flags:
  --help, -h    Show this message
  --dry-run     List changes only (no writes)`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function assertConfirmation() {
  if (process.env.CONFIRM_DEMOTE_MOCK_ADMINS?.trim() !== "yes") {
    fail(
      "Refusing to run without CONFIRM_DEMOTE_MOCK_ADMINS=yes.\n" +
        "Example:\n" +
        "  CONFIRM_DEMOTE_MOCK_ADMINS=yes npm run ops:demote-mock-admins",
    );
  }
}

function assertSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) fail("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) fail("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return { url, serviceRoleKey };
}

function isDemotionTarget(email, e2eAdminEmail) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === PROTECTED_PRODUCTION_ADMIN_EMAIL) return false;
  if (normalized === e2eAdminEmail) return true;
  if (normalized.includes("test_phase2_")) return true;
  return false;
}

async function listAdminProfiles(client) {
  const { data: profiles, error } = await client
    .from("profiles")
    .select("id, role, full_name, created_at, updated_at")
    .eq("role", "admin")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = [];
  for (const profile of profiles ?? []) {
    let email = "(unknown)";
    try {
      const { data: authUser, error: authErr } = await client.auth.admin.getUserById(profile.id);
      if (!authErr && authUser?.user?.email) {
        email = authUser.user.email;
      }
    } catch {
      // keep unknown
    }
    rows.push({ ...profile, email });
  }
  return rows;
}

function printAdminList(title, admins) {
  console.log(`\n${title} (${admins.length}):`);
  if (admins.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const row of admins) {
    console.log(
      `  ${row.email}  id=${row.id}  role=${row.role}  name=${row.full_name ?? "—"}`,
    );
  }
}

function assertNoProtectedInTargets(targets) {
  for (const row of targets) {
    if (row.email.trim().toLowerCase() === PROTECTED_PRODUCTION_ADMIN_EMAIL) {
      fail(
        `Refusing to demote protected production admin ${PROTECTED_PRODUCTION_ADMIN_EMAIL}.`,
      );
    }
  }
}

async function demoteProfiles(client, profileIds, dryRun) {
  if (profileIds.length === 0) return 0;

  if (dryRun) {
    console.log(`\n[dry-run] Would demote ${profileIds.length} profile(s) to role=customer.`);
    return profileIds.length;
  }

  const { data, error } = await client
    .from("profiles")
    .update({ role: "customer", updated_at: new Date().toISOString() })
    .in("id", profileIds)
    .eq("role", "admin")
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const dryRun = args.includes("--dry-run");
  assertConfirmation();
  assertSupabaseEnv();

  loadEnvFiles();
  const client = requireServiceRoleClient(createClient);
  const e2eAdminEmail = resolveE2eEmails().admin.toLowerCase();

  const supabaseHost = new URL(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  ).hostname;
  console.log(`Demote mock admin profiles at ${supabaseHost}`);
  console.log("  Action: profiles.role admin → customer (no deletes)");
  console.log(`  Protected: ${PROTECTED_PRODUCTION_ADMIN_EMAIL}`);
  if (dryRun) console.log("  Mode: dry-run (no writes)\n");

  const adminsBefore = await listAdminProfiles(client);
  const toDemote = adminsBefore.filter((row) =>
    isDemotionTarget(row.email, e2eAdminEmail),
  );
  const remainingBefore = adminsBefore.filter(
    (row) => !isDemotionTarget(row.email, e2eAdminEmail),
  );

  assertNoProtectedInTargets(toDemote);

  printAdminList("Admin profiles before demotion", adminsBefore);
  printAdminList("Profiles to demote", toDemote);
  printAdminList("Production / other admins (unchanged)", remainingBefore);

  const profileIds = toDemote.map((row) => row.id);
  const demotedCount = await demoteProfiles(client, profileIds, dryRun);

  if (!dryRun) {
    console.log(`\n✓ Demoted ${demotedCount} profile(s) to role=customer`);
  }

  const adminsAfter = dryRun
    ? remainingBefore
    : await listAdminProfiles(client);

  printAdminList(
    dryRun ? "Admin profiles after demotion (projected)" : "Admin profiles after demotion",
    adminsAfter,
  );

  const productionStillAdmin = adminsAfter.some(
    (row) => row.email.trim().toLowerCase() === PROTECTED_PRODUCTION_ADMIN_EMAIL,
  );
  if (productionStillAdmin) {
    console.log(`✓ ${PROTECTED_PRODUCTION_ADMIN_EMAIL} remains admin`);
  } else {
    console.warn(
      `⚠ ${PROTECTED_PRODUCTION_ADMIN_EMAIL} is not an admin — verify production provisioning if unexpected.`,
    );
  }

  const e2eStillAdmin = adminsAfter.some(
    (row) => row.email.trim().toLowerCase() === e2eAdminEmail,
  );
  if (e2eStillAdmin) {
    console.warn(`⚠ ${e2eAdminEmail} is still admin (re-run or check dry-run).`);
  } else if (toDemote.some((row) => row.email.toLowerCase() === e2eAdminEmail)) {
    console.log(`✓ ${e2eAdminEmail} demoted (or was not admin)`);
  }

  const phase2Remaining = adminsAfter.filter((row) =>
    row.email.toLowerCase().includes("test_phase2_"),
  );
  if (phase2Remaining.length > 0) {
    console.warn(`⚠ ${phase2Remaining.length} test_phase2_* account(s) still admin.`);
  } else if (toDemote.some((row) => row.email.toLowerCase().includes("test_phase2_"))) {
    console.log("✓ No test_phase2_* accounts remain admin");
  }

  if (dryRun) {
    console.log("\nDry run complete — no database changes were made.");
  } else {
    console.log("\nAudit history and auth users were not modified.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
