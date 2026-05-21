#!/usr/bin/env node
/**
 * Production soak checklist for recurring bookings (audit-only, no mutations).
 *
 * Usage: npm run ops:soak:recurring-bookings
 * Optional safe seed: npm run ops:soak:recurring-bookings -- --dry-run-seed  (no-op placeholder)
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import {
  buildRecurringIntegrityIssues,
  deriveSoakStatus,
  OVERDUE_PAYMENT_MS,
} from "./lib/recurring-integrity.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

const dryRunSeed = process.argv.includes("--dry-run-seed");
if (dryRunSeed) {
  console.log("Note: --dry-run-seed is a no-op placeholder; this script never mutates data.\n");
}

const PAID_STATUSES = new Set([
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);
const UNPAID_STATUSES = new Set(["pending_payment", "draft", "payment_failed"]);
const COMPLETED = new Set(["completed", "payout_ready", "paid_out"]);
const CLEANER_VISIBLE = new Set([
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

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

async function latestSeriesAudit(series) {
  const { data } = await client
    .from("booking_state_audit")
    .select("command, actor_type, created_at")
    .eq("booking_id", series.created_from_booking_id)
    .like("command", "RECURRING_%")
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

async function main() {
  console.log("Recurring bookings soak checklist (read-only)\n");

  const { data: seriesRows, error: seriesError } = await client.from("booking_series").select("*");
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
    )
    .not("series_id", "is", null);
  if (bookingsError) {
    console.error(bookingsError.message);
    process.exit(1);
  }

  const bookingList = bookings ?? [];
  const paidBookingIds = await loadPaidBookingIds(bookingList.map((b) => b.id));

  const globalIssues = buildRecurringIntegrityIssues({
    seriesRows: seriesRows ?? [],
    bookings: bookingList,
    paidBookingIds,
    groupRows: groupRows ?? [],
  });

  const activeSeries = (seriesRows ?? []).filter((s) => s.status === "active");

  for (const s of activeSeries) {
    const children = bookingList.filter((b) => b.series_id === s.id);
    const generated = children.filter((b) => b.metadata?.recurring?.generated === true);
    const unpaid = children.filter((b) => UNPAID_STATUSES.has(b.status));
    const paid = children.filter((b) => PAID_STATUSES.has(b.status));
    const completed = children.filter((b) => COMPLETED.has(b.status));

    const slotCounts = new Map();
    for (const b of children) {
      const key = b.scheduled_start;
      slotCounts.set(key, (slotCounts.get(key) ?? 0) + 1);
    }
    const duplicateSlots = [...slotCounts.entries()].filter(([, c]) => c > 1);

    const cleanerRisks = children.filter(
      (b) =>
        b.metadata?.recurring?.generated === true &&
        CLEANER_VISIBLE.has(b.status) &&
        !paidBookingIds.has(b.id),
    );

    const overdueUnpaid = unpaid.filter((b) => {
      if (b.status !== "pending_payment") return false;
      return Date.now() - new Date(b.created_at).getTime() > OVERDUE_PAYMENT_MS;
    });

    const audit = await latestSeriesAudit(s);

    console.log(`── Series ${s.id} (${s.frequency}, ${s.status})`);
    console.log(`   next_occurrence_at: ${s.next_occurrence_at ?? "(null)"}`);
    console.log(`   generated children: ${generated.length}`);
    console.log(`   unpaid / paid / completed: ${unpaid.length} / ${paid.length} / ${completed.length}`);
    console.log(
      `   duplicate slot check: ${duplicateSlots.length === 0 ? "OK" : `FAIL ${duplicateSlots.length}`}`,
    );
    console.log(
      `   cleaner visibility risk: ${cleanerRisks.length === 0 ? "OK" : `FAIL ${cleanerRisks.length}`}`,
    );
    console.log(
      `   payment-required age: ${overdueUnpaid.length === 0 ? "OK" : `${overdueUnpaid.length} overdue`}`,
    );
    console.log(
      `   latest action: ${audit ? `${audit.command} (${audit.actor_type})` : "none"}`,
    );
    console.log("");
  }

  const status = deriveSoakStatus(globalIssues);
  console.log("═══════════════════════════════════════");
  console.log(`SOAK STATUS: ${status}`);
  console.log(`Global issues: ${globalIssues.length}`);
  console.log(`Active series checked: ${activeSeries.length}`);

  if (globalIssues.length > 0) {
    console.log("\nIssues:");
    for (const i of globalIssues) {
      console.log(`  [${i.severity}] ${i.code}: ${i.detail}`);
    }
  }

  if (status === "PASS") {
    console.log("\nRecommended next action: proceed with production soak per docs/recurring-production-soak-plan.md");
  } else if (status === "WARN") {
    console.log("\nRecommended next action: review warnings; run npm run ops:audit:recurring-bookings");
  } else {
    console.log("\nRecommended next action: fix critical issues before production launch");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
