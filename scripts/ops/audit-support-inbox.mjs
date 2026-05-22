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

const SLA_URGENT_FR_MIN = 60;
const SLA_STANDARD_FR_MIN = 8 * 60;

function slaCategoryFor(row, bookingScheduledStart) {
  if (["payment_help", "cleaner_issue", "service_issue"].includes(row.request_type)) {
    return "urgent";
  }
  if (isCancelOrReschedule(row.request_type)) {
    const now = Date.now();
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const targetIso = bookingScheduledStart ?? meta.requestedDateTimeIso;
    if (targetIso) {
      const targetMs = new Date(targetIso).getTime();
      if (targetMs > now && targetMs - now <= MS_24H) return "urgent";
    }
  }
  return "standard";
}

function slaStatusForOpen(row, bookingScheduledStart) {
  const category = slaCategoryFor(row, bookingScheduledStart);
  const targetMin = category === "urgent" ? SLA_URGENT_FR_MIN : SLA_STANDARD_FR_MIN;
  const ageMin = (Date.now() - new Date(row.created_at).getTime()) / 60_000;
  if (ageMin >= targetMin) return "breached";
  if (ageMin >= targetMin * 0.8) return "warning";
  return "healthy";
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

function isMissingColumnError(error) {
  const msg = error?.message ?? "";
  return msg.includes("does not exist") && msg.includes("column");
}

async function loadBookingSupportRows(issues) {
  const fullSelect =
    "id, booking_id, customer_id, request_type, status, created_at, updated_at, resolved_at";
  const legacySelect =
    "id, booking_id, customer_id, request_type, status, created_at, resolved_at";

  let { data, error } = await client.from("booking_support_requests").select(fullSelect);
  if (error && isMissingColumnError(error)) {
    issues.push({
      level: "WARN",
      code: "PENDING_MIGRATION",
      detail:
        "booking_support_requests missing Phase 3 columns — run supabase/migrations/20260626120000_support_request_customer_response.sql",
    });
    ({ data, error } = await client.from("booking_support_requests").select(legacySelect));
  }
  if (error) {
    issues.push({ level: "FAIL", code: "QUERY_ERROR", detail: error.message });
    return [];
  }
  return (data ?? []).map((row) => ({
    ...row,
    updated_at: row.updated_at ?? row.created_at,
  }));
}

async function loadRecurringSupportRows(issues) {
  const fullSelect =
    "id, series_id, group_id, customer_id, request_type, status, created_at, updated_at, resolved_at, metadata";
  const legacySelect =
    "id, series_id, group_id, customer_id, request_type, status, created_at, resolved_at, metadata";

  let { data, error } = await client.from("recurring_series_requests").select(fullSelect);
  if (error && isMissingColumnError(error)) {
    issues.push({
      level: "WARN",
      code: "PENDING_MIGRATION",
      detail:
        "recurring_series_requests missing updated_at (Phase 3) — run migrations 20260625120000 and 20260626120000",
    });
    ({ data, error } = await client.from("recurring_series_requests").select(legacySelect));
  }
  if (error) {
    issues.push({ level: "FAIL", code: "QUERY_ERROR", detail: error.message });
    return [];
  }
  return (data ?? []).map((row) => ({
    ...row,
    updated_at: row.updated_at ?? row.created_at,
  }));
}

async function main() {
  console.log("Support inbox audit\n");

  const issues = [];
  const counts = {
    bookingOpen: 0,
    bookingUrgent: 0,
    recurringOpen: 0,
    recurringUrgent: 0,
    staleOpen24h: 0,
    staleAcknowledged48h: 0,
    slaBreached: 0,
    escalationCandidates: 0,
    repeatedBookingRequests: 0,
    volumeByType: {},
  };
  const MS_48H = 48 * 60 * 60 * 1000;

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
    bookingRows = await loadBookingSupportRows(issues);
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
          if (row.status === "open" && new Date(row.created_at).getTime() < Date.now() - MS_24H) {
            counts.staleOpen24h += 1;
            issues.push({
              level: "WARN",
              code: "STALE_OPEN",
              detail: `booking support ${row.id} open >24h`,
            });
          }
          if (
            row.status === "acknowledged" &&
            row.updated_at &&
            new Date(row.updated_at).getTime() < Date.now() - MS_48H
          ) {
            counts.staleAcknowledged48h += 1;
            issues.push({
              level: "WARN",
              code: "STALE_ACKNOWLEDGED",
              detail: `booking support ${row.id} acknowledged >48h`,
            });
          }
        }
    }
  }

  if (recurringTableOk) {
    recurringRows = await loadRecurringSupportRows(issues);
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
          if (row.status === "open" && new Date(row.created_at).getTime() < Date.now() - MS_24H) {
            counts.staleOpen24h += 1;
            issues.push({
              level: "WARN",
              code: "STALE_OPEN",
              detail: `recurring support ${row.id} open >24h`,
            });
          }
          const updatedAt = row.updated_at ?? row.created_at;
          if (
            row.status === "acknowledged" &&
            new Date(updatedAt).getTime() < Date.now() - MS_48H
          ) {
            counts.staleAcknowledged48h += 1;
            issues.push({
              level: "WARN",
              code: "STALE_ACKNOWLEDGED",
              detail: `recurring support ${row.id} acknowledged >48h`,
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

  const bookingIdList = [...bookingIds];
  const customerIdList = [...customerIds];
  const seriesIdList = [...seriesIds];
  const groupIdList = [...groupIds];

  const bookingSchedule = new Map();
  const existingBookings = new Set();
  if (bookingIdList.length > 0) {
    const { data } = await client.from("bookings").select("id, scheduled_start").in("id", bookingIdList);
    for (const b of data ?? []) {
      existingBookings.add(b.id);
      bookingSchedule.set(b.id, b.scheduled_start);
    }
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

  const bookingRequestCounts = new Map();
  for (const row of bookingRows) {
    counts.volumeByType[row.request_type] = (counts.volumeByType[row.request_type] ?? 0) + 1;
    bookingRequestCounts.set(row.booking_id, (bookingRequestCounts.get(row.booking_id) ?? 0) + 1);
    if (OPEN_STATUSES.has(row.status) && row.status === "open") {
      const sla = slaStatusForOpen(row, bookingSchedule.get(row.booking_id));
      if (sla === "breached") {
        counts.slaBreached += 1;
        issues.push({
          level: "WARN",
          code: "SLA_BREACHED",
          detail: `booking support ${row.id} first-response SLA breached`,
        });
      }
      const ageH = (Date.now() - new Date(row.created_at).getTime()) / (60 * 60 * 1000);
      if (
        ["payment_help", "cleaner_issue", "service_issue"].includes(row.request_type) &&
        ageH >= 1
      ) {
        counts.escalationCandidates += 1;
        issues.push({
          level: "WARN",
          code: "ESCALATION_CANDIDATE",
          detail: `urgent booking support ${row.id} open >1h`,
        });
      }
    }
    if (OPEN_STATUSES.has(row.status) && row.status === "acknowledged") {
      const ackAgeH =
        (Date.now() - new Date(row.updated_at ?? row.created_at).getTime()) / (60 * 60 * 1000);
      if (ackAgeH >= 24) {
        counts.escalationCandidates += 1;
        issues.push({
          level: "WARN",
          code: "ESCALATION_CANDIDATE",
          detail: `booking support ${row.id} acknowledged >24h`,
        });
      }
    }
  }

  for (const row of recurringRows) {
    counts.volumeByType[row.request_type] = (counts.volumeByType[row.request_type] ?? 0) + 1;
    if (OPEN_STATUSES.has(row.status) && row.status === "open") {
      const sla = slaStatusForOpen(row, null);
      if (sla === "breached") {
        counts.slaBreached += 1;
        issues.push({
          level: "WARN",
          code: "SLA_BREACHED",
          detail: `recurring support ${row.id} first-response SLA breached`,
        });
      }
    }
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const requested = meta.requestedDateTimeIso;
    if (
      OPEN_STATUSES.has(row.status) &&
      typeof requested === "string" &&
      new Date(requested).getTime() > Date.now() &&
      new Date(requested).getTime() - Date.now() <= 48 * 60 * 60 * 1000
    ) {
      counts.escalationCandidates += 1;
      issues.push({
        level: "WARN",
        code: "RECURRING_BEFORE_VISIT",
        detail: `recurring support ${row.id} unresolved before requested window`,
      });
    }
  }

  for (const [bookingId, n] of bookingRequestCounts) {
    if (n >= 2) {
      counts.repeatedBookingRequests += 1;
      issues.push({
        level: "WARN",
        code: "REPEATED_BOOKING_REQUESTS",
        detail: `booking ${bookingId} has ${n} support requests`,
      });
    }
  }

  const openRows = [
    ...bookingRows.filter((r) => OPEN_STATUSES.has(r.status)),
    ...recurringRows.filter((r) => OPEN_STATUSES.has(r.status)),
  ];
  let oldestUnresolved = null;
  for (const row of openRows) {
    const age = Date.now() - new Date(row.created_at).getTime();
    if (!oldestUnresolved || age > oldestUnresolved.ageMs) {
      oldestUnresolved = { id: row.id, ageMs: age, source: row.booking_id ? "booking" : "recurring" };
    }
  }

  const mergedDbCount = bookingRows.length + recurringRows.length;

  const overall = severityFor(issues);
  printReport(overall, counts, issues, {
    bookingTotal: bookingRows.length,
    recurringTotal: recurringRows.length,
    mergedTotal: mergedDbCount,
    oldestUnresolved,
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
  console.log(`  stale open >24h: ${counts.staleOpen24h}`);
  console.log(`  stale acknowledged >48h: ${counts.staleAcknowledged48h}`);
  console.log(`  SLA breached (open): ${counts.slaBreached}`);
  console.log(`  escalation candidates: ${counts.escalationCandidates}`);
  console.log(`  bookings with repeated requests: ${counts.repeatedBookingRequests}`);
  if (Object.keys(counts.volumeByType).length) {
    console.log("  volume by type:");
    for (const [type, n] of Object.entries(counts.volumeByType).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type}: ${n}`);
    }
  }
  if (extras.oldestUnresolved) {
    const hours = Math.round(extras.oldestUnresolved.ageMs / (60 * 60 * 1000));
    console.log(
      `  oldest unresolved: ${extras.oldestUnresolved.id} (${extras.oldestUnresolved.source}, ~${hours}h)`,
    );
  }
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
  if (grouped.WARN.some((i) => i.code === "PENDING_MIGRATION")) {
    console.log(
      "  - Apply pending migrations: npx supabase db push (or paste SQL from supabase/migrations/ into Supabase SQL editor)",
    );
  }
  if (grouped.WARN.some((i) => i.code === "STALE_OPEN")) {
    console.log("  - Acknowledge or resolve stale open requests in /admin/support");
  }
  if (counts.bookingUrgent + counts.recurringUrgent > 0) {
    console.log("  - Prioritize urgent queue in /admin/support");
  }
  if (counts.slaBreached > 0) {
    console.log("  - Review SLA breached filter at /admin/support?filter=breached");
  }
  if (counts.escalationCandidates > 0) {
    console.log("  - Review needs-attention view at /admin/support?filter=needs_attention");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
