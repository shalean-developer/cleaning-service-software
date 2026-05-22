#!/usr/bin/env node
/**
 * Import cleaner onboarding leads from CSV (full_name + phone only).
 *
 * Read-only DB check for existing cleaners by phone. No writes, no auth creation.
 * Outputs cleaner-onboarding-leads.csv and cleaner-onboarding-leads-report.json.
 *
 * Usage:
 *   npx tsx scripts/import/import-cleaner-onboarding-leads.ts [--csv path]
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { normalizeZaMobilePhone } from "@/lib/validation/zaPhone";
import { parseCsv } from "./importCleanersLib";
import {
  buildOnboardingLeadsPlan,
  findRowByName,
  leadsForCsvExport,
  onboardingLeadsToCsv,
  summarizeOnboardingLeadsPlan,
  type ExistingCleanerByPhone,
} from "./importCleanerOnboardingLeadsLib";

const DEFAULT_CSV = resolve(
  process.cwd(),
  "data/import/cleaner-onboarding-leads-input.csv",
);
const LEADS_CSV_PATH = resolve(process.cwd(), "cleaner-onboarding-leads.csv");
const REPORT_JSON_PATH = resolve(process.cwd(), "cleaner-onboarding-leads-report.json");

function loadEnvFiles(cwd = process.cwd()) {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function createClientOrNull(): SupabaseClient<Database> | null {
  loadEnvFiles();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadExistingCleanersByPhone(
  client: SupabaseClient<Database>,
): Promise<Map<string, ExistingCleanerByPhone>> {
  const byPhone = new Map<string, ExistingCleanerByPhone>();

  const { data, error } = await client.from("cleaners").select("id, profile_id, phone, active");
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const phone = row.phone ? normalizeZaMobilePhone(row.phone) : null;
    if (!phone) continue;
    byPhone.set(phone, {
      cleanerId: row.id,
      profileId: row.profile_id,
      active: row.active,
    });
  }

  return byPhone;
}

function parseCli(argv: string[]): { csvPath: string } {
  const csvFlagIndex = argv.indexOf("--csv");
  const csvPath =
    csvFlagIndex >= 0 && argv[csvFlagIndex + 1]
      ? resolve(process.cwd(), argv[csvFlagIndex + 1]!)
      : DEFAULT_CSV;
  return { csvPath };
}

async function main(): Promise<number> {
  const { csvPath } = parseCli(process.argv.slice(2));
  const csvText = readFileSync(csvPath, "utf8");
  const csvRows = parseCsv(csvText);

  const client = createClientOrNull();
  if (!client) {
    console.error(
      "Missing SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).",
    );
    return 1;
  }

  console.log("\nCleaner onboarding leads import (read-only)\n");
  console.log(`CSV: ${csvPath}`);

  const existingByPhone = await loadExistingCleanersByPhone(client);
  console.log(`Existing cleaners indexed by phone: ${existingByPhone.size}\n`);

  const plan = buildOnboardingLeadsPlan(csvRows, existingByPhone);
  const summary = summarizeOnboardingLeadsPlan(plan);
  const exportRows = leadsForCsvExport(plan);
  const princessRow = findRowByName(plan, "Princess Saidi");

  const report = {
    generatedAt: new Date().toISOString(),
    csvPath,
    mode: "read_only_no_db_writes" as const,
    stagingTableUsed: false,
    stagingTableNote:
      "No dedicated onboarding-import staging table. cleaner_applications is for public apply funnel only.",
    safety: {
      authUsersCreated: false,
      cleanersInserted: false,
      activeCleanersCreated: false,
      bookingsTouched: false,
      payoutsTouched: false,
      offersTouched: false,
      paymentsTouched: false,
      assignmentPoolAffected: false,
    },
    summary,
    issues: plan.issues,
    princessSaidi: princessRow
      ? {
          detected: true,
          status: princessRow.status,
          existingCleanerId: princessRow.existingCleanerId,
          phoneE164: princessRow.phoneE164,
        }
      : { detected: false },
    rows: plan.rows,
    leadsCsvRowCount: exportRows.length,
  };

  writeFileSync(LEADS_CSV_PATH, onboardingLeadsToCsv(exportRows), "utf8");
  writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("Summary:");
  console.log(`  Total rows processed:     ${summary.totalRows}`);
  console.log(`  Needs auth invite:        ${summary.needsAuthInvite}`);
  console.log(`  Existing cleaner (skip):  ${summary.existingCleaner}`);
  console.log(`  Duplicate CSV:            ${summary.duplicateCsv}`);
  console.log(`  Invalid:                  ${summary.invalid}`);
  console.log(`  Rows in leads CSV:        ${summary.includedInLeadsCsv}`);

  if (princessRow) {
    console.log(
      `\nPrincess Saidi: ${princessRow.status}${princessRow.existingCleanerId ? ` (cleaner_id=${princessRow.existingCleanerId})` : ""}`,
    );
  }

  console.log(`\nOutputs:`);
  console.log(`  ${LEADS_CSV_PATH}`);
  console.log(`  ${REPORT_JSON_PATH}`);
  console.log(
    "\nNext: provision each lead via Admin → Cleaners → New (inactive). Do not run legacy cleaner data import without auth linkage.\n",
  );

  return 0;
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("import-cleaner-onboarding-leads.ts") ||
    process.argv[1].endsWith("import-cleaner-onboarding-leads.mjs"));

if (isMain) {
  void main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

export { LEADS_CSV_PATH, REPORT_JSON_PATH };
