/**
 * Production-safe full clear of operational booking/customer/cleaner data.
 * Does not touch services, pricing catalog, site/SEO content, or admin profiles.
 *
 * Append-only / event-log tables are never deleted (DB triggers forbid DELETE).
 */

import { isE2eEmail } from "../../e2e/lib/constants.mjs";
import { PROTECTED_CUSTOMER_EMAILS } from "./mock-customer-patterns.mjs";
import { hasExplicitTestProfileEmail } from "./mock-profile-patterns.mjs";

export const CONFIRM_ENV_VAR = "CONFIRM_CLEAR_OPERATIONAL_DATA";

/** Tables removed by ops:clear-operational-data (dependency order). */
export const CLEAR_STEPS = [
  { step: 1, label: "dispatch_offers", tables: ["assignment_offers"] },
  { step: 2, label: "booking_assignments", tables: ["booking_cleaners"] },
  { step: 3, label: "cleaner_earnings_and_payout_lines", tables: ["earning_lines"] },
  { step: 4, label: "cleaner_payout_batches", tables: ["payout_batches"] },
  { step: 5, label: "payments", tables: ["payments"], notes: ["payment_events detached first"] },
  { step: 6, label: "booking_locks", tables: ["booking_locks"] },
  {
    step: 7,
    label: "bookings",
    tables: ["bookings"],
    extraCounts: ["bookings_with_series"],
    notes: ["may fail if append-only booking_state_audit rows exist (preserved)"],
  },
  { step: 8, label: "customers", tables: ["customers"] },
  {
    step: 9,
    label: "cleaner_availability_and_eligibility",
    tables: [
      "cleaner_time_off",
      "cleaner_availability",
      "cleaner_service_capabilities",
      "cleaner_service_areas",
    ],
  },
  { step: 10, label: "cleaners", tables: ["cleaners"] },
  { step: 11, label: "customer_cleaner_profiles", tables: ["profiles_customer_cleaner"] },
  { step: 12, label: "test_mock_auth_users", tables: ["auth_users_test_mock"] },
];

/**
 * Append-only audit / event / analytics tables — counted, never deleted.
 * @type {Array<{ table: string; reason: string }>}
 */
export const PRESERVED_APPEND_ONLY_TABLES = [
  {
    table: "booking_state_audit",
    reason: "immutable booking lifecycle audit (DELETE trigger forbidden)",
  },
  {
    table: "admin_operational_audit",
    reason: "immutable admin ops audit (DELETE trigger forbidden)",
  },
  {
    table: "customer_operational_audit",
    reason: "immutable customer ops audit (DELETE trigger forbidden)",
  },
  {
    table: "cleaner_operational_audit",
    reason: "immutable cleaner ops audit (DELETE trigger forbidden)",
  },
  {
    table: "payment_events",
    reason: "raw Paystack/webhook event log (preserved; payments detached first)",
  },
  {
    table: "notification_outbox",
    reason: "reliable notification queue / delivery log",
  },
  {
    table: "notification_worker_runs",
    reason: "append-only notification worker run log",
  },
  {
    table: "notification_metrics_hourly",
    reason: "hourly notification telemetry rollup",
  },
  {
    table: "deferred_dispatch_cron_runs",
    reason: "append-only deferred dispatch cron log",
  },
  {
    table: "recurring_generation_runs",
    reason: "append-only recurring generation cron log",
  },
  {
    table: "assignment_metrics_hourly",
    reason: "hourly assignment analytics rollup",
  },
];

/** Catalog / identity tables never cleared by this workflow. */
export const PRESERVED_CONFIG_TABLES = [
  { table: "services", reason: "pricing / service catalog" },
  { table: "profiles_admin", reason: "admin profiles" },
  { table: "auth_users_protected", reason: "production auth users" },
  {
    table: "auth_users_orphan_after_profile_clear",
    reason: "kept auth users (reprovision customer/cleaner on login)",
  },
];

/** Known log table names to probe; missing tables are skipped. */
export const OPTIONAL_PRESERVED_LOG_TABLES = ["webhook_logs", "analytics_events"];

const CHUNK = 500;

/**
 * @param {unknown} err
 */
export function formatSupabaseError(err) {
  if (err && typeof err === "object" && "message" in err) {
    const e = /** @type {{ message?: string; code?: string; details?: string }} */ (err);
    return [e.code, e.message, e.details].filter(Boolean).join(" — ");
  }
  return String(err);
}

