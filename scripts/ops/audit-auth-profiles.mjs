#!/usr/bin/env node
/**
 * Read-only audit: auth.users without a matching public.profiles row.
 *
 * Usage: npm run ops:audit:auth-profiles
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

async function listOrphanAuthUsers() {
  const orphans = [];
  let page = 1;

  for (;;) {
    const { data: list, error: listErr } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listErr) throw listErr;
    const users = list.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      const { data: profile, error: profileErr } = await client
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();
      if (profileErr) throw profileErr;
      if (!profile?.role) {
        orphans.push({
          id: user.id,
          email: user.email ?? "(no email)",
          createdAt: user.created_at,
        });
      }
    }

    if (users.length < 200) break;
    page += 1;
  }

  return orphans;
}

async function main() {
  console.log("Auditing auth.users without public.profiles…\n");
  const orphans = await listOrphanAuthUsers();

  if (orphans.length === 0) {
    console.log("✓ No orphan auth users found.");
    return;
  }

  console.log(`Found ${orphans.length} auth user(s) without a profile:\n`);
  for (const row of orphans) {
    console.log(`  ${row.email}`);
    console.log(`    id: ${row.id}`);
    if (row.createdAt) console.log(`    created: ${row.createdAt}`);
    console.log("");
  }

  console.log("Repair options:");
  console.log("  E2E/local test accounts:  npm run e2e:seed");
  console.log(
    "  Customer orphan:          CONFIRM_PROFILE_REPAIR=yes npm run ops:repair:auth-profiles -- --email <email>",
  );
  console.log(
    "  Cleaner orphan:           CONFIRM_PROFILE_REPAIR=yes npm run ops:repair:auth-profiles -- --email <email> --cleaner",
  );
  console.log(
    "  Admin access:             provision via service-role admin flows only (never auto-promoted here).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
