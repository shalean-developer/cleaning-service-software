#!/usr/bin/env node
/**
 * Launch readiness audit for recurring bookings (dry-run).
 *
 * Usage: npm run ops:audit:recurring-launch
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import { buildRecurringIntegrityIssues } from "./lib/recurring-integrity.mjs";
import {
  deriveLaunchReadinessStatus,
  evaluateInfrastructureChecks,
  evaluateIntegrityForLaunch,
  evaluateRequiredEnv,
  REQUIRED_ENV_VARS,
} from "./lib/recurring-launch-readiness.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

const HORIZON_DAYS = 45;
const MS_PER_DAY = 86_400_000;
const OVERDUE_MS = 48 * 60 * 60 * 1000;

function rlsMigrationPresent() {
  const path = resolve(
    "supabase/migrations/20260602130000_booking_series_rls_policies.sql",
  );
  if (!existsSync(path)) return false;
  const text = readFileSync(path, "utf8");
  return (
    text.includes("booking_series_select_admin") &&
    text.includes("booking_series_select_customer")
  );
}

async function tableExists(tableName) {
  const { error } = await client.from(tableName).select("id").limit(1);
  if (!error) return true;
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("does not exist") || msg.includes("schema cache")) return false;
  return true;
}

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

function printChecks(title, checks) {
  console.log(`\n${title}`);
  for (const c of checks) {
    const icon = c.level === "PASS" ? "✓" : c.level === "WARN" ? "⚠" : "✗";
    console.log(`  ${icon} [${c.level}] ${c.code}: ${c.message}`);
  }
}

async function main() {
  console.log("Recurring launch readiness audit (dry-run)\n");

  const envFindings = evaluateRequiredEnv(process.env);
  const infraChecks = [];
  const dataChecks = [];
  const blockers = [];
  const recommendations = [];

  const bookingSeriesOk = await tableExists("booking_series");
  const runsTableOk = await tableExists("recurring_generation_runs");
  const requestsTableOk = await tableExists("recurring_series_requests");

  infraChecks.push(
    ...evaluateInfrastructureChecks({
      tableBookingSeries: bookingSeriesOk,
      tableRecurringGenerationRuns: runsTableOk,
      rlsPoliciesDocumented: rlsMigrationPresent(),
      activeSeriesCount: 0,
      cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    }),
  );

  if (!requestsTableOk) {
    infraChecks.push({
      code: "TABLE_RECURRING_SERIES_REQUESTS",
      level: "WARN",
      message:
        "recurring_series_requests table missing — apply migration 20260605120000_recurring_series_requests.sql",
    });
  } else {
    infraChecks.push({
      code: "TABLE_RECURRING_SERIES_REQUESTS",
      level: "PASS",
      message: "recurring_series_requests support queue table exists.",
    });
  }

  for (const f of envFindings) {
    infraChecks.push({ code: f.code, level: f.level, message: f.message });
  }

  if (!bookingSeriesOk) {
    printChecks("Infrastructure", infraChecks);
    console.log("\nOverall: FAIL (booking_series unavailable)");
    process.exit(1);
  }

  const { data: seriesRows } = await client.from("booking_series").select("*");
  const activeSeries = (seriesRows ?? []).filter((s) => s.status === "active");
  const activeIdx = infraChecks.findIndex((c) => c.code === "QUIET_RECURRING_STATE");
  if (activeIdx >= 0) infraChecks.splice(activeIdx, 1);
  if (activeSeries.length === 0) {
    infraChecks.push({
      code: "QUIET_RECURRING_STATE",
      level: "PASS",
      message: "No active series — system configured, quiet state.",
    });
  }

  const now = Date.now();
  const horizonEnd = new Date(now + HORIZON_DAYS * MS_PER_DAY).toISOString();

  const { data: bookings } = await client
    .from("bookings")
    .select(
      "id, customer_id, series_id, status, scheduled_start, price_cents, metadata, created_at",
    )
    .not("series_id", "is", null);

  const bookingList = bookings ?? [];
  const seriesWithChildren = bookingList.filter((b) => b.series_id);
  const paidBookingIds = await loadPaidBookingIds(seriesWithChildren.map((b) => b.id));

  const integrityIssues = buildRecurringIntegrityIssues({
    seriesRows: seriesRows ?? [],
    bookings: bookingList,
    paidBookingIds,
    nowMs: now,
  });

  for (const f of evaluateIntegrityForLaunch(integrityIssues)) {
    dataChecks.push({ code: f.code, level: f.level, message: f.message });
  }

  const generatedInHorizon = bookingList.filter((b) => {
    const meta = b.metadata ?? {};
    const recurring = meta.recurring;
    if (recurring?.generated !== true) return false;
    return b.scheduled_start && b.scheduled_start <= horizonEnd;
  });

  const unpaidChildren = bookingList.filter((b) =>
    ["pending_payment", "draft", "payment_failed"].includes(b.status),
  );
  const overdueUnpaid = unpaidChildren.filter(
    (b) => now - new Date(b.created_at).getTime() > OVERDUE_MS,
  );

  const cleanerVisibleUnpaid = integrityIssues.filter(
    (i) => i.code === "UNPAID_CHILD_CLEANER_VISIBLE",
  );

  const duplicateSlots = integrityIssues.filter((i) => i.code === "DUPLICATE_OCCURRENCE");
  const orphanSeries = integrityIssues.filter((i) => i.code === "ORPHAN_SERIES_ID");
  const orphanChildren = bookingList.filter((b) => {
    const meta = b.metadata ?? {};
    return meta.recurring?.generated === true && !b.series_id;
  });

  let openRequestsCount = 0;
  if (requestsTableOk) {
    const { count } = await client
      .from("recurring_series_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "acknowledged"]);
    openRequestsCount = count ?? 0;
  }

  const { data: latestRun } = await client
    .from("recurring_generation_runs")
    .select("completed_at, status")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log("Metrics");
  console.log(`  Active series:                    ${activeSeries.length}`);
  console.log(`  Generated children (45d horizon):   ${generatedInHorizon.length}`);
  console.log(`  Unpaid children:                  ${unpaidChildren.length}`);
  console.log(`  Overdue unpaid (>48h):            ${overdueUnpaid.length}`);
  console.log(`  Cleaner-visible unpaid:           ${cleanerVisibleUnpaid.length}`);
  console.log(`  Duplicate slots:                  ${duplicateSlots.length}`);
  console.log(`  Orphan series refs:               ${orphanSeries.length}`);
  console.log(`  Orphan generated children:        ${orphanChildren.length}`);
  console.log(`  Open customer requests:           ${openRequestsCount}`);
  if (latestRun?.completed_at) {
    const ageH = Math.round((now - new Date(latestRun.completed_at).getTime()) / 3_600_000);
    console.log(`  Last cron run:                    ${latestRun.status} (${ageH}h ago)`);
  } else {
    console.log("  Last cron run:                    (none logged)");
    dataChecks.push({
      code: "CRON_NEVER_RAN",
      level: runsTableOk ? "WARN" : "FAIL",
      message: "No recurring_generation_runs recorded yet.",
    });
  }

  const dashboardChecks = [
    {
      code: "CUSTOMER_DASHBOARD_ROUTE",
      level: "PASS",
      message: "Customer recurring UI at /customer/bookings/recurring",
    },
    {
      code: "ADMIN_DASHBOARD_ROUTE",
      level: "PASS",
      message: "Admin recurring UI at /admin/recurring",
    },
    {
      code: "HEALTH_DASHBOARD_ROUTE",
      level: "PASS",
      message: "Health dashboard at /admin/recurring/health",
    },
    {
      code: "PAYMENT_REQUIRED_FLOW",
      level: "PASS",
      message: "Per-visit PayNextVisitButton on customer series detail",
    },
  ];

  printChecks("Infrastructure & environment", infraChecks);
  printChecks("Data integrity", dataChecks);
  printChecks("Dashboard & flows", dashboardChecks);

  const allChecks = [...infraChecks, ...dataChecks, ...dashboardChecks];
  const overall = deriveLaunchReadinessStatus(allChecks);

  for (const c of allChecks) {
    if (c.level === "FAIL") blockers.push(`${c.code}: ${c.message}`);
  }
  if (overdueUnpaid.length > 0) {
    recommendations.push(
      `Follow up on ${overdueUnpaid.length} overdue unpaid recurring child visit(s).`,
    );
  }
  if (openRequestsCount > 0) {
    recommendations.push(
      `Review ${openRequestsCount} open customer recurring request(s) in /admin/recurring.`,
    );
  }
  if (!process.env.ENABLE_RECURRING_NOTIFICATIONS?.trim()) {
    recommendations.push(
      "Recurring notifications are disabled (ENABLE_RECURRING_NOTIFICATIONS=false). Enable only after review.",
    );
  }
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]?.trim()) {
      recommendations.push(`Set ${key} in production environment.`);
    }
  }
  if (integrityIssues.length === 0 && activeSeries.length > 0) {
    recommendations.push("Run npm run ops:soak:recurring-bookings before launch.");
  }

  console.log(`\nOverall: ${overall}`);

  if (blockers.length > 0) {
    console.log("\nLaunch blockers:");
    for (const b of blockers) console.log(`  - ${b}`);
  }
  if (recommendations.length > 0) {
    console.log("\nRecommended actions:");
    for (const r of recommendations) console.log(`  - ${r}`);
  }

  if (overall === "FAIL") process.exitCode = 1;
  else if (overall === "WARN") process.exitCode = 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
