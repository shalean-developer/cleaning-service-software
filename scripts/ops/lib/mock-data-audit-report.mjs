import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const JSON_NAME = "mock-data-audit-report.json";
const CSV_NAME = "mock-data-audit-report.csv";

/**
 * @param {Awaited<import('./mock-data-loader.mjs').runMockDataAudit>} audit
 */
export function buildAuditReportPayload(audit) {
  const counts = {
    bookings: {
      DELETE: audit.bookings.delete.length,
      KEEP: audit.bookings.keep.length,
      REVIEW: audit.bookings.review.length,
      hardDelete: audit.bookings.hardDelete?.length ?? 0,
      archive: audit.bookings.archive?.length ?? 0,
      blocked: audit.bookings.blocked?.length ?? 0,
    },
    customers: {
      DELETE: audit.customers.delete.length,
      KEEP: audit.customers.keep.length,
      REVIEW: audit.customers.review.length,
      PURGED: audit.customers.purged.length,
    },
    cleaners: {
      DELETE: audit.cleaners.delete.length,
      KEEP: audit.cleaners.keep.length,
      REVIEW: audit.cleaners.review.length,
      PURGED: audit.cleaners.purged.length,
    },
    profiles: {
      DELETE: audit.profiles.delete.length,
      KEEP: audit.profiles.keep.length,
      REVIEW: audit.profiles.review.length,
    },
    blocked: audit.impacts.blockedByFinancialOrHistory ?? {},
  };

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    counts,
    impacts: audit.impacts,
    scanned: audit.scanned,
    safetyViolations: audit.safetyViolations,
    rows: {
      bookings: audit.bookings.all,
      customers: audit.customers.all,
      cleaners: audit.cleaners.all,
      profiles: audit.profiles.all,
    },
  };
}

/**
 * @param {ReturnType<typeof buildAuditReportPayload>} payload
 */
function escapeCsv(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * @param {ReturnType<typeof buildAuditReportPayload>} payload
 */
function buildCsv(payload) {
  const headers = [
    "entity_type",
    "entity_id",
    "decision",
    "purge_action",
    "email",
    "name",
    "status",
    "match",
    "blocked_reasons",
    "hard_delete_allowed",
  ];
  const lines = [headers.join(",")];

  const pushRow = (entityType, row) => {
    lines.push(
      [
        entityType,
        row.bookingId ?? row.customerId ?? row.cleanerId ?? row.profileId ?? "",
        row.decision ?? "",
        row.purgeAction ?? "",
        row.email ?? row.customerEmail ?? "",
        row.fullName ?? row.customerName ?? row.displayName ?? "",
        row.status ?? "",
        row.match ?? "",
        (row.hardDeleteBlockedReasons ?? row.blockedReasons ?? []).join("; "),
        row.hardDeleteAllowed == null ? "" : row.hardDeleteAllowed ? "yes" : "no",
      ]
        .map(escapeCsv)
        .join(","),
    );
  };

  for (const row of payload.rows.bookings) pushRow("booking", row);
  for (const row of payload.rows.customers) pushRow("customer", row);
  for (const row of payload.rows.cleaners) pushRow("cleaner", row);
  for (const row of payload.rows.profiles) pushRow("profile", row);

  return `${lines.join("\n")}\n`;
}

/**
 * @param {Awaited<import('./mock-data-loader.mjs').runMockDataAudit>} audit
 * @param {string} [cwd]
 */
export function writeMockDataAuditReports(audit, cwd = process.cwd()) {
  const payload = buildAuditReportPayload(audit);
  const jsonPath = resolve(cwd, JSON_NAME);
  const csvPath = resolve(cwd, CSV_NAME);
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(csvPath, buildCsv(payload), "utf8");
  return { jsonPath, csvPath, payload };
}

export { JSON_NAME, CSV_NAME };
