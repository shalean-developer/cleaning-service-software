#!/usr/bin/env node
/**
 * Audit recurring series integrity (dry-run).
 *
 * Usage: npm run ops:audit:recurring-bookings
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import { buildRecurringIntegrityIssues } from "./lib/recurring-integrity.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

async function loadPaidBookingIds(bookingIds) {
  const paid = new Set();
  if (bookingIds.length === 0) return paid;
  const { data } = await client
    .from("payments")
    .select("booking_id")
    .in("booking_id", bookingIds)
    .eq("status", "paid");
  for (const p of data ?? []) {
    if (p.booking_id) paid.add(p.booking_id);
  }
  return paid;
}

async function main() {
  console.log("Recurring bookings audit (dry-run)\n");

  const { data: seriesRows, error: seriesError } = await client
    .from("booking_series")
    .select(
      "id, customer_id, status, next_occurrence_at, created_from_booking_id, frequency, updated_at, group_id, weekday",
    );
  if (seriesError) {
    console.error(seriesError.message);
    process.exit(1);
  }

  const { data: groupRows, error: groupError } = await client
    .from("recurring_schedule_groups")
    .select("id, customer_id, status, frequency, selected_days");
  if (groupError) {
    console.error(groupError.message);
    process.exit(1);
  }

  const { data: bookings, error: bookingsError } = await client
    .from("bookings")
    .select(
      "id, customer_id, series_id, status, scheduled_start, price_cents, metadata, created_at, synthetic_anchor",
    );
  if (bookingsError) {
    console.error(bookingsError.message);
    process.exit(1);
  }

  const seriesIds = new Set((seriesRows ?? []).map((s) => s.id));
  const bookingList = bookings ?? [];

  const paidBookingIds = await loadPaidBookingIds(
    bookingList.filter((b) => b.series_id).map((b) => b.id),
  );

  const issues = buildRecurringIntegrityIssues({
    seriesRows: seriesRows ?? [],
    bookings: bookingList,
    paidBookingIds,
    groupRows: groupRows ?? [],
  });

  const paidStatuses = new Set([
    "confirmed",
    "pending_assignment",
    "assigned",
    "in_progress",
    "completed",
    "payout_ready",
    "paid_out",
  ]);

  for (const b of bookingList) {
    const meta = b.metadata ?? {};
    const quote = meta.quote?.input ?? {};
    const freq = quote.frequency ?? meta.frequency ?? "once";
    if (freq !== "once" && !b.series_id && paidStatuses.has(b.status)) {
      issues.push({
        code: "PAID_METADATA_NO_SERIES",
        severity: "warning",
        detail: `booking ${b.id} frequency=${freq} status=${b.status} without series_id`,
      });
    }
    if (meta.recurring?.generated === true && !b.series_id) {
      issues.push({
        code: "GENERATED_CHILD_NO_SERIES",
        severity: "critical",
        detail: `booking ${b.id} recurring.generated without series_id`,
      });
    }
  }

  for (const s of seriesRows ?? []) {
    const anchor = bookingList.find((b) => b.id === s.created_from_booking_id);
    if (!anchor) {
      issues.push({
        code: "SERIES_MISSING_ANCHOR_BOOKING",
        severity: "critical",
        detail: `series ${s.id} anchor booking missing`,
        seriesId: s.id,
      });
    } else if (anchor.series_id !== s.id) {
      issues.push({
        code: "ANCHOR_NOT_LINKED",
        severity: "critical",
        detail: `anchor booking ${anchor.id} series_id mismatch`,
        seriesId: s.id,
        bookingId: anchor.id,
      });
    }
  }

  const monthlySeries = (seriesRows ?? []).filter((s) => s.frequency === "monthly");
  for (const s of monthlySeries) {
    if (s.next_occurrence_at) {
      const day = new Date(s.next_occurrence_at).getUTCDate();
      const anchorDay = new Date(s.anchor_scheduled_start).getUTCDate();
      if (day > 28 && anchorDay >= 29) {
        issues.push({
          code: "MONTHLY_EOM_EDGE",
          severity: "warning",
          detail: `series ${s.id} anchor day ${anchorDay} next day ${day} (review clamp)`,
          seriesId: s.id,
        });
      }
    }
  }

  console.log(`Series rows: ${(seriesRows ?? []).length}`);
  console.log(`Bookings with series_id: ${bookingList.filter((b) => b.series_id).length}`);
  console.log(`Issues: ${issues.length}\n`);

  if (issues.length === 0) {
    console.log("No recurring integrity issues detected.");
    return;
  }

  for (const issue of issues) {
    console.log(`  [${issue.severity ?? "warn"}] ${issue.code} ${issue.detail}`);
  }
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
