#!/usr/bin/env node
/**
 * Repairs missing public.profiles rows for auth users.
 *
 * Safety:
 * - Default: dry-run (no writes)
 * - `--e2e`: runs full `npm run e2e:seed` (admin/cleaner/customer test accounts)
 * - `--email <addr>`: customer profile only (role=customer); never creates admin/cleaner
 * - `--email <addr> --cleaner`: cleaner profile + cleaners row (never admin)
 * - Requires CONFIRM_PROFILE_REPAIR=yes for mutating repairs
 *
 * Usage:
 *   npm run ops:repair:auth-profiles
 *   npm run ops:repair:auth-profiles -- --e2e
 *   CONFIRM_PROFILE_REPAIR=yes npm run ops:repair:auth-profiles -- --email user@example.com
 *   CONFIRM_PROFILE_REPAIR=yes npm run ops:repair:auth-profiles -- --email cleaner@example.com --cleaner
 */
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { E2E_PREFIX } from "../e2e/lib/constants.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

const args = process.argv.slice(2);
const runE2e = args.includes("--e2e");
const cleanerScoped = args.includes("--cleaner");
const emailFlagIndex = args.indexOf("--email");
const targetEmail =
  emailFlagIndex >= 0 ? args[emailFlagIndex + 1]?.trim().toLowerCase() : undefined;
const phoneFlagIndex = args.indexOf("--phone");
const targetPhone = phoneFlagIndex >= 0 ? args[phoneFlagIndex + 1]?.trim() : undefined;
const confirmed = process.env.CONFIRM_PROFILE_REPAIR === "yes";

function usage() {
  console.log(`Usage:
  npm run ops:repair:auth-profiles
  npm run ops:repair:auth-profiles -- --e2e
  CONFIRM_PROFILE_REPAIR=yes npm run ops:repair:auth-profiles -- --email user@example.com
  CONFIRM_PROFILE_REPAIR=yes npm run ops:repair:auth-profiles -- --email cleaner@example.com --cleaner [--phone +27...]`);
}

async function findAuthUserByEmail(email) {
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

async function repairCustomerProfile(email) {
  const user = await findAuthUserByEmail(email);
  if (!user) {
    throw new Error(`No auth user found for ${email}`);
  }

  const { data: existing } = await client
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (existing?.role) {
    console.log(`✓ Profile already exists for ${email} (role=${existing.role})`);
    if (existing.role !== "customer") {
      console.warn(
        "  Non-customer role — not modified. Use --cleaner for cleaner repair or admin provisioning.",
      );
    }
    return;
  }

  const fullName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    email.split("@")[0];

  if (!confirmed) {
    console.log(`[dry-run] Would create customer profile for ${email} (${user.id})`);
    console.log("Set CONFIRM_PROFILE_REPAIR=yes to apply.");
    return;
  }

  const { error: profileErr } = await client.from("profiles").upsert(
    { id: user.id, role: "customer", full_name: fullName },
    { onConflict: "id" },
  );
  if (profileErr) throw profileErr;

  const { error: provisionErr } = await client.rpc("ensure_customer_provisioned", {
    profile_id: user.id,
  });
  if (provisionErr) throw provisionErr;

  console.log(`✓ Created customer profile + customers row for ${email}`);
}

async function repairCleanerProfile(email) {
  const user = await findAuthUserByEmail(email);
  if (!user) {
    throw new Error(`No auth user found for ${email}`);
  }

  const { data: existingProfile } = await client
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile?.role === "admin") {
    throw new Error(`Refusing to repair admin account ${email} via cleaner repair.`);
  }

  const { data: cleanerByProfile } = await client
    .from("cleaners")
    .select("id, profile_id, phone")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!cleanerByProfile && !cleanerScoped) {
    throw new Error(
      `No cleaners row for ${email}. Re-run with --cleaner to create profile + cleaners row.`,
    );
  }

  if (targetPhone) {
    const { data: cleanerByPhone } = await client
      .from("cleaners")
      .select("id, profile_id")
      .eq("phone", targetPhone)
      .maybeSingle();
    if (cleanerByPhone && cleanerByPhone.profile_id !== user.id) {
      throw new Error(`Phone ${targetPhone} is already assigned to another cleaner.`);
    }
  }

  const fullName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    email.split("@")[0];

  if (!confirmed) {
    console.log(
      `[dry-run] Would upsert cleaner profile for ${email} (${user.id})` +
        (cleanerByProfile ? "" : " and create cleaners row"),
    );
    console.log("Set CONFIRM_PROFILE_REPAIR=yes to apply.");
    return;
  }

  const { error: profileErr } = await client.from("profiles").upsert(
    { id: user.id, role: "cleaner", full_name: fullName },
    { onConflict: "id" },
  );
  if (profileErr) throw profileErr;

  if (cleanerByProfile) {
    if (targetPhone && cleanerByProfile.phone !== targetPhone) {
      const { error: phoneErr } = await client
        .from("cleaners")
        .update({ phone: targetPhone })
        .eq("id", cleanerByProfile.id);
      if (phoneErr) throw phoneErr;
    }
    console.log(`✓ Cleaner profile repaired for ${email} (existing cleaners row)`);
    return;
  }

  const { error: cleanerErr } = await client.from("cleaners").insert({
    profile_id: user.id,
    phone: targetPhone ?? null,
  });
  if (cleanerErr) throw cleanerErr;

  console.log(`✓ Created cleaner profile + cleaners row for ${email}`);
}

function dryRunOrphans() {
  const result = spawnSync("node", ["scripts/ops/audit-auth-profiles.mjs"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(result.status ?? 1);
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  if (runE2e) {
    console.log("Running E2E seed to repair test accounts…\n");
    const result = spawnSync("npm", ["run", "e2e:seed"], {
      stdio: "inherit",
      shell: true,
    });
    process.exit(result.status ?? 1);
  }

  if (targetEmail) {
    if (targetEmail.startsWith(E2E_PREFIX) || targetEmail.includes(`${E2E_PREFIX}`)) {
      console.log("E2E-prefixed email detected — prefer: npm run e2e:seed\n");
    }
    if (cleanerScoped) {
      await repairCleanerProfile(targetEmail);
    } else {
      if (args.includes("--cleaner")) {
        console.warn("--cleaner is only valid with --email <addr>");
      }
      await repairCustomerProfile(targetEmail);
    }
    return;
  }

  if (cleanerScoped) {
    console.error("--cleaner requires --email <addr>");
    process.exit(1);
  }

  dryRunOrphans();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
