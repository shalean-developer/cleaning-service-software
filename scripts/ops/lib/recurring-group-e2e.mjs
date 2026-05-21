/**
 * Recurring schedule group E2E diagnostic report (audit-only, no mutations).
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildRecurringIntegrityIssues, deriveSoakStatus } from "./recurring-integrity.mjs";

const CLEANER_VISIBLE = new Set([
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

const UNPAID_STATUSES = new Set(["pending_payment", "draft", "payment_failed"]);

/**
 * @param {object} input
 * @param {Array} input.groupRows
 * @param {Array} input.seriesRows
 * @param {Array} input.bookings
 * @param {Set<string>} input.paidBookingIds
 * @param {Array} input.requestRows
 * @param {object|null} input.latestRun
 * @param {string|null} [input.filterGroupId]
 */
export function buildRecurringGroupE2eReport(input) {
  const groupRows = input.filterGroupId
    ? (input.groupRows ?? []).filter((g) => g.id === input.filterGroupId)
    : (input.groupRows ?? []);

  const groupIds = new Set(groupRows.map((g) => g.id));
  const seriesRows = (input.seriesRows ?? []).filter(
    (s) => !input.filterGroupId || (s.group_id && groupIds.has(s.group_id)),
  );
  const seriesIds = new Set(seriesRows.map((s) => s.id));
  const bookings = (input.bookings ?? []).filter(
    (b) => b.series_id && seriesIds.has(b.series_id),
  );

  const integrityIssues = buildRecurringIntegrityIssues({
    seriesRows: input.seriesRows ?? [],
    bookings: input.bookings ?? [],
    paidBookingIds: input.paidBookingIds,
    groupRows: input.groupRows ?? [],
    requestRows: input.requestRows ?? [],
  });

  const groupIssueCodes = new Set([
    "GROUP_NO_SERIES",
    "GROUP_SELECTED_DAYS_MISMATCH",
    "GROUP_EXTRA_WEEKDAY_SERIES",
    "GROUP_DUPLICATE_WEEKDAY",
    "GROUP_FREQUENCY_MISMATCH",
    "GROUP_PAUSED_WITH_ACTIVE_SERIES",
    "GROUP_CANCELLED_WITH_ACTIVE_SERIES",
    "ORPHAN_SERIES_GROUP",
    "SYNTHETIC_ANCHOR_IN_CHILD_TIMELINE",
    "SYNTHETIC_ANCHOR_HAS_PAYMENT",
    "SYNTHETIC_ANCHOR_CLEANER_ASSIGNED",
    "SYNTHETIC_ANCHOR_CLEANER_VISIBLE",
    "UNPAID_GROUP_CHILD_CLEANER_VISIBLE",
    "GROUP_REQUEST_MISSING_GROUP",
    "GROUP_REQUEST_WRONG_CUSTOMER",
    "GROUP_REQUEST_INVALID_SCOPE",
    "GROUP_REQUEST_WEEKDAY_NOT_IN_GROUP",
    "GROUP_REQUEST_SERIES_NOT_IN_GROUP",
    "DUPLICATE_OCCURRENCE",
  ]);

  const relevantIssues = integrityIssues.filter((i) =>
    groupIssueCodes.has(i.code) ||
    (i.seriesId && seriesIds.has(i.seriesId)) ||
    (i.groupId && groupIds.has(i.groupId)),
  );

  const seriesByGroup = new Map();
  for (const s of seriesRows) {
    if (!s.group_id) continue;
    const list = seriesByGroup.get(s.group_id) ?? [];
    list.push(s);
    seriesByGroup.set(s.group_id, list);
  }

  let syntheticAnchorCount = 0;
  let unpaidChildCount = 0;
  let unpaidCleanerVisibleRisk = 0;
  let realVisitCount = 0;

  for (const b of bookings) {
    if (b.synthetic_anchor === true) {
      syntheticAnchorCount += 1;
      continue;
    }
    realVisitCount += 1;
    const meta = b.metadata ?? {};
    if (meta.recurring?.generated === true && UNPAID_STATUSES.has(b.status)) {
      unpaidChildCount += 1;
    }
    if (
      meta.recurring?.generated === true &&
      CLEANER_VISIBLE.has(b.status) &&
      !input.paidBookingIds.has(b.id)
    ) {
      unpaidCleanerVisibleRisk += 1;
    }
  }

  const openGroupRequests = (input.requestRows ?? []).filter(
    (r) =>
      (r.status === "open" || r.status === "acknowledged") &&
      (r.group_id ? groupIds.has(r.group_id) : r.series_id && seriesIds.has(r.series_id)),
  );

  const groupedSeriesCount = seriesRows.filter((s) => s.group_id).length;

  const routeChecks = [
    {
      code: "ROUTE_CUSTOMER_GROUP_DETAIL",
      ok: existsSync(
        resolve("src/app/(customer)/customer/bookings/recurring/groups/[groupId]/page.tsx"),
      ),
    },
    {
      code: "ROUTE_ADMIN_GROUP_DETAIL",
      ok: existsSync(resolve("src/app/(admin)/admin/recurring/groups/[groupId]/page.tsx")),
    },
    {
      code: "API_CUSTOMER_GROUP_REQUEST",
      ok: existsSync(
        resolve("src/app/api/customer/recurring/groups/[groupId]/request/route.ts"),
      ),
    },
    {
      code: "MIGRATION_SCHEDULE_GROUPS",
      ok: existsSync(
        resolve("supabase/migrations/20260606120000_recurring_schedule_groups.sql"),
      ),
    },
    {
      code: "MIGRATION_GROUP_REQUEST_SCOPE",
      ok: existsSync(
        resolve("supabase/migrations/20260608120000_recurring_series_requests_group_scope.sql"),
      ),
    },
  ];

  const blockers = [];
  const recommendations = [];

  if (relevantIssues.some((i) => i.severity === "critical")) {
    blockers.push("Critical recurring group integrity issue(s) detected.");
  }
  if (unpaidCleanerVisibleRisk > 0) {
    blockers.push(
      `${unpaidCleanerVisibleRisk} unpaid generated child booking(s) are cleaner-visible.`,
    );
  }
  for (const r of routeChecks) {
    if (!r.ok) blockers.push(`Missing required artifact: ${r.code}`);
  }

  if (groupRows.length === 0 && !input.filterGroupId) {
    recommendations.push(
      "No recurring_schedule_groups rows yet — complete a multi-day paid booking in staging or run manual checklist scenario 1.",
    );
  }
  if (openGroupRequests.length > 0) {
    recommendations.push(
      `Resolve ${openGroupRequests.length} open group/series request(s) in admin group detail.`,
    );
  }
  if (!input.latestRun?.completed_at) {
    recommendations.push("Ensure generate-recurring-occurrences cron has run at least once.");
  }
  if (relevantIssues.length === 0 && groupRows.length > 0) {
    recommendations.push("Run manual checklist in docs/recurring-group-e2e-launch-checklist.md before launch.");
  }

  const soakStatus = deriveSoakStatus(relevantIssues);
  let status = soakStatus;
  if (blockers.length > 0) status = "FAIL";
  else if (recommendations.length > 0 && status === "PASS") status = "WARN";

  return {
    status,
    metrics: {
      groupCount: groupRows.length,
      groupedSeriesCount,
      syntheticAnchorCount,
      realVisitCount,
      unpaidChildCount,
      unpaidCleanerVisibleRisk,
      openGroupRequestsCount: openGroupRequests.length,
      integrityIssueCount: relevantIssues.length,
      criticalIssueCount: relevantIssues.filter((i) => i.severity === "critical").length,
    },
    groups: groupRows.map((g) => {
      const children = seriesByGroup.get(g.id) ?? [];
      return {
        groupId: g.id,
        status: g.status,
        frequency: g.frequency,
        selectedDaysCount: (g.selected_days ?? []).length,
        linkedSeriesCount: children.length,
        weekdays: children.map((c) => c.weekday).filter((w) => w != null),
      };
    }),
    latestRun: input.latestRun,
    routeChecks,
    integrityIssues: relevantIssues,
    blockers,
    recommendations,
  };
}

/**
 * @param {"READY"|"READY WITH WARNINGS"|"BLOCKED"} launchHint
 */
export function deriveGroupLaunchRecommendation(report) {
  if (report.status === "FAIL") return "BLOCKED";
  if (report.status === "WARN" || report.recommendations.length > 0) return "READY WITH WARNINGS";
  return "READY";
}
