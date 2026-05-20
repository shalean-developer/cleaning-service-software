#!/usr/bin/env node
/**
 * Dry-run audit: mock vs real customers and related row counts.
 *
 * Usage: npm run ops:audit:mock-customers
 */
import { createClient } from "@supabase/supabase-js";
import {
  countCustomerRelatedRowsForAudit,
  countNotificationsForRecipient,
  enrichCustomerAuditRow,
  loadCustomerCandidates,
} from "./lib/mock-customer-data.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

function pad(value, width) {
  const text = String(value ?? "");
  return text.length >= width ? text.slice(0, width) : text.padEnd(width);
}

async function main() {
  console.log("Mock customer audit (dry-run — no writes)\n");

  console.log("Loading customer profiles and auth emails…");
  const candidates = await loadCustomerCandidates(client);
  if (candidates.length === 0) {
    console.log("No customer profiles found.");
    return;
  }

  console.log(`Scanning ${candidates.length} customer(s)…\n`);

  const enriched = [];
  let index = 0;
  for (const row of candidates) {
    index += 1;
    if (!row.customerId) {
      enriched.push(
        enrichCustomerAuditRow(row, {
          bookingCount: 0,
          paymentCount: 0,
          paidPaymentCount: 0,
          recurringCount: 0,
          bookingLocks: 0,
          customerOperationalAudit: 0,
          bookingIds: [],
          bookingRows: [],
        }, 0),
      );
      continue;
    }
    if (row.classification.mock || index === 1 || index === candidates.length) {
      console.log(`  [${index}/${candidates.length}] ${row.email}`);
    }
    const related = await countCustomerRelatedRowsForAudit(client, row.customerId, {
      classification: row.classification,
    });
    const notificationCount = row.classification.mock
      ? await countNotificationsForRecipient(client, row.email)
      : 0;
    enriched.push(enrichCustomerAuditRow(row, related, notificationCount));
  }

  const deleteRows = enriched.filter((r) => r.decision === "DELETE");
  const reviewRows = enriched.filter((r) => r.decision === "REVIEW");
  const purgedRows = enriched.filter((r) => r.decision === "PURGED");
  const keepRows = enriched.filter((r) => r.decision === "KEEP");

  const headers = [
    "decision",
    "customer_id",
    "user_id",
    "email",
    "display_name",
    "phone",
    "bookings",
    "payments",
    "recurring",
    "status",
    "match",
  ];
  const widths = [8, 38, 38, 36, 24, 14, 8, 8, 9, 8, 20];

  console.log(headers.map((h, i) => pad(h, widths[i])).join(" | "));
  console.log("-".repeat(widths.reduce((a, b) => a + b + 3, 0)));

  const printOrder = [...deleteRows, ...reviewRows, ...purgedRows, ...keepRows];
  for (const row of printOrder) {
    console.log(
      [
        pad(row.decision, widths[0]),
        pad(row.customerId ?? "—", widths[1]),
        pad(row.userId, widths[2]),
        pad(row.email, widths[3]),
        pad(row.displayName, widths[4]),
        pad(row.phone ?? "—", widths[5]),
        pad(row.bookingCount, widths[6]),
        pad(row.paymentCount, widths[7]),
        pad(row.recurringCount, widths[8]),
        pad(row.status, widths[9]),
        pad(row.match, widths[10]),
      ].join(" | "),
    );
    if (row.decision === "REVIEW") {
      console.log(
        `         ↳ REVIEW: paid_production=${row.paidProductionBookings} audit=${row.customerAuditCount} notifications=${row.notificationCount}`,
      );
    }
    if (row.decision === "DELETE" && row.customerAuditCount > 0) {
      console.log(
        `         ↳ purge will anonymize customer row (append-only customer_operational_audit=${row.customerAuditCount})`,
      );
    }
  }

  console.log("\nSummary:");
  console.log(`  DELETE (eligible):  ${deleteRows.length}`);
  console.log(`  REVIEW (blocked):   ${reviewRows.length}`);
  console.log(`  Already purged:     ${purgedRows.length}`);
  console.log(`  KEEP (real):        ${keepRows.length}`);

  if (deleteRows.length > 0) {
    console.log("\nTo remove mock customers:");
    console.log("  PowerShell:");
    console.log(
      '    $env:CONFIRM_MOCK_CUSTOMER_DELETE = "yes"; npm run ops:delete:mock-customers',
    );
    console.log("  bash / macOS / Linux:");
    console.log("    CONFIRM_MOCK_CUSTOMER_DELETE=yes npm run ops:delete:mock-customers");
  }
  if (reviewRows.length > 0) {
    console.log(
      "\nREVIEW rows were not marked DELETE — inspect paid bookings before manual cleanup.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
