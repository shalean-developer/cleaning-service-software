#!/usr/bin/env node
/**
 * Deletes ONLY test_e2e_* seeded users' transactional data and auth users.
 * Does not remove services catalog or non-test rows.
 *
 * Usage: npm run e2e:cleanup
 * Requires: CONFIRM_E2E_CLEANUP=yes
 */
import { createClient } from "@supabase/supabase-js";
import { E2E_EMAILS, E2E_LABELS, E2E_PREFIX, isE2eCompanyName, isE2eEmail } from "./lib/constants.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "./lib/env.mjs";

if (process.env.CONFIRM_E2E_CLEANUP !== "yes") {
  console.error(
    "Refusing to cleanup without CONFIRM_E2E_CLEANUP=yes\n" +
      "Example: CONFIRM_E2E_CLEANUP=yes npm run e2e:cleanup",
  );
  process.exit(1);
}

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

async function listE2eAuthUserIds() {
  const ids = [];
  const targets = new Set(Object.values(E2E_EMAILS));
  let page = 1;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users ?? []) {
      if (u.email && (targets.has(u.email) || isE2eEmail(u.email))) {
        ids.push(u.id);
      }
    }
    if ((data.users ?? []).length < 200) break;
    page += 1;
  }
  return ids;
}

async function deleteBookingsForCustomers(customerIds) {
  if (customerIds.length === 0) return 0;

  const { data: bookings, error } = await client
    .from("bookings")
    .select("id")
    .in("customer_id", customerIds);
  if (error) throw error;
  const bookingIds = (bookings ?? []).map((b) => b.id);
  if (bookingIds.length === 0) return 0;

  await client.from("earning_lines").delete().in("booking_id", bookingIds);
  await client.from("assignment_offers").delete().in("booking_id", bookingIds);
  await client.from("booking_state_audit").delete().in("booking_id", bookingIds);

  const { data: paymentRows } = await client
    .from("payments")
    .select("id")
    .in("booking_id", bookingIds);
  const paymentIds = (paymentRows ?? []).map((p) => p.id);
  if (paymentIds.length > 0) {
    await client.from("payment_events").delete().in("payment_id", paymentIds);
    await client.from("payments").delete().in("id", paymentIds);
  }
  await client.from("booking_locks").delete().in("booking_id", bookingIds);
  const { error: delErr } = await client.from("bookings").delete().in("id", bookingIds);
  if (delErr) throw delErr;
  return bookingIds.length;
}

async function main() {
  console.log(`Cleaning up ${E2E_PREFIX}* data only…`);

  const { data: customers, error: custErr } = await client
    .from("customers")
    .select("id, company_name, profile_id")
    .like("company_name", `${E2E_PREFIX}%`);
  if (custErr) throw custErr;

  const safeCustomers = (customers ?? []).filter((c) => isE2eCompanyName(c.company_name));
  const customerIds = safeCustomers.map((c) => c.id);

  const deletedBookings = await deleteBookingsForCustomers(customerIds);
  console.log(`✓ removed ${deletedBookings} test booking(s)`);

  const profileIds = await listE2eAuthUserIds();

  for (const profileId of profileIds) {
    const { data: cleaner } = await client
      .from("cleaners")
      .select("id")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (cleaner?.id) {
      await client.from("cleaner_time_off").delete().eq("cleaner_id", cleaner.id);
      await client.from("cleaner_availability").delete().eq("cleaner_id", cleaner.id);
      await client.from("cleaner_service_capabilities").delete().eq("cleaner_id", cleaner.id);
      await client.from("cleaner_service_areas").delete().eq("cleaner_id", cleaner.id);
      await client.from("assignment_offers").delete().eq("cleaner_id", cleaner.id);
      await client.from("earning_lines").delete().eq("cleaner_id", cleaner.id);
      await client.from("cleaners").delete().eq("id", cleaner.id);
    }

    await client.from("customers").delete().eq("profile_id", profileId);
    await client.from("profiles").delete().eq("id", profileId);

    const { error: authErr } = await client.auth.admin.deleteUser(profileId);
    if (authErr) console.warn(`auth delete ${profileId}:`, authErr.message);
  }

  console.log(`✓ removed ${profileIds.length} E2E auth user(s)`);
  console.log("\nServices catalog preserved. Rerun: npm run e2e:seed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
