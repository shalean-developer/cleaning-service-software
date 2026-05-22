#!/usr/bin/env node
/**
 * Audit customer support inbox tables and triage health.
 *
 * Usage: npm run ops:audit:support-inbox
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

const MS_24H = 24 * 60 * 60 * 1000;
const BOOKING_STATUSES = new Set(["open", "acknowledged", "resolved", "rejected"]);
const RECURRING_STATUSES = new Set(["open", "acknowledged", "resolved", "rejected"]);
const OPEN_STATUSES = new Set(["open", "acknowledged"]);

function isCancelOrReschedule(type) {
  return String(type).includes("cancel") || String(type).includes("reschedule");
}

function computePriority(row, bookingScheduledStart) {
  if (row.status === "resolved" || row.status === "rejected") return "low";
  if (row.status === "acknowledged") return "normal";
  const now = Date.now();
  if (now - new Date(row.created_at).getTime() > MS_24H) return "urgent";
  if (row.request_type === "payment_help") return "urgent";
  if (row.request_type === "cleaner_issue" || row.request_type === "service_issue") {
    return "urgent";
  }
  if (isCancelOrReschedule(row.request_type) && bookingScheduledStart) {
    const targetMs = new Date(bookingScheduledStart).getTime();
    if (targetMs > now && targetMs - now <= MS_24H) return "urgent";
  }
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const requested = meta.requestedDateTimeIso;
  if (isCancelOrReschedule(row.request_type) && typeof requested === "string") {
    const targetMs = new Date(requested).getTime();
    if (targetMs > now && targetMs - now <= MS_24H) return "urgent";
  }
  return "normal";
}

function severityFor(issues) {
  const hasFail = issues.some((i) => i.level === "FAIL");
  const hasWarn = issues.some((i) => i.level === "WARN");
  if (hasFail) return "FAIL";
  if (hasWarn) return "WARN";
  return "PASS";
}

async function tableExists(table) {
  const { error } = await client.from(table).select("id").limit(1);
  if (!error) return true;
  if (error.message?.includes("does not exist") || error.code === "42P01") return false;
  throw new Error(`${table}: ${error.message}`);
}

async function main() {
  console.log("Support inbox audit\n");

  const issues = [];
  const counts = {
    bookingOpen: 0,
    bookingUrgent: 0,
    recurringOpen: 0,
    recurringUrgent: 0,
  };

  const bookingTableOk = await tableExists("booking_support_requests");
  const recurringTableOk = await tableExists("recurring_series_requests");

  if (!bookingTableOk) {
    issues.push({
      level: "FAIL",
      code: "MISSING_TABLE",
      detail: "booking_support_requests table not found",
    });
  }
  if (!recurringTableOk) {
    issues.push({
      level: "FAIL",
      code: "MISSING_TABLE",
      detail: "recurring_series_requests table not found",
    });
  }

  if (!bookingTableOk && !recurringTableOk) {
    printReport("FAIL", counts, issues);
    process.exit(1);
  }

  let bookingRows = [];
  let recurringRows = [];
  let bookingIds = new Set();
  let customerIds = new Set();
  let seriesIds = new Set();
  let groupIds = new Set();

  if (bookingTableOk) {
    const { data, error } = await client
      .from("booking_support_requests")
      .select(
        "id, booking_id, customer_id, request_type, status, created_at, resolved_at",
      );
    if (error) {
      issues.push({ level: "FAIL", code: "QUERY_ERROR", detail: error.message });
    } else {
      bookingRows = data ?? [];
      for (const row of bookingRows) {
        bookingIds.add(row.booking_id);
        customerIds.add(row.customer_id);
        if (!BOOKING_STATUSES.has(row.status)) {
          issues.push({
            level: "FAIL",
            code: "INVALID_STATUS",
            detail: `booking_support_requests ${row.id} status=${row.status}`,
          });
        }
        if (OPEN_STATUSES.has(row.status)) {
          counts.bookingOpen += 1;
          if (new Date(row.created_at).getTime() < Date.now() - MS_24H) {
            issues.push({
              level: "WARN",
              code: "STALE_OPEN",
              detail: `booking support ${row.id} open >24h`,
            });
          }
        }
      }
    }
  }

  if (recurringTableOk) {
    const { data, error } = await client
      .from("recurring_series_requests")
      .select(
        "id, series_id, group_id, customer_id, request_type, status, created_at, resolved_at, metadata",
      );
    if (error) {
      issues.push({ level: "FAIL", code: "QUERY_ERROR", detail: error.message });
    } else {
      recurringRows = data ?? [];
      for (const row of recurringRows) {
        if (row.series_id) seriesIds.add(row.series_id);
        if (row.group_id) groupIds.add(row.group_id);
        customerIds.add(row.customer_id);
        if (!RECURRING_STATUSES.has(row.status)) {
          issues.push({
            level: "FAIL",
            code: "INVALID_STATUS",
            detail: `recurring_series_requests ${row.id} status=${row.status}`,
          });
        }
        if (OPEN_STATUSES.has(row.status)) {
          counts.recurringOpen += 1;
          if (new Date(row.created_at).getTime() < Date.now() - MS_24H) {
            issues.push({
              level: "WARN",
              code: "STALE_OPEN",
              detail: `recurring support ${row.id} open >24h`,
            });
          }
        }
        if (!row.series_id && !row.group_id) {
          issues.push({
            level: "FAIL",
            code: "ORPHAN_RECURRING",
            detail: `recurring_series_requests ${row.id} missing series_id and group_id`,
          });
        }
      }
    }
  }

  const bookingIdList = [...bookingIds];
  const customerIdList = [...customerIds];
  const seriesIdList = [...seriesIds];
  const groupIdList = [...groupIds];

  const existingBookings = new Set();
  if (bookingIdList.length > 0) {
    const { data } = await client.from("bookings").select("id, scheduled_start").in("id", bookingIdList);
    for (const b of data ?? []) {
      existingBookings.add(b.id);
    }
    const bookingSchedule = new Map((data ?? []).map((b) => [b.id, b.scheduled_start]));
    for (const row of bookingRows) {
      if (!existingBookings.has(row.booking_id)) {
        issues.push({
          level: "FAIL",
          code: "ORPHAN_BOOKING",
          detail: `booking_support_requests ${row.id} booking_id=${row.booking_id}`,
        });
      }
      if (OPEN_STATUSES.has(row.status) && computePriority(row, bookingSchedule.get(row.booking_id)) === "urgent") {
        counts.bookingUrgent += 1;
      }
    }
  }

  const existingCustomers = new Set();
  if (customerIdList.length > 0) {
    const { data } = await client.from("customers").select("id").in("id", customerIdList);
    for (const c of data ?? []) existingCustomers.add(c.id);
  }

  for (const row of bookingRows) {
    if (!existingCustomers.has(row.customer_id)) {
      issues.push({
        level: "WARN",
        code: "MISSING_CUSTOMER",
        detail: `booking_support_requests ${row.id} customer_id=${row.customer_id}`,
      });
    }
  }
  for (const row of recurringRows) {
    if (!existingCustomers.has(row.customer_id)) {
      issues.push({
        level: "WARN",
        code: "MISSING_CUSTOMER",
        detail: `recurring_series_requests ${row.id} customer_id=${row.customer_id}`,
      });
    }
  }

  const existingSeries = new Set();
  if (seriesIdList.length > 0) {
    const { data } = await client.from("booking_series").select("id").in("id", seriesIdList);
    for (const s of data ?? []) existingSeries.add(s.id);
  }
  const existingGroups = new Set();
  if (groupIdList.length > 0) {
    const { data } = await client
      .from("recurring_schedule_groups")
      .select("id")
      .in("id", groupIdList);
    for (const g of data ?? []) existingGroups.add(g.id);
  }

  for (const row of recurringRows) {
    if (row.series_id && !existingSeries.has(row.series_id)) {
      issues.push({
        level: "FAIL",
        code: "ORPHAN_SERIES",
        detail: `recurring_series_requests ${row.id} series_id=${row.series_id}`,
      });
    }
    if (row.group_id && !existingGroups.has(row.group_id)) {
      issues.push({
        level: "FAIL",
        code: "ORPHAN_GROUP",
        detail: `recurring_series_requests ${row.id} group_id=${row.group_id}`,
      });
    }
    if (OPEN_STATUSES.has(row.status) && computePriority(row, null) === "urgent") {
      counts.recurringUrgent += 1;
    }
  }

  const mergedDbCount = bookingRows.length + recurringRows.length;
  const readModelCount = mergedDbCount;
  if (readModelCount !== mergedDbCount) {
    issues.push({
      level: "FAIL",
      code: "READ_MODEL_COUNT",
      detail: `expected ${mergedDbCount} merged items`,
    });
  }

  const overall = severityFor(issues);
  printReport(overall, counts, issues, {
    bookingTotal: bookingRows.length,
    recurringTotal: recurringRows.length,
    mergedTotal: mergedDbCount,
  });

  if (overall === "FAIL") process.exit(1);
  if (overall === "WARN") process.exit(2);
  process.exit(0);
}

function printReport(overall, counts, issues, extras = {}) {
  console.log(`Result: ${overall}\n`);
  console.log("Counts:");
  console.log(`  booking open: ${counts.bookingOpen}`);
  console.log(`  booking urgent (open): ${counts.bookingUrgent}`);
  console.log(`  recurring open: ${counts.recurringOpen}`);
  console.log(`  recurring urgent (open): ${counts.recurringUrgent}`);
  if (extras.mergedTotal != null) {
    console.log(`  booking_support_requests rows: ${extras.bookingTotal}`);
    console.log(`  recurring_series_requests rows: ${extras.recurringTotal}`);
    console.log(`  merged inbox items: ${extras.mergedTotal}`);
  }
  console.log("");

  if (issues.length === 0) {
    console.log("No issues found.");
    console.log("\nRecommendations:");
    console.log("  - Review urgent items in /admin/support");
    return;
  }

  const grouped = { FAIL: [], WARN: [] };
  for (const i of issues) {
    grouped[i.level]?.push(i);
  }
  for (const level of ["FAIL", "WARN"]) {
    const list = grouped[level];
    if (!list?.length) continue;
    console.log(`${level} (${list.length}):`);
    for (const item of list.slice(0, 20)) {
      console.log(`  [${item.code}] ${item.detail}`);
    }
    if (list.length > 20) console.log(`  … and ${list.length - 20} more`);
    console.log("");
  }

  console.log("Recommendations:");
  if (grouped.FAIL.length) {
    console.log("  - Fix FAIL items before relying on inbox triage");
  }
  if (grouped.WARN.some((i) => i.code === "STALE_OPEN")) {
    console.log("  - Acknowledge or resolve stale open requests in /admin/support");
  }
  if (counts.bookingUrgent + counts.recurringUrgent > 0) {
    console.log("  - Prioritize urgent queue in /admin/support");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
