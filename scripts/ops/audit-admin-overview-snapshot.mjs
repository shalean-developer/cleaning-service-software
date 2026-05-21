#!/usr/bin/env node
/**
 * Dry-run audit for /admin overview snapshot zeros.
 * Usage: node scripts/ops/audit-admin-overview-snapshot.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

const WIZARD_TIMEZONE = "Africa/Johannesburg";

function johannesburgCalendarDayKey(reference = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference);
}

function addDaysToDateString(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function johannesburgDayUtcBounds(dayKey) {
  const start = new Date(`${dayKey}T00:00:00+02:00`);
  const nextDay = addDaysToDateString(dayKey, 1);
  const endExclusive = new Date(`${nextDay}T00:00:00+02:00`);
  return {
    startIso: start.toISOString(),
    endExclusiveIso: endExclusive.toISOString(),
  };
}

function scheduleStartToBookingDate(scheduledStart) {
  const instant = new Date(scheduledStart);
  if (Number.isNaN(instant.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

const TODAY_EXCLUDED = new Set(["cancelled", "draft"]);
const ACTIVE_CLEANER = new Set([
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
]);

async function main() {
  const now = new Date();
  const dayKey = johannesburgCalendarDayKey(now);
  const bounds = johannesburgDayUtcBounds(dayKey);

  console.log("=== Admin overview snapshot audit ===\n");
  console.log(`Server now (UTC):     ${now.toISOString()}`);
  console.log(`SAST today key:       ${dayKey}`);
  console.log(`Query start (UTC):    ${bounds.startIso}`);
  console.log(`Query end excl (UTC): ${bounds.endExclusiveIso}\n`);

  const { count: totalBookings, error: totalErr } = await client
    .from("bookings")
    .select("*", { count: "exact", head: true });
  if (totalErr) throw totalErr;

  const { data: allBookings, error: allErr } = await client
    .from("bookings")
    .select("id, status, cleaner_id, price_cents, scheduled_start, scheduled_end, updated_at, created_at")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (allErr) throw allErr;

  console.log(`Total bookings in DB: ${totalBookings ?? 0}`);
  console.log("\n--- All bookings (up to 20) ---");
  for (const row of allBookings ?? []) {
    const jhbDay = scheduleStartToBookingDate(row.scheduled_start);
    const inRange =
      row.scheduled_start >= bounds.startIso && row.scheduled_start < bounds.endExclusiveIso;
    console.log(
      `  ${row.id.slice(0, 8)}… status=${row.status} cleaner_id=${row.cleaner_id ? "yes" : "no"} scheduled_start=${row.scheduled_start}`,
    );
    console.log(
      `    SAST calendar day: ${jhbDay} | in today's UTC range: ${inRange} | matches SAST today: ${jhbDay === dayKey}`,
    );
  }

  const { data: todayRows, error: todayErr } = await client
    .from("bookings")
    .select("id, status, cleaner_id, price_cents, scheduled_start")
    .gte("scheduled_start", bounds.startIso)
    .lt("scheduled_start", bounds.endExclusiveIso);
  if (todayErr) throw todayErr;

  const filtered = (todayRows ?? []).filter((r) => !TODAY_EXCLUDED.has(r.status));
  const cleanersActive = new Set(
    filtered
      .filter((r) => r.cleaner_id && ACTIVE_CLEANER.has(r.status))
      .map((r) => r.cleaner_id),
  ).size;

  console.log("\n--- loadAdminOverviewTodayCounts equivalent ---");
  console.log(`  Raw range query rows:     ${todayRows?.length ?? 0}`);
  console.log(`  After status filter:      ${filtered.length}`);
  console.log(`  cleanersActive:           ${cleanersActive}`);

  const bookingIds = filtered.map((r) => r.id);
  let revenueTodayCents = 0;
  let paidCount = 0;
  if (bookingIds.length > 0) {
    const { data: payments, error: payErr } = await client
      .from("payments")
      .select("id, amount_cents, booking_id, status, updated_at")
      .eq("status", "paid")
      .in("booking_id", bookingIds);
    if (payErr) throw payErr;
    paidCount = payments?.length ?? 0;
    revenueTodayCents = (payments ?? []).reduce((s, p) => s + p.amount_cents, 0);
  }

  const { count: totalPaid, error: allPaidErr } = await client
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("status", "paid");
  if (allPaidErr) throw allPaidErr;

  const { data: allPayments, error: paymentsListErr } = await client
    .from("payments")
    .select("id, amount_cents, booking_id, status, updated_at")
    .limit(20);
  if (paymentsListErr) throw paymentsListErr;

  console.log(`  paid payments for today IDs: ${paidCount}`);
  console.log(`  revenueTodayCents:         ${revenueTodayCents}`);
  console.log(`  total paid payments in DB: ${totalPaid ?? 0}`);

  console.log("\n--- All payments (up to 20) ---");
  for (const p of allPayments ?? []) {
    console.log(
      `  ${p.id?.slice?.(0, 8) ?? p.id}… status=${p.status} amount_cents=${p.amount_cents} booking_id=${p.booking_id?.slice?.(0, 8) ?? p.booking_id}`,
    );
  }

  // Queue counts for active issues
  const filters = [
    ["payment_failed", "payment_attention"],
    ["pending_assignment", "needs_assignment"],
    ["dispatch_not_started", "dispatch_not_started"],
    ["recovery_needed", "recovery_needed"],
    ["assignment_attention", "assignment_attention"],
  ];

  console.log("\n--- Operational queue filters (exact count queries) ---");
  for (const [filter] of filters) {
    // Simplified: just count payment_failed and pending_assignment via status
    if (filter === "payment_failed") {
      const { count } = await client
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "payment_failed");
      console.log(`  payment_failed (status): ${count ?? 0}`);
    }
    if (filter === "pending_assignment") {
      const { count } = await client
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_assignment");
      console.log(`  pending_assignment:      ${count ?? 0}`);
    }
  }

  const nullSchedule = (allBookings ?? []).filter((r) => !r.scheduled_start).length;
  console.log(`\nBookings with null scheduled_start: ${nullSchedule}`);

  // Recent audits (feed source)
  const { data: recentAudits, error: auditErr } = await client
    .from("booking_state_audit")
    .select("id, booking_id, command, to_status, created_at")
    .not("booking_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (auditErr) throw auditErr;

  console.log("\n--- Recent booking_state_audit (feed source, top 5) ---");
  for (const a of recentAudits ?? []) {
    console.log(`  ${a.created_at} command=${a.command} booking=${a.booking_id?.slice(0, 8)}…`);
  }

  const BOOKING_AUDIT_FEED_COMMANDS = new Set([
    "FINALIZE_PAYMENT_SUCCESS",
    "CONFIRM_PAYMENT",
    "MARK_PAYMENT_FAILED",
    "MOVE_TO_PENDING_ASSIGNMENT",
    "OFFER_TO_CLEANER",
    "ACCEPT_CLEANER_ASSIGNMENT",
    "RECORD_ASSIGNMENT_OFFER_EXPIRED",
    "EXPIRE_ASSIGNMENT_OFFER",
    "MARK_IN_PROGRESS",
    "MARK_COMPLETED",
    "MARK_PAYOUT_READY",
    "MARK_PAID_OUT",
    "CANCEL_BOOKING",
  ]);
  const feedEligible = (recentAudits ?? []).filter(
    (a) => a.command && BOOKING_AUDIT_FEED_COMMANDS.has(a.command),
  ).length;
  console.log(`  Of top 5, whitelist-eligible: ${feedEligible}`);

  console.log("\n=== Diagnosis hint ===");
  if ((totalBookings ?? 0) === 0) {
    console.log("ROOT: No bookings in DB — zeros are CORRECT (data absence).");
  } else if (filtered.length === 0) {
    console.log(
      "ROOT: Bookings exist but NONE scheduled for SAST today — zeros are CORRECT for 'today' metrics.",
    );
    console.log("      Feed/alerts may still show data from audit history or non-today bookings.");
  } else {
    console.log("ROOT: Today bookings exist — if UI still shows 0, suspect loader/auth/RLS, not empty DB.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
