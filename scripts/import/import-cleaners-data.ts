#!/usr/bin/env node
/**
 * Import cleaner profile data from CSV into existing Supabase tables (data only).
 *
 * Schema: public.cleaners + profiles + cleaner_service_areas/capabilities/availability.
 * Does NOT create auth users, modify schema, or touch bookings/payouts/earnings/offers.
 *
 * Usage:
 *   npm run import:cleaners:link-auth   # required first — produces cleaner-auth-linking-report.csv
 *   npx tsx scripts/import/import-cleaners-data.ts --dry-run [--csv path]
 *   npx tsx scripts/import/import-cleaners-data.ts --execute [--csv path]
 *
 * Execute is blocked until cleaner-auth-linking-report.csv shows every row as
 * matched_ready (with profile_id) or already_imported.
 *
 * Default CSV: data/import/cleaners_import_ready_safe.csv
 * Reports: import-cleaners-report.json, cleaner-auth-linking-report.csv
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  buildImportPlan,
  parseCsv,
  summarizePlan,
  type ExistingCleanerIndex,
  type ImportPlan,
  type ImportPlanRow,
  type RowIssue,
} from "./importCleanersLib";
import {
  assertImportAllowed,
  loadLinkingReport,
  LINKING_REPORT_CSV_PATH,
} from "./importLinkingGate";

const DEFAULT_CSV = resolve(process.cwd(), "data/import/cleaners_import_ready_safe.csv");
const REPORT_PATH = resolve(process.cwd(), "import-cleaners-report.json");

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

function createImportClient(): SupabaseClient<Database> | null {
  loadEnvFiles();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type CliOptions = {
  dryRun: boolean;
  execute: boolean;
  csvPath: string;
};

type InsertResult = {
  cleanerId: string;
  profileId: string;
  fullName: string;
  phoneE164: string;
};

type ExecuteRowResult =
  | { status: "inserted"; insert: InsertResult }
  | { status: "skipped"; reason: string; code: string }
  | { status: "invalid"; issues: RowIssue[] }
  | { status: "auth_not_found"; message: string }
  | { status: "auth_role_blocked"; message: string }
  | { status: "linking_blocked"; message: string }
  | { status: "failed"; message: string };

export type ImportCleanersReport = {
  generatedAt: string;
  mode: "dry-run" | "execute";
  csvPath: string;
  summary: ReturnType<typeof summarizePlan> & {
    authNotFound: number;
    authRoleBlocked: number;
    failed: number;
    executedInserts: number;
  };
  rows: Array<{
    rowNumber: number;
    fullName?: string;
    email?: string;
    phoneE164?: string;
    legacyId?: string | null;
    status: string;
    cleanerId?: string;
    profileId?: string;
    reason?: string;
    issues?: RowIssue[];
  }>;
  issues: RowIssue[];
};

function parseCli(argv: string[]): CliOptions {
  const dryRun = argv.includes("--dry-run");
  const execute = argv.includes("--execute");
  if (dryRun === execute) {
    throw new Error("Specify exactly one of --dry-run or --execute.");
  }

  const csvFlagIndex = argv.indexOf("--csv");
  const csvPath =
    csvFlagIndex >= 0 && argv[csvFlagIndex + 1]
      ? resolve(process.cwd(), argv[csvFlagIndex + 1]!)
      : DEFAULT_CSV;

  return { dryRun, execute, csvPath };
}

async function loadExistingCleanerIndex(
  client: SupabaseClient<Database>,
): Promise<ExistingCleanerIndex> {
  const byPhone = new Map<string, { cleanerId: string; profileId: string }>();
  const byProfileId = new Map<string, { cleanerId: string; phone: string | null }>();

  const { data, error } = await client
    .from("cleaners")
    .select("id, profile_id, phone");

  if (error) throw new Error(`Failed to load cleaners: ${error.message}`);

  for (const row of data ?? []) {
    if (row.phone) {
      byPhone.set(row.phone, { cleanerId: row.id, profileId: row.profile_id });
    }
    byProfileId.set(row.profile_id, { cleanerId: row.id, phone: row.phone });
  }

  return { byPhone, byProfileId };
}

async function verifyAuthUser(
  client: SupabaseClient<Database>,
  authUserId: string,
): Promise<
  | { ok: true; email: string | null }
  | { ok: false; code: "auth_not_found" | "auth_role_blocked"; message: string }
> {
  const { data, error } = await client.auth.admin.getUserById(authUserId);
  if (error || !data.user) {
    return {
      ok: false,
      code: "auth_not_found",
      message: error?.message ?? `No auth user for id ${authUserId}`,
    };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", authUserId)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      code: "auth_not_found",
      message: profileError.message,
    };
  }

  if (profile?.role === "admin") {
    return {
      ok: false,
      code: "auth_role_blocked",
      message: "Refusing to link cleaner data to an admin profile.",
    };
  }

  return { ok: true, email: data.user.email ?? null };
}

async function purgeCleanerChildRows(
  client: SupabaseClient<Database>,
  cleanerId: string,
): Promise<void> {
  await client.from("cleaner_availability").delete().eq("cleaner_id", cleanerId);
  await client.from("cleaner_service_areas").delete().eq("cleaner_id", cleanerId);
  await client
    .from("cleaner_service_capabilities")
    .delete()
    .eq("cleaner_id", cleanerId);
}

async function insertCleanerProfileData(
  client: SupabaseClient<Database>,
  planRow: Extract<ImportPlanRow, { kind: "insert" }>,
  profileId: string,
): Promise<InsertResult> {
  const { row } = planRow;

  const authCheck = await verifyAuthUser(client, profileId);
  if (!authCheck.ok) {
    throw Object.assign(new Error(authCheck.message), { code: authCheck.code });
  }

  const { data: existingProfile, error: profileLoadError } = await client
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", profileId)
    .maybeSingle();
  if (profileLoadError) throw new Error(profileLoadError.message);

  if (!existingProfile) {
    const { error: profileError } = await client.from("profiles").insert({
      id: profileId,
      role: "cleaner",
      full_name: row.fullName,
    });
    if (profileError) throw new Error(profileError.message);
  } else if (existingProfile.role === "admin" || existingProfile.role === "customer") {
    throw Object.assign(
      new Error(`Profile ${profileId} has role=${existingProfile.role}; import refused.`),
      { code: "auth_role_blocked" },
    );
  }

  const { data: existingCleaner } = await client
    .from("cleaners")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (existingCleaner) {
    throw new Error(`Cleaner row already exists for profile ${profileId}.`);
  }

  const cleanerPayload: Database["public"]["Tables"]["cleaners"]["Insert"] = {
    profile_id: profileId,
    phone: row.phoneE164,
    active: false,
    average_rating: row.averageRating,
    onboarding_completed_at: row.onboardingCompletedAt,
  };

  const { data: cleanerRow, error: cleanerError } = await client
    .from("cleaners")
    .insert(cleanerPayload)
    .select("id")
    .single();

  if (cleanerError || !cleanerRow) {
    throw new Error(cleanerError?.message ?? "Failed to insert cleaners row.");
  }

  const cleanerId = cleanerRow.id;

  try {
    if (row.capabilities.length > 0) {
      const { error } = await client.from("cleaner_service_capabilities").insert(
        row.capabilities.map((service_slug) => ({
          cleaner_id: cleanerId,
          service_slug,
        })),
      );
      if (error) throw new Error(error.message);
    }

    if (row.serviceAreaSlugs.length > 0) {
      const { error } = await client.from("cleaner_service_areas").insert(
        row.serviceAreaSlugs.map((area_slug) => ({
          cleaner_id: cleanerId,
          area_slug,
        })),
      );
      if (error) throw new Error(error.message);
    }

    if (row.availabilityWindows.length > 0) {
      const { error } = await client.from("cleaner_availability").insert(
        row.availabilityWindows.map((window) => ({
          cleaner_id: cleanerId,
          day_of_week: window.dayOfWeek,
          start_time: window.startTime,
          end_time: window.endTime,
          timezone: window.timezone,
        })),
      );
      if (error) throw new Error(error.message);
    }

    return {
      cleanerId,
      profileId,
      fullName: row.fullName,
      phoneE164: row.phoneE164,
    };
  } catch (childError) {
    await purgeCleanerChildRows(client, cleanerId);
    await client.from("cleaners").delete().eq("id", cleanerId);
    throw childError;
  }
}

function planRowToReportEntry(
  planRow: ImportPlanRow,
  executeResult?: ExecuteRowResult,
): ImportCleanersReport["rows"][number] {
  if (planRow.kind === "invalid") {
    return {
      rowNumber: planRow.rowNumber,
      status: "invalid",
      issues: planRow.issues,
    };
  }

  const base = {
    rowNumber: planRow.row.rowNumber,
    fullName: planRow.row.fullName,
    email: planRow.row.email,
    phoneE164: planRow.row.phoneE164,
    legacyId: planRow.row.legacyId,
  };

  if (planRow.kind === "skip") {
    return {
      ...base,
      status: "skipped",
      reason: planRow.reason,
    };
  }

  if (!executeResult) {
    return { ...base, status: "would_insert" };
  }

  if (executeResult.status === "inserted") {
    return {
      ...base,
      status: "inserted",
      cleanerId: executeResult.insert.cleanerId,
      profileId: executeResult.insert.profileId,
    };
  }

  const reason =
    "message" in executeResult
      ? executeResult.message
      : executeResult.status === "skipped"
        ? executeResult.reason
        : undefined;

  return {
    ...base,
    status: executeResult.status,
    reason,
    issues: executeResult.status === "invalid" ? executeResult.issues : undefined,
  };
}

async function runImport(options: CliOptions): Promise<number> {
  const csvText = readFileSync(options.csvPath, "utf8");
  const csvRows = parseCsv(csvText);

  if (csvRows.length === 0) {
    console.error("CSV is empty or has no data rows.");
    return 1;
  }

  const client = createImportClient();
  if (!client) {
    console.error(
      "Missing SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).",
    );
    return 1;
  }

  const existing = await loadExistingCleanerIndex(client);
  const plan = buildImportPlan(csvRows, existing);
  const summary = summarizePlan(plan);

  const linkingLoad = loadLinkingReport();
  if (options.execute) {
    if (!linkingLoad.ok) {
      console.error(linkingLoad.message);
      return 1;
    }
    const insertRowNumbers = plan.plan
      .filter((p): p is Extract<ImportPlanRow, { kind: "insert" }> => p.kind === "insert")
      .map((p) => p.row.rowNumber);
    const gate = assertImportAllowed(linkingLoad.byRowNumber, insertRowNumbers);
    if (!gate.ok) {
      console.error(`\n${gate.message}`);
      console.error(`\nFix auth linking first: npm run import:cleaners:link-auth`);
      console.error(`Report: ${LINKING_REPORT_CSV_PATH}\n`);
      return 1;
    }
  } else if (!linkingLoad.ok) {
    console.warn(
      `\nWarning: ${linkingLoad.message}\nRun link-auth before execute.\n`,
    );
  }

  console.log(`\nCleaner import — ${options.dryRun ? "DRY RUN" : "EXECUTE"}`);
  console.log(`CSV: ${options.csvPath}`);
  console.log(`Existing cleaners in DB: ${existing.byProfileId.size}`);
  if (linkingLoad.ok) {
    console.log(`Linking report: ${LINKING_REPORT_CSV_PATH} (${linkingLoad.byRowNumber.size} rows)`);
  }
  console.log("");

  const reportRows: ImportCleanersReport["rows"] = [];
  let authNotFound = 0;
  let authRoleBlocked = 0;
  let failed = 0;
  let executedInserts = 0;
  let linkingBlocked = 0;

  for (const planRow of plan.plan) {
    if (planRow.kind !== "insert") {
      reportRows.push(planRowToReportEntry(planRow));
      continue;
    }

    const linkRow = linkingLoad.ok
      ? linkingLoad.byRowNumber.get(planRow.row.rowNumber)
      : undefined;

    if (linkRow?.linkageStatus === "already_imported") {
      reportRows.push(
        planRowToReportEntry(planRow, {
          status: "skipped",
          reason: "already_imported per linking report",
          code: "existing_cleaner",
        }),
      );
      continue;
    }

    const profileId = linkRow?.currentProfileId ?? null;
    if (!profileId || linkRow?.linkageStatus !== "matched_ready") {
      linkingBlocked += 1;
      const message = linkRow
        ? `Linking status: ${linkRow.linkageStatus} (no profile_id)`
        : "Missing from linking report — run import:cleaners:link-auth";
      reportRows.push(
        planRowToReportEntry(planRow, {
          status: "linking_blocked",
          message,
        }),
      );
      if (options.dryRun) continue;
      failed += 1;
      continue;
    }

    if (options.dryRun) {
      const authCheck = await verifyAuthUser(client, profileId);
      if (!authCheck.ok) {
        if (authCheck.code === "auth_not_found") authNotFound += 1;
        if (authCheck.code === "auth_role_blocked") authRoleBlocked += 1;
        reportRows.push(
          planRowToReportEntry(planRow, {
            status: authCheck.code,
            message: authCheck.message,
          }),
        );
        continue;
      }

      reportRows.push(planRowToReportEntry(planRow));
      continue;
    }

    try {
      const insert = await insertCleanerProfileData(client, planRow, profileId);
      executedInserts += 1;
      reportRows.push(
        planRowToReportEntry(planRow, { status: "inserted", insert }),
      );
      console.log(
        `Inserted ${insert.fullName} (${insert.phoneE164}) → cleaner ${insert.cleanerId}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: string }).code)
          : "failed";

      if (code === "auth_not_found") authNotFound += 1;
      else if (code === "auth_role_blocked") authRoleBlocked += 1;
      else failed += 1;

      reportRows.push(
        planRowToReportEntry(planRow, {
          status: code === "auth_not_found" || code === "auth_role_blocked" ? code : "failed",
          message,
        } as ExecuteRowResult),
      );
      console.error(`Failed row ${planRow.row.rowNumber} (${planRow.row.fullName}): ${message}`);
    }
  }

  const finalSummary = {
    ...summary,
    authNotFound,
    authRoleBlocked,
    failed,
    executedInserts: options.execute ? executedInserts : 0,
  };

  const report: ImportCleanersReport = {
    generatedAt: new Date().toISOString(),
    mode: options.dryRun ? "dry-run" : "execute",
    csvPath: options.csvPath,
    summary: finalSummary,
    rows: reportRows,
    issues: plan.issues,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("\nSummary:");
  console.log(`  Total CSV rows:     ${finalSummary.totalRows}`);
  console.log(`  Would insert:       ${finalSummary.inserted}`);
  console.log(`  Skipped:            ${finalSummary.skipped}`);
  console.log(`    (CSV duplicates): ${finalSummary.duplicateCsv}`);
  console.log(`    (Already in DB):  ${finalSummary.existingCleaner}`);
  console.log(`  Invalid:            ${finalSummary.invalid}`);
  console.log(`  Linking blocked:    ${linkingBlocked}`);
  console.log(`  Auth not found:     ${finalSummary.authNotFound}`);
  console.log(`  Auth role blocked:  ${finalSummary.authRoleBlocked}`);
  if (options.execute) {
    console.log(`  Inserted:           ${finalSummary.executedInserts}`);
    console.log(`  Failed:             ${finalSummary.failed}`);
  }
  console.log(`\nReport written to ${REPORT_PATH}`);

  if (options.dryRun) {
    console.log("\nNo database writes (dry-run).");
    if (linkingBlocked > 0 || !linkingLoad.ok) {
      console.log("Run npm run import:cleaners:link-auth then fix auth before --execute.");
    } else {
      console.log("Linking complete — re-run link-auth after any auth changes, then --execute.");
    }
  }

  return failed > 0 || authNotFound > 0 || linkingBlocked > 0 ? 1 : 0;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  return runImport(options);
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("import-cleaners-data.ts") ||
    process.argv[1].endsWith("import-cleaners-data.mjs"));

if (isMain) {
  void main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
