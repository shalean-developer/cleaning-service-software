#!/usr/bin/env node
/**
 * Provision or promote a production admin account (auth.users + public.profiles only).
 *
 * Does NOT modify customers, cleaners, bookings, payouts, audit tables, or E2E test admins.
 *
 * Usage:
 *   CONFIRM_PRODUCTION_ADMIN_PROVISION=yes \
 *   PRODUCTION_ADMIN_PASSWORD='…' \
 *   npm run ops:provision-admin
 *
 * Optional override (non-default email):
 *   ALLOW_PRODUCTION_ADMIN_EMAIL_OVERRIDE=yes \
 *   PRODUCTION_ADMIN_EMAIL=other@shalean.co.za \
 *   … npm run ops:provision-admin
 *
 * Optional password rotation (existing auth user only):
 *   ROTATE_PRODUCTION_ADMIN_PASSWORD=yes \
 *   PRODUCTION_ADMIN_PASSWORD='…' \
 *   … npm run ops:provision-admin
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import { resolveE2eEmails } from "../e2e/lib/constants.mjs";

const DEFAULT_PRODUCTION_ADMIN_EMAIL = "admin@shalean.co.za";
const PRODUCTION_ADMIN_FULL_NAME = "Shalean Admin";

const args = process.argv.slice(2);

function usage() {
  console.log(`Production admin provisioning

Required:
  CONFIRM_PRODUCTION_ADMIN_PROVISION=yes
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  PRODUCTION_ADMIN_PASSWORD

Email (default ${DEFAULT_PRODUCTION_ADMIN_EMAIL}):
  PRODUCTION_ADMIN_EMAIL=${DEFAULT_PRODUCTION_ADMIN_EMAIL}

Override non-default email only when:
  ALLOW_PRODUCTION_ADMIN_EMAIL_OVERRIDE=yes
  PRODUCTION_ADMIN_EMAIL=<other>

Optional password rotation (existing auth user only; default leaves password unchanged):
  ROTATE_PRODUCTION_ADMIN_PASSWORD=yes

Usage:
  CONFIRM_PRODUCTION_ADMIN_PROVISION=yes PRODUCTION_ADMIN_PASSWORD='…' npm run ops:provision-admin

Flags:
  --help, -h    Show this message
  --dry-run     Validate env and print planned actions (no writes)`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function assertConfirmation() {
  if (process.env.CONFIRM_PRODUCTION_ADMIN_PROVISION?.trim() !== "yes") {
    fail(
      "Refusing to run without CONFIRM_PRODUCTION_ADMIN_PROVISION=yes.\n" +
        "Example:\n" +
        "  CONFIRM_PRODUCTION_ADMIN_PROVISION=yes PRODUCTION_ADMIN_PASSWORD='…' npm run ops:provision-admin",
    );
  }
}

function assertSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (!serviceRoleKey) {
    fail("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, serviceRoleKey };
}

function resolveTargetEmail() {
  const emailFlagIndex = args.indexOf("--email");
  const cliEmail = emailFlagIndex >= 0 ? args[emailFlagIndex + 1]?.trim() : undefined;
  const email = (cliEmail || process.env.PRODUCTION_ADMIN_EMAIL || DEFAULT_PRODUCTION_ADMIN_EMAIL)
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    fail("Invalid PRODUCTION_ADMIN_EMAIL (or --email).");
  }

  if (email.startsWith("test_e2e_") || email.includes("test_e2e_")) {
    fail(
      `Refusing to provision E2E test email ${email}. Use npm run e2e:seed for test accounts.`,
    );
  }

  if (email !== DEFAULT_PRODUCTION_ADMIN_EMAIL) {
    if (process.env.ALLOW_PRODUCTION_ADMIN_EMAIL_OVERRIDE?.trim() !== "yes") {
      fail(
        `Refusing non-default admin email ${email}.\n` +
          `Expected ${DEFAULT_PRODUCTION_ADMIN_EMAIL}, or set ALLOW_PRODUCTION_ADMIN_EMAIL_OVERRIDE=yes.`,
      );
    }
    console.warn(`⚠ Using overridden production admin email: ${email}`);
  }

  return email;
}

function assertPassword() {
  const password = process.env.PRODUCTION_ADMIN_PASSWORD?.trim();
  if (!password) {
    fail("Missing PRODUCTION_ADMIN_PASSWORD.");
  }
  if (password.length < 12) {
    fail("PRODUCTION_ADMIN_PASSWORD must be at least 12 characters.");
  }
  return password;
}

function shouldRotatePassword() {
  return process.env.ROTATE_PRODUCTION_ADMIN_PASSWORD?.trim() === "yes";
}

async function rotateAuthUserPassword(client, userId, password, dryRun) {
  if (dryRun) {
    console.log("[dry-run] Would rotate password for existing auth user.");
    return;
  }

  const { error } = await client.auth.admin.updateUserById(userId, { password });
  if (error) throw error;
}

async function findAuthUserByEmail(client, email) {
  let page = 1;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = (data.users ?? []).find((u) => u.email?.toLowerCase() === email);
    if (match) return match;
    if ((data.users ?? []).length < 200) break;
    page += 1;
  }
  return null;
}

async function ensureAuthUser(client, email, password, dryRun) {
  const existing = await findAuthUserByEmail(client, email);
  if (existing) {
    return { userId: existing.id, created: false };
  }

  if (dryRun) {
    console.log(`[dry-run] Would create auth user for ${email} (email confirmed).`);
    return { userId: "(new-user-id)", created: true };
  }

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: PRODUCTION_ADMIN_FULL_NAME },
  });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error(`Could not create auth user for ${email}`);
  return { userId, created: true };
}

async function upsertAdminProfile(client, userId, dryRun) {
  if (dryRun) {
    console.log(
      `[dry-run] Would upsert public.profiles id=${userId} role=admin full_name="${PRODUCTION_ADMIN_FULL_NAME}".`,
    );
    return;
  }

  const { error } = await client.from("profiles").upsert(
    { id: userId, role: "admin", full_name: PRODUCTION_ADMIN_FULL_NAME },
    { onConflict: "id" },
  );
  if (error) throw error;
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

async function printVerification(client, targetEmail, targetUserId, dryRun) {
  console.log("\n--- Verification ---");

  if (dryRun) {
    console.log("Dry run complete — no database changes were made.");
    return;
  }

  const admins = await listAdminProfiles(client);
  if (admins.length === 0) {
    console.warn("⚠ No admin profiles found after provisioning.");
  } else {
    console.log(`Admin profiles (${admins.length}):`);
    for (const row of admins) {
      const marker =
        row.id === targetUserId || row.email.toLowerCase() === targetEmail ? " ← provisioned" : "";
      console.log(
        `  ${row.email}  id=${row.id}  role=${row.role}  name=${row.full_name ?? "—"}${marker}`,
      );
    }
  }

  const { data: targetProfile, error: profileErr } = await client
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", targetUserId)
    .maybeSingle();
  if (profileErr) throw profileErr;

  if (targetProfile?.role === "admin") {
    console.log(`✓ ${targetEmail} has profiles.role = admin (id ${targetUserId})`);
  } else {
    console.error(
      `✗ ${targetEmail} profile missing or role is not admin (got ${targetProfile?.role ?? "none"})`,
    );
    process.exitCode = 1;
  }

  const e2eAdminEmail = resolveE2eEmails().admin.toLowerCase();
  const e2eStillAdmin = admins.some(
    (row) => row.email.toLowerCase() === e2eAdminEmail && row.role === "admin",
  );
  if (e2eStillAdmin) {
    console.warn(
      `⚠ ${e2eAdminEmail} is still role=admin. This script does not demote E2E accounts; demote separately when ready.`,
    );
  } else {
    console.log(`✓ E2E admin ${e2eAdminEmail} is not an active admin profile (or not present).`);
  }
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const dryRun = args.includes("--dry-run");
  assertConfirmation();
  assertSupabaseEnv();
  const email = resolveTargetEmail();
  const password = assertPassword();

  loadEnvFiles();
  const client = requireServiceRoleClient(createClient);

  const supabaseHost = new URL(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  ).hostname;
  console.log(`Provisioning production admin at ${supabaseHost}`);
  console.log(`  Email: ${email}`);
  console.log(`  Profile: role=admin, full_name="${PRODUCTION_ADMIN_FULL_NAME}"`);
  console.log("  Scope: auth.users + public.profiles only");
  if (shouldRotatePassword()) {
    console.log("  Password: rotate existing auth user when present");
  }
  if (dryRun) console.log("  Mode: dry-run (no writes)\n");

  const { userId, created } = await ensureAuthUser(client, email, password, dryRun);
  if (created) {
    console.log(`✓ Created auth user (${userId})`);
  } else {
    console.log(`✓ Reused existing auth user (${userId})`);
    if (shouldRotatePassword()) {
      await rotateAuthUserPassword(client, userId, password, dryRun);
      if (!dryRun) {
        console.log("Password rotated for existing admin user");
      }
    } else {
      console.log("  Password unchanged (set ROTATE_PRODUCTION_ADMIN_PASSWORD=yes to rotate)");
    }
  }

  await upsertAdminProfile(client, userId, dryRun);
  if (!dryRun) {
    console.log("✓ Upserted public.profiles (admin)");
  }

  await printVerification(client, email, userId, dryRun);

  if (!dryRun) {
    console.log("\nNext: sign in at /sign-in and verify /admin access.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
