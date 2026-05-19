#!/usr/bin/env node
/**
 * Dry-run audit: mock vs real cleaners and related row counts.
 *
 * Usage: npm run ops:audit:mock-cleaners
 */
import { createClient } from "@supabase/supabase-js";
import {
  formatRelatedSummary,
  countCleanerRelatedRows,
  loadCleanerCandidates,
  summarizeBookingsForCleaner,
} from "./lib/mock-cleaner-data.mjs";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

function pad(value, width) {
  const text = String(value ?? "");
  return text.length >= width ? text : text.padEnd(width);
}

async function main() {
  console.log("Mock cleaner audit (dry-run — no writes)\n");

  const candidates = await loadCleanerCandidates(client);
  if (candidates.length === 0) {
    console.log("No cleaner profiles found.");
    return;
  }

  const mockRows = [];
  const purgedRows = [];
  const realRows = [];

  for (const row of candidates) {
    const related = await countCleanerRelatedRows(client, row.cleanerId);
    const bookingSummary = await summarizeBookingsForCleaner(client, row.cleanerId);
    const alreadyPurged =
      row.deletedAt != null && row.lifecycleReason === "ops_mock_cleaner_purge";
    const enriched = {
      ...row,
      related,
      bookingSummary,
      relatedSummary: formatRelatedSummary(related, bookingSummary),
      decision: !row.classification.mock
        ? "KEEP"
        : alreadyPurged
          ? "PURGED"
          : "DELETE",
    };
    if (!row.classification.mock) realRows.push(enriched);
    else if (enriched.decision === "PURGED") purgedRows.push(enriched);
    else mockRows.push(enriched);
  }

  const headers = ["decision", "email", "profile_id", "cleaner_id", "match", "related"];
  const widths = [8, 40, 38, 38, 16, 72];

  console.log(
    `${pad(headers[0], widths[0])} | ${pad(headers[1], widths[1])} | ${pad(headers[2], widths[2])} | ${pad(headers[3], widths[3])} | ${pad(headers[4], widths[4])} | ${headers[5]}`,
  );
  console.log("-".repeat(widths.reduce((a, b) => a + b + 3, 0)));

  for (const row of [...mockRows, ...purgedRows, ...realRows]) {
    const match = row.classification.reasons.join(",") || "-";
    console.log(
      `${pad(row.decision, widths[0])} | ${pad(row.email, widths[1])} | ${pad(row.profileId, widths[2])} | ${pad(row.cleanerId, widths[3])} | ${pad(match, widths[4])} | ${row.relatedSummary}`,
    );
  }

  console.log("\nSummary:");
  console.log(`  Mock (would delete): ${mockRows.length}`);
  console.log(`  Already purged:      ${purgedRows.length}`);
  console.log(`  Real (keep):         ${realRows.length}`);

  if (mockRows.length > 0) {
    console.log("\nTo remove mock cleaners:");
    console.log("  CONFIRM_MOCK_CLEANER_DELETE=yes npm run ops:delete:mock-cleaners");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
