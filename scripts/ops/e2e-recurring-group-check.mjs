#!/usr/bin/env node
/**
 * E2E diagnostic for recurring schedule groups (audit-only).
 *
 * Usage:
 *   npm run ops:e2e:recurring-group
 *   npm run ops:e2e:recurring-group -- --group-id=<uuid>
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import {
  buildRecurringGroupE2eReport,
  deriveGroupLaunchRecommendation,
} from "./lib/recurring-group-e2e.mjs";
import { deriveSoakStatus } from "./lib/recurring-integrity.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

const groupIdArg = process.argv.find((a) => a.startsWith("--group-id="));
const filterGroupId = groupIdArg ? groupIdArg.split("=")[1]?.trim() : null;

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

function printReport(report) {
  console.log("Recurring group E2E diagnostic (audit-only)\n");
  if (filterGroupId) {
    console.log(`Filter: group ${filterGroupId}\n`);
  }

  console.log("Metrics");
  console.log(`  Schedule groups:              ${report.metrics.groupCount}`);
  console.log(`  Grouped series rows:          ${report.metrics.groupedSeriesCount}`);
  console.log(`  Synthetic anchors:          ${report.metrics.syntheticAnchorCount}`);
  console.log(`  Real visit bookings:          ${report.metrics.realVisitCount}`);
  console.log(`  Unpaid child visits:          ${report.metrics.unpaidChildCount}`);
  console.log(`  Unpaid cleaner-visible risk:  ${report.metrics.unpaidCleanerVisibleRisk}`);
  console.log(`  Open group/series requests:   ${report.metrics.openGroupRequestsCount}`);
  console.log(`  Group integrity issues:       ${report.metrics.integrityIssueCount} (${report.metrics.criticalIssueCount} critical)`);

  if (report.latestRun?.completed_at) {
    console.log(
      `  Latest generation run:        ${report.latestRun.status} @ ${report.latestRun.completed_at}`,
    );
  } else {
    console.log("  Latest generation run:        (none)");
  }

  console.log("\nRoute & schema artifacts");
  for (const r of report.routeChecks) {
    const icon = r.ok ? "✓" : "✗";
    console.log(`  ${icon} ${r.code}`);
  }

  if (report.groups.length > 0) {
    console.log("\nGroups");
    for (const g of report.groups) {
      console.log(
        `  ${g.groupId.slice(0, 8)}… ${g.frequency} ${g.status} · days=${g.selectedDaysCount} series=${g.linkedSeriesCount} weekdays=[${g.weekdays.join(",")}]`,
      );
    }
  }

  if (report.integrityIssues.length > 0) {
    console.log("\nIntegrity findings");
    for (const i of report.integrityIssues) {
      console.log(`  [${i.severity}] ${i.code}: ${i.detail}`);
    }
  }

  const launchRec = deriveGroupLaunchRecommendation(report);
  console.log(`\nStatus: ${report.status}`);
  console.log(`Launch recommendation: ${launchRec}`);

  if (report.blockers.length > 0) {
    console.log("\nBlockers:");
    for (const b of report.blockers) console.log(`  - ${b}`);
  }
  if (report.recommendations.length > 0) {
    console.log("\nRecommended actions:");
    for (const r of report.recommendations) console.log(`  - ${r}`);
  }
}

async function main() {
  const { data: groupRows, error: groupErr } = await client
    .from("recurring_schedule_groups")
    .select("id, customer_id, status, frequency, selected_days, anchor_booking_id");
  if (groupErr) {
    console.error(groupErr.message);
    process.exit(1);
  }

  if (filterGroupId && !(groupRows ?? []).some((g) => g.id === filterGroupId)) {
    console.error(`Group ${filterGroupId} not found.`);
    process.exit(1);
  }

  const { data: seriesRows, error: seriesErr } = await client
    .from("booking_series")
    .select("id, customer_id, group_id, weekday, status, frequency");
  if (seriesErr) {
    console.error(seriesErr.message);
    process.exit(1);
  }

  const seriesIds = (seriesRows ?? []).map((s) => s.id);
  let bookings = [];
  if (seriesIds.length > 0) {
    const { data, error: bookErr } = await client
      .from("bookings")
      .select(
        "id, customer_id, series_id, status, scheduled_start, price_cents, metadata, created_at, synthetic_anchor, cleaner_id",
      )
      .in("series_id", seriesIds);
    if (bookErr) {
      console.error(bookErr.message);
      process.exit(1);
    }
    bookings = data ?? [];
  }

  const paidBookingIds = await loadPaidBookingIds(bookings.map((b) => b.id));

  const { data: requestRows } = await client
    .from("recurring_series_requests")
    .select("id, series_id, group_id, customer_id, scope, target_weekday, status");

  const { data: latestRun } = await client
    .from("recurring_generation_runs")
    .select("completed_at, status")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const report = buildRecurringGroupE2eReport({
    groupRows: groupRows ?? [],
    seriesRows: seriesRows ?? [],
    bookings,
    paidBookingIds,
    requestRows: requestRows ?? [],
    latestRun,
    filterGroupId,
  });

  printReport(report);

  if (report.status === "FAIL") process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
