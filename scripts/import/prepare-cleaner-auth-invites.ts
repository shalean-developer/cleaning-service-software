#!/usr/bin/env node
/**
 * Prepare cleaner-auth-invites.csv from cleaner-auth-linking-report.csv (read-only).
 *
 * Does NOT create auth users, send invites, or import cleaner data.
 *
 * Usage:
 *   npx tsx scripts/import/prepare-cleaner-auth-invites.ts [--linking-report path]
 *
 * Output: cleaner-auth-invites.csv (project root)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildInviteRowsFromLinkingReport,
  inviteRowsToCsv,
  parseLinkingReportCsv,
} from "./prepareCleanerAuthInvitesLib";
import { LINKING_REPORT_CSV_PATH } from "./importLinkingGate";

const INVITES_CSV_PATH = resolve(process.cwd(), "cleaner-auth-invites.csv");
const INVITES_JSON_PATH = resolve(process.cwd(), "cleaner-auth-invites-summary.json");

const ADMIN_INSTRUCTIONS = `
Admin onboarding (manual — no auto-invites)
-----------------------------------------
1. Open Admin → Cleaners → New for each row in cleaner-auth-invites.csv.
2. Enter full_name and phone exactly as listed.
3. The system generates login email from phone (0XXXXXXXXX@shalean.co.za).
   The "email" column shows the expected login after creation.
4. If temporary_email_if_needed is set, that was the legacy placeholder — do not use it to sign in.
5. Set a secure temporary password; share credentials through your approved channel.
6. Leave new cleaners inactive until onboarding is complete (default).
7. Do NOT import cleaner profile CSV data yet.

After all accounts exist:
  npm run import:cleaners:link-auth
  npm run import:cleaners:dry-run
  (only then) npm run import:cleaners:execute

Import stays blocked until link-auth shows matched_ready or already_imported for every row.
`.trim();

function parseCli(argv: string[]): { linkingReportPath: string } {
  const flagIndex = argv.indexOf("--linking-report");
  const linkingReportPath =
    flagIndex >= 0 && argv[flagIndex + 1]
      ? resolve(process.cwd(), argv[flagIndex + 1]!)
      : LINKING_REPORT_CSV_PATH;
  return { linkingReportPath };
}

function main(): number {
  const { linkingReportPath } = parseCli(process.argv.slice(2));

  if (!existsSync(linkingReportPath)) {
    console.error(
      `Missing ${linkingReportPath}. Run: npm run import:cleaners:link-auth`,
    );
    return 1;
  }

  const text = readFileSync(linkingReportPath, "utf8");
  const linkingRows = parseLinkingReportCsv(text);
  const { rows, summary } = buildInviteRowsFromLinkingReport(linkingRows);

  if (summary.totalNeedsInvite === 0) {
    console.log("No rows with linkage_status=needs_auth_invite in linking report.");
    return 0;
  }

  writeFileSync(INVITES_CSV_PATH, inviteRowsToCsv(rows), "utf8");
  writeFileSync(
    INVITES_JSON_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        linkingReportPath,
        summary,
        adminInstructions: ADMIN_INSTRUCTIONS,
        rows: rows.map((r) => ({
          full_name: r.fullName,
          email: r.email,
          phone: r.phone,
          temporary_email_if_needed: r.temporaryEmailIfNeeded,
          source_csv_row: r.sourceCsvRow,
          status: r.status,
          notes: r.notes,
          email_kind: r.emailKind,
          csv_email: r.csvEmail,
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("\nCleaner auth invite preparation (read-only)\n");
  console.log(`Source: ${linkingReportPath}`);
  console.log(`Output: ${INVITES_CSV_PATH}\n`);

  console.log("Summary:");
  console.log(`  Total needs invite:           ${summary.totalNeedsInvite}`);
  console.log(`  Pending (ready to create):    ${summary.pendingInvite}`);
  console.log(`  Real emails available:        ${summary.realEmailsAvailable}`);
  console.log(`  Legacy placeholder emails:    ${summary.placeholderEmails}`);
  console.log(`  Phone-derived logins needed:  ${summary.phoneDerivedLoginsNeeded}`);
  console.log(`  Missing phone/email issues:   ${summary.missingPhoneOrEmail}`);

  console.log(`\n${ADMIN_INSTRUCTIONS}\n`);

  console.log("No database writes. Import remains blocked until link-auth passes.\n");

  return summary.missingPhoneOrEmail > 0 ? 1 : 0;
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("prepare-cleaner-auth-invites.ts") ||
    process.argv[1].endsWith("prepare-cleaner-auth-invites.mjs"));

if (isMain) {
  process.exitCode = main();
}
