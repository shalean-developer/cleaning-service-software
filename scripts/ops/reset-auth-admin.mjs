#!/usr/bin/env node
/**
 * Reset auth.users + public.profiles to a single production admin.
 * Keeps only admin@shalean.co.za.
 *
 * Usage:
 *   npm run ops:audit:reset-auth-admin
 *   CONFIRM_RESET_AUTH_ADMIN=yes npm run ops:reset-auth-admin
 */
import { createClient } from "@supabase/supabase-js";
import {
  CONFIRM_ENV_VAR,
  PROTECTED_ADMIN_EMAIL,
  assertProtectedAdminReady,
  authAdminResetComplete,
  collectAuthAdminResetCounts,
  executeAuthAdminReset,
  formatAuthAdminResetReport,
} from "./lib/auth-admin-reset-scope.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

if (process.env[CONFIRM_ENV_VAR] !== "yes") {
  console.error(
    `Refusing to reset without ${CONFIRM_ENV_VAR}=yes\n` +
      "Run audit first: npm run ops:audit:reset-auth-admin\n" +
      'Then (PowerShell): $env:CONFIRM_RESET_AUTH_ADMIN = "yes"; npm run ops:reset-auth-admin\n' +
      "Then (bash): CONFIRM_RESET_AUTH_ADMIN=yes npm run ops:reset-auth-admin",
  );
  process.exit(1);
}

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

async function main() {
  console.log("Auth / admin reset — CONFIRMED\n");
  console.log(`Keeping only ${PROTECTED_ADMIN_EMAIL} in auth.users and public.profiles.\n`);

  const preflight = await collectAuthAdminResetCounts(client);
  assertProtectedAdminReady(preflight);

  console.log("--- Before counts ---\n");
  console.log(formatAuthAdminResetReport(preflight, "Before"));

  const result = await executeAuthAdminReset(client);

  console.log("\n--- Actions ---");
  console.log(`  Admin profile ensured:  ${result.profileEnsure.created ? "created" : result.profileEnsure.updated ? "updated" : "unchanged"}`);
  console.log(`  Profiles deleted:       ${result.profilesDeleted}`);
  console.log(`  Auth users deleted:     ${result.authDeleted}`);
  if (result.authFailures.length > 0) {
    console.log(`  Auth delete failures:   ${result.authFailures.length}`);
    for (const f of result.authFailures.slice(0, 10)) {
      console.warn(`    ${f.email}: ${f.message}`);
    }
  }

  console.log("\n--- After counts ---\n");
  console.log(formatAuthAdminResetReport(result.after, "After"));

  const adminOk =
    result.after.protectedUser != null &&
    result.after.protectedProfile?.role === "admin";

  if (!adminOk) {
    console.error(
      `\nSafety failure: ${PROTECTED_ADMIN_EMAIL} must exist with profiles.role = admin after reset.`,
    );
    process.exit(2);
  }

  if (!authAdminResetComplete(result.after)) {
    console.error(
      "\nReset incomplete — auth users or profiles remain outside protected admin.",
    );
    if (result.authFailures.length > 0) {
      console.error("Some auth deletes failed; inspect failures above and retry.");
    }
    process.exit(2);
  }

  console.log(`\nAuth / admin reset complete. Only ${PROTECTED_ADMIN_EMAIL} remains.`);
  console.log("Re-run audit: npm run ops:audit:reset-auth-admin");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
