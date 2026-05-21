#!/usr/bin/env node
/**
 * Dry-run audit for auth + admin profile reset (no writes).
 * Keeps only admin@shalean.co.za in auth.users and public.profiles (role=admin).
 *
 * Usage: npm run ops:audit:reset-auth-admin
 */
import { createClient } from "@supabase/supabase-js";
import {
  PROTECTED_ADMIN_EMAIL,
  collectAuthAdminResetCounts,
  formatAuthAdminResetReport,
} from "./lib/auth-admin-reset-scope.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

async function main() {
  console.log("Auth / admin reset — audit (dry-run, no writes)\n");
  console.log(`Protected: ${PROTECTED_ADMIN_EMAIL} (auth.users + public.profiles role=admin)`);
  console.log("Does not modify: services, pricing/site tables, append-only audit/event logs.\n");

  console.log("Collecting counts…");
  const snapshot = await collectAuthAdminResetCounts(client);

  console.log("\n--- Before reset (current state) ---\n");
  console.log(formatAuthAdminResetReport(snapshot, "Current"));

  if (!snapshot.protectedUser) {
    console.error(
      `\nCannot proceed with reset: ${PROTECTED_ADMIN_EMAIL} is missing from auth.users.`,
    );
    console.error("Provision the admin account first, then re-run this audit.");
    process.exit(2);
  }

  if (snapshot.bookingsBlocking > 0) {
    console.warn(
      `\n  Warning: ${snapshot.bookingsBlocking} booking(s) block profile deletion ` +
        "(customers still linked to profiles to remove).",
    );
    console.warn("  Run ops:clear-operational-data before ops:reset-auth-admin.");
  }

  if (snapshot.authToDelete.length === 0 && snapshot.profilesToDelete.length === 0) {
    console.log("\nOnly the protected admin remains. No reset needed.");
    return;
  }

  console.log("\nWhen counts look correct, reset with:");
  console.log("  PowerShell:");
  console.log('    $env:CONFIRM_RESET_AUTH_ADMIN = "yes"; npm run ops:reset-auth-admin');
  console.log("  bash:");
  console.log("    CONFIRM_RESET_AUTH_ADMIN=yes npm run ops:reset-auth-admin");
  console.log("\nDo NOT run reset until you have reviewed these counts.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