/** @type {Record<string, string>} */
const TABLE_PRIMARY_KEY = {
  notification_metrics_hourly: "bucket_start",
  assignment_metrics_hourly: "bucket_start",
};

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table
 */
export async function countTable(client, table) {
  if (table === "profiles_customer_cleaner") {
    const { count, error } = await client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["customer", "cleaner"]);
    if (error) throw error;
    return count ?? 0;
  }

  if (table === "profiles_admin") {
    const { count, error } = await client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (error) throw error;
    return count ?? 0;
  }

  if (table === "bookings_with_series") {
    const { count, error } = await client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .not("series_id", "is", null);
    if (error) throw error;
    return count ?? 0;
  }

  if (table === "auth_users_test_mock" || table === "auth_users_protected") {
    return 0;
  }

  const pkColumn = TABLE_PRIMARY_KEY[table] ?? "id";
  const { count, error } = await client
    .from(table)
    .select(pkColumn, { count: "exact", head: true });
  if (error) throw new Error(`count ${table}: ${error.message || JSON.stringify(error)}`);
  return count ?? 0;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table
 */
async function tableExists(client, table) {
  const pkColumn = TABLE_PRIMARY_KEY[table] ?? "id";
  const { error } = await client.from(table).select(pkColumn, { head: true, count: "exact" });
  if (!error) return true;
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("does not exist") || error.code === "42P01" || error.code === "PGRST205") {
    return false;
  }
  throw new Error(`probe ${table}: ${error.message}`);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function collectOperationalCounts(client) {
  const counts = /** @type {Record<string, number>} */ ({});

  for (const step of CLEAR_STEPS) {
    for (const table of step.tables) {
      if (!(table in counts)) {
        counts[table] = await countTable(client, table);
      }
    }
    for (const extra of step.extraCounts ?? []) {
      counts[extra] = await countTable(client, extra);
    }
  }

  for (const { table } of PRESERVED_APPEND_ONLY_TABLES) {
    counts[table] = await countTable(client, table);
  }

  for (const { table } of PRESERVED_CONFIG_TABLES) {
    if (table.startsWith("auth_users_")) continue;
    counts[table] = await countTable(client, table);
  }

  for (const table of OPTIONAL_PRESERVED_LOG_TABLES) {
    if (await tableExists(client, table)) {
      counts[table] = await countTable(client, table);
    } else {
      counts[table] = -1;
    }
  }

  const authSummary = await summarizeAuthDeletionCandidates(client);
  counts.auth_users_test_mock = authSummary.deletable;
  counts.auth_users_protected = authSummary.protected;
  counts.auth_users_orphan_after_profile_clear = authSummary.orphanKept;

  return counts;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function loadCustomerCleanerProfiles(client) {
  const { data, error } = await client
    .from("profiles")
    .select("id, role, full_name")
    .in("role", ["customer", "cleaner"]);
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function listAuthEmailsByProfileId(client) {
  /** @type {Map<string, string>} */
  const byId = new Map();
  let page = 1;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data.users ?? [];
    for (const user of users) {
      if (user.id && user.email) byId.set(user.id, user.email);
    }
    if (users.length < 200) break;
    page += 1;
  }
  return byId;
}

/**
 * @param {string | null | undefined} email
 */
export function isExplicitTestOrMockAuthEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return false;
  const e = email.toLowerCase().trim();
  if (PROTECTED_CUSTOMER_EMAILS.has(e) || e === "admin@shalean.co.za") return false;
  if (e.startsWith("purged+") && e.endsWith("@invalid.local")) return true;
  if (isE2eEmail(e)) return true;
  if (hasExplicitTestProfileEmail(e)) return true;
  if (e.includes("test_phase") || e.includes("test_e2e")) return true;
  if (e.includes("@invalid.local")) return true;
  return false;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function summarizeAuthDeletionCandidates(client) {
  const profiles = await loadCustomerCleanerProfiles(client);
  const emails = await listAuthEmailsByProfileId(client);

  let deletable = 0;
  let protectedCount = 0;
  let orphanKept = 0;

  for (const profile of profiles) {
    const email = emails.get(profile.id);
    if (!email) continue;
    if (isExplicitTestOrMockAuthEmail(email)) {
      deletable += 1;
    } else {
      protectedCount += 1;
      orphanKept += 1;
    }
  }

  return { deletable, protected: protectedCount, orphanKept };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function assertNoAdminProfileDeletion(client) {
  const profiles = await loadCustomerCleanerProfiles(client);
  const invalid = profiles.filter((p) => p.role === "admin");
  if (invalid.length > 0) {
    throw new Error(
      `Safety abort: customer/cleaner profile query returned ${invalid.length} admin row(s)`,
    );
  }

  const adminCount = await countTable(client, "profiles_admin");
  if (adminCount === 0) {
    console.warn("  Warning: no admin profiles found — verify this is expected.");
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table
 * @param {string} [idColumn]
 */
export async function deleteAllRows(client, table, idColumn = "id") {
  let total = 0;
  for (;;) {
    const { data, error } = await client.from(table).select(idColumn).limit(CHUNK);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) break;

    const ids = rows.map((r) => r[idColumn]);
    const { error: delErr } = await client.from(table).delete().in(idColumn, ids);
    if (delErr) throw delErr;
    total += ids.length;
    if (rows.length < CHUNK) break;
  }
  return total;
}

/**
 * Preserve webhook event rows before payment rows are removed.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function detachPaymentEventsFromPayments(client) {
  let detached = 0;
  for (;;) {
    const { data, error } = await client
      .from("payment_events")
      .select("id")
      .not("payment_id", "is", null)
      .limit(CHUNK);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) break;

    const ids = rows.map((r) => r.id);
    const { error: updErr } = await client
      .from("payment_events")
      .update({ payment_id: null })
      .in("id", ids);
    if (updErr) throw updErr;
    detached += ids.length;
    if (rows.length < CHUNK) break;
  }
  return detached;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function deleteAllBookings(client) {
  return deleteAllRows(client, "bookings", "id");
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function deleteCustomerCleanerProfiles(client) {
  const { data, error } = await client
    .from("profiles")
    .select("id, role")
    .in("role", ["customer", "cleaner"]);
  if (error) throw error;

  const ids = (data ?? []).map((p) => p.id);
  if (ids.length === 0) return 0;

  const chunkSize = 100;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { error: delErr } = await client.from("profiles").delete().in("id", chunk);
    if (delErr) throw delErr;
    deleted += chunk.length;
  }
  return deleted;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {Array<{ id: string; role: string; full_name?: string | null }>} [profiles]
 */
export async function deleteTestMockAuthUsers(client, profiles) {
  const rows = profiles ?? (await loadCustomerCleanerProfiles(client));
  const emails = await listAuthEmailsByProfileId(client);
  let deleted = 0;

  for (const profile of rows) {
    const email = emails.get(profile.id);
    if (!email || !isExplicitTestOrMockAuthEmail(email)) continue;
    const { error } = await client.auth.admin.deleteUser(profile.id);
    if (error) {
      console.warn(`  auth delete skipped ${email}: ${error.message}`);
      continue;
    }
    deleted += 1;
  }

  return deleted;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function executeOperationalClear(client) {
  await assertNoAdminProfileDeletion(client);

  const deleted = /** @type {Record<string, number>} */ ({});

  deleted.assignment_offers = await deleteAllRows(client, "assignment_offers");
  deleted.booking_cleaners = await deleteAllRows(client, "booking_cleaners");
  deleted.earning_lines = await deleteAllRows(client, "earning_lines");
  deleted.payout_batches = await deleteAllRows(client, "payout_batches");

  deleted.payment_events_detached = await detachPaymentEventsFromPayments(client);
  deleted.payments = await deleteAllRows(client, "payments");
  deleted.booking_locks = await deleteAllRows(client, "booking_locks");

  try {
    deleted.bookings = await deleteAllBookings(client);
  } catch (err) {
    deleted.bookings = 0;
    deleted.bookings_delete_blocked = 1;
    console.warn(
      "\n  Booking delete blocked.\n" +
        `  ${formatSupabaseError(err)}\n` +
        "  Apply migration 20260521120000_ops_preserve_append_only_audit_on_clear.sql if not yet deployed.\n" +
        "  Append-only audit rows are preserved (never DELETE'd).\n",
    );
  }

  try {
    deleted.customers = await deleteAllRows(client, "customers");
  } catch (err) {
    deleted.customers = 0;
    console.warn(`  Customer delete blocked: ${formatSupabaseError(err)}`);
  }

  deleted.cleaner_time_off = await deleteAllRows(client, "cleaner_time_off");
  deleted.cleaner_availability = await deleteAllRows(client, "cleaner_availability");
  deleted.cleaner_service_capabilities = await deleteAllRows(
    client,
    "cleaner_service_capabilities",
  );
  deleted.cleaner_service_areas = await deleteAllRows(client, "cleaner_service_areas");

  try {
    deleted.cleaners = await deleteAllRows(client, "cleaners");
  } catch (err) {
    deleted.cleaners = 0;
    console.warn(`  Cleaner delete blocked: ${formatSupabaseError(err)}`);
  }

  const profilesToRemove = await loadCustomerCleanerProfiles(client);
  deleted.auth_users_test_mock = await deleteTestMockAuthUsers(client, profilesToRemove);

  try {
    deleted.profiles_customer_cleaner = await deleteCustomerCleanerProfiles(client);
  } catch (err) {
    deleted.profiles_customer_cleaner = 0;
    console.warn(`  Profile delete blocked: ${formatSupabaseError(err)}`);
  }

  return deleted;
}

/**
 * @param {Record<string, number>} counts
 */
export function formatClearedTablesReport(counts) {
  const lines = ["Cleared operational tables (delete order):"];
  for (const step of CLEAR_STEPS) {
    const note = step.notes?.length ? ` — ${step.notes.join("; ")}` : "";
    lines.push(`  Step ${step.step}: ${step.label}${note}`);
    for (const table of step.tables) {
      lines.push(`    ${table.padEnd(34)} ${counts[table] ?? 0} row(s) now`);
    }
    for (const extra of step.extraCounts ?? []) {
      lines.push(`    ${extra.padEnd(34)} ${counts[extra] ?? 0} row(s) now`);
    }
  }
  return lines.join("\n");
}

/**
 * @param {Record<string, number>} counts
 */
export function formatPreservedAppendOnlyReport(counts) {
  const lines = ["Preserved append-only / event / analytics tables (never deleted):"];
  for (const { table, reason } of PRESERVED_APPEND_ONLY_TABLES) {
    lines.push(`    ${table.padEnd(34)} ${counts[table] ?? 0}  — ${reason}`);
  }
  for (const table of OPTIONAL_PRESERVED_LOG_TABLES) {
    const n = counts[table];
    if (n === -1) {
      lines.push(`    ${table.padEnd(34)} n/a   — not in schema`);
    } else {
      lines.push(`    ${table.padEnd(34)} ${n}  — preserved if present`);
    }
  }
  return lines.join("\n");
}

/**
 * @param {Record<string, number>} counts
 */
export function formatPreservedConfigReport(counts) {
  const lines = ["Preserved catalog / admin / auth (never deleted):"];
  for (const { table, reason } of PRESERVED_CONFIG_TABLES) {
    const value =
      table === "auth_users_protected" || table === "auth_users_orphan_after_profile_clear"
        ? (counts[table] ?? 0)
        : `${counts[table] ?? 0} (unchanged)`;
    lines.push(`    ${table.padEnd(34)} ${value}  — ${reason}`);
  }
  return lines.join("\n");
}

/**
 * @param {Record<string, number>} counts
 */
export function formatCountsReport(counts) {
  return [
    formatClearedTablesReport(counts),
    "",
    formatPreservedAppendOnlyReport(counts),
    "",
    formatPreservedConfigReport(counts),
  ].join("\n");
}

/**
 * @param {Record<string, number>} after
 */
export function operationalDataFullyCleared(after) {
  const keys = [
    "customers",
    "cleaners",
    "assignment_offers",
    "booking_cleaners",
    "payments",
    "earning_lines",
    "profiles_customer_cleaner",
  ];
  const coreCleared = keys.every((k) => (after[k] ?? 0) === 0);
  const bookingsRemaining = (after.bookings ?? 0) > 0;
  const auditPreserved = (after.booking_state_audit ?? 0) > 0;

  if (bookingsRemaining && auditPreserved) {
    return coreCleared;
  }
  return coreCleared && (after.bookings ?? 0) === 0;
}

/**
 * @param {Record<string, number>} counts
 */
export function bookingDeleteBlockedByAudit(counts) {
  return (counts.bookings ?? 0) > 0 && (counts.booking_state_audit ?? 0) > 0;
}
