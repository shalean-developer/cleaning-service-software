#!/usr/bin/env node
/**
 * Read-only audit for /admin overview dashboard data sources.
 * Usage: npm run ops:audit:admin-overview
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

const WIZARD_TIMEZONE = "Africa/Johannesburg";
const TODAY_EXCLUDED = new Set(["cancelled", "draft"]);
const ACTIVE_CLEANER = new Set([
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
]);
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

function formatUpcomingDayLabel(scheduledStart, todayKey) {
  const bookingDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(scheduledStart));
  const tomorrowKey = addDaysToDateString(todayKey, 1);
  if (bookingDay === tomorrowKey) return "tomorrow";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: WIZARD_TIMEZONE,
  }).format(new Date(scheduledStart));
}

async function countBookingsStatus(status) {
  const { count, error } = await client
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", status);
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const now = new Date();
  const dayKey = johannesburgCalendarDayKey(now);
  const bounds = johannesburgDayUtcBounds(dayKey);
  const statusNotIn = '("cancelled","draft")';

  console.log("=== Admin overview page audit (read-only) ===\n");
  console.log(`Server now (UTC):     ${now.toISOString()}`);
  console.log(`SAST today key:       ${dayKey}`);
  console.log(`Query start (UTC):    ${bounds.startIso}`);
  console.log(`Query end excl (UTC): ${bounds.endExclusiveIso}\n`);

  const { count: totalBookings } = await client
    .from("bookings")
    .select("*", { count: "exact", head: true });

  const { data: todayRows } = await client
    .from("bookings")
    .select("id, status, cleaner_id, price_cents, scheduled_start")
    .gte("scheduled_start", bounds.startIso)
    .lt("scheduled_start", bounds.endExclusiveIso);

  const todayFiltered = (todayRows ?? []).filter((r) => !TODAY_EXCLUDED.has(r.status));
  const cleanersActive = new Set(
    todayFiltered
      .filter((r) => r.cleaner_id && ACTIVE_CLEANER.has(r.status))
      .map((r) => r.cleaner_id),
  ).size;

  const bookingIds = todayFiltered.map((r) => r.id);
  let revenueTodayCents = 0;
  if (bookingIds.length > 0) {
    const { data: payments } = await client
      .from("payments")
      .select("amount_cents")
      .eq("status", "paid")
      .in("booking_id", bookingIds);
    revenueTodayCents = (payments ?? []).reduce((s, p) => s + p.amount_cents, 0);
  }

  const { count: upcomingBookings } = await client
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .gte("scheduled_start", bounds.endExclusiveIso)
    .not("status", "in", statusNotIn);

  const { data: nextUpcoming } = await client
    .from("bookings")
    .select("scheduled_start")
    .gte("scheduled_start", bounds.endExclusiveIso)
    .not("status", "in", statusNotIn)
    .order("scheduled_start", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { count: totalCustomers } = await client
    .from("customers")
    .select("*", { count: "exact", head: true });

  const { count: totalCleaners } = await client
    .from("cleaners")
    .select("*", { count: "exact", head: true });

  const { count: totalPaidPayments } = await client
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("status", "paid");

  const activeIssues =
    (await countBookingsStatus("payment_failed")) +
    (await countBookingsStatus("pending_assignment"));

  const { count: payoutReady } = await client
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "payout_ready");

  const { data: bookingAudits } = await client
    .from("booking_state_audit")
    .select("id, booking_id, command, to_status, created_at")
    .order("created_at", { ascending: false })
    .limit(60);

  const feedEligible = (bookingAudits ?? []).filter(
    (a) =>
      (a.command && BOOKING_AUDIT_FEED_COMMANDS.has(a.command)) ||
      (!a.command && a.to_status),
  );
  const archivedAudits = (bookingAudits ?? []).filter((a) => !a.booking_id).length;

  const { data: supportScan } = await client
    .from("bookings")
    .select("id, metadata, updated_at")
    .order("updated_at", { ascending: false })
    .limit(40);

  console.log("--- Counts ---");
  console.log(`  total bookings:           ${totalBookings ?? 0}`);
  console.log(`  today bookings:           ${todayFiltered.length}`);
  console.log(`  upcoming bookings:        ${upcomingBookings ?? 0}`);
  console.log(`  next upcoming:            ${nextUpcoming?.scheduled_start ?? "—"}`);
  if (nextUpcoming?.scheduled_start) {
    console.log(`  next upcoming label:      ${formatUpcomingDayLabel(nextUpcoming.scheduled_start, dayKey)}`);
  }
  console.log(`  total customers:          ${totalCustomers ?? 0}`);
  console.log(`  total cleaners:           ${totalCleaners ?? 0}`);
  console.log(`  today assigned cleaners:  ${cleanersActive}`);
  console.log(`  total paid payments:      ${totalPaidPayments ?? 0}`);
  console.log(`  today revenue (cents):    ${revenueTodayCents}`);
  console.log(`  active issue proxy:       ${activeIssues}`);
  console.log(`  payout-ready bookings:    ${payoutReady ?? 0}`);
  console.log(`  support scan rows:        ${supportScan?.length ?? 0}`);
  console.log(`  recent audit rows:        ${bookingAudits?.length ?? 0}`);
  console.log(`  feed-eligible (of 60):    ${feedEligible.length}`);
  console.log(`  archived (null booking):  ${archivedAudits}`);

  console.log("\n--- Loader snapshot (presentation) ---");
  const snapshot = {
    bookingsToday: todayFiltered.length,
    bookingsConfirmed: todayFiltered.filter((r) => r.status === "confirmed").length,
    bookingsDone: todayFiltered.filter((r) =>
      ["completed", "payout_ready", "paid_out"].includes(r.status),
    ).length,
    cleanersActive,
    revenueTodayCents,
    activeIssues,
  };
  console.log(JSON.stringify(snapshot, null, 2));

  const upcomingSuffix =
    snapshot.bookingsToday === 0 && (upcomingBookings ?? 0) > 0
      ? ` · ${upcomingBookings} upcoming ${nextUpcoming?.scheduled_start ? formatUpcomingDayLabel(nextUpcoming.scheduled_start, dayKey) : "soon"}`
      : "";
  console.log(
    `\nUI summary line: ${snapshot.bookingsToday} bookings · ${snapshot.cleanersActive} cleaners on duty${upcomingSuffix}`,
  );

  console.log("\n=== Done (no writes) ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
