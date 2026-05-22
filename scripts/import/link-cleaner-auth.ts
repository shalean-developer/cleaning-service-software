#!/usr/bin/env node
/**
 * Analyze cleaner CSV rows against current Supabase auth/profiles (read-only).
 *
 * Produces cleaner-auth-linking-report.csv — required before import --execute.
 *
 * Usage:
 *   npx tsx scripts/import/link-cleaner-auth.ts [--csv path]
 *
 * Does NOT create auth users, modify profiles, or import cleaner data.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  analyzeAllCleanerAuthLinks,
  linkingResultsToCsv,
  summarizeAuthLinking,
  type AuthIndex,
  type AuthUserRecord,
  type CleanerRecord,
  type DbSnapshot,
  type ProfileRecord,
} from "./linkCleanerAuthLib";
import { parseCsv } from "./importCleanersLib";

const DEFAULT_CSV = resolve(process.cwd(), "data/import/cleaners_import_ready_safe.csv");
const REPORT_CSV_PATH = resolve(process.cwd(), "cleaner-auth-linking-report.csv");
const REPORT_JSON_PATH = resolve(process.cwd(), "cleaner-auth-linking-report.json");

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

async function loadAuthIndex(client: SupabaseClient<Database>): Promise<AuthIndex> {
  const byId = new Map<string, AuthUserRecord>();
  const byEmail = new Map<string, AuthUserRecord>();
  let page = 1;

  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);

    for (const user of data.users ?? []) {
      const record: AuthUserRecord = {
        id: user.id,
        email: user.email?.trim().toLowerCase() ?? null,
      };
      byId.set(record.id, record);
      if (record.email) byEmail.set(record.email, record);
    }

    if ((data.users ?? []).length < 200) break;
    page += 1;
  }

  return { byId, byEmail };
}

async function loadDbSnapshot(client: SupabaseClient<Database>): Promise<DbSnapshot> {
  const auth = await loadAuthIndex(client);

  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id, role, full_name");
  if (profileError) throw new Error(profileError.message);

  const profileMap = new Map<string, ProfileRecord>();
  for (const row of profiles ?? []) {
    profileMap.set(row.id, {
      id: row.id,
      role: row.role as ProfileRecord["role"],
      full_name: row.full_name,
    });
  }

  const { data: cleaners, error: cleanerError } = await client
    .from("cleaners")
    .select("id, profile_id, phone");
  if (cleanerError) throw new Error(cleanerError.message);

  const cleanersByPhone = new Map<string, CleanerRecord>();
  const cleanersByProfileId = new Map<string, CleanerRecord>();
  for (const row of cleaners ?? []) {
    const record: CleanerRecord = {
      id: row.id,
      profile_id: row.profile_id,
      phone: row.phone,
    };
    cleanersByProfileId.set(row.profile_id, record);
    if (row.phone) cleanersByPhone.set(row.phone, record);
  }

  return { auth, profiles: profileMap, cleanersByPhone, cleanersByProfileId };
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

  console.log("\nCleaner auth linking analysis (read-only)\n");
  console.log(`CSV: ${csvPath}`);

  const snapshot = await loadDbSnapshot(client);
  console.log(`Auth users loaded: ${snapshot.auth.byId.size}`);
  console.log(`Profiles: ${snapshot.profiles.size}`);
  console.log(`Cleaners: ${snapshot.cleanersByProfileId.size}\n`);

  const { results, invalidRows } = analyzeAllCleanerAuthLinks(csvRows, snapshot);
  const summary = summarizeAuthLinking(results);

  writeFileSync(REPORT_CSV_PATH, linkingResultsToCsv(results), "utf8");
  writeFileSync(
    REPORT_JSON_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), csvPath, summary, invalidRows, results }, null, 2)}\n`,
    "utf8",
  );

  console.log("Linkage summary:");
  console.log(`  Total rows:           ${summary.totalRows}`);
  console.log(`  Matched (ready):      ${summary.matchedReady}`);
  console.log(`  Already imported:     ${summary.alreadyImported}`);
  console.log(`  Needs auth invite:    ${summary.needsAuthInvite}`);
  console.log(`  Duplicate/conflict:   ${summary.duplicateConflict}`);
  console.log(`  Cannot map:           ${summary.cannotMap}`);
  console.log(`  Import blocked:       ${summary.importBlocked ? "YES" : "NO"}`);
  console.log(`  Blocked rows:         ${summary.blockedRowCount}`);

  console.log(`\nReports written:`);
  console.log(`  ${REPORT_CSV_PATH}`);
  console.log(`  ${REPORT_JSON_PATH}`);

  if (summary.needsAuthInvite > 0) {
    console.log("\nCleaners needing auth (create via Admin → Cleaners → New):");
    for (const row of results.filter((r) => r.linkageStatus === "needs_auth_invite")) {
      console.log(`  - ${row.fullName} (${row.phoneE164})`);
    }
  }

  if (summary.matchedReady > 0) {
    console.log("\nReady to link on import (have current_profile_id):");
    for (const row of results.filter((r) => r.linkageStatus === "matched_ready")) {
      console.log(`  - ${row.fullName} → profile ${row.currentProfileId}`);
    }
  }

  console.log(
    "\nImport remains blocked until every CSV row is matched_ready or already_imported with a valid profile_id.",
  );
  console.log("Do not run import:cleaners:execute until auth linking is complete.\n");

  return summary.importBlocked ? 1 : 0;
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("link-cleaner-auth.ts") ||
    process.argv[1].endsWith("link-cleaner-auth.mjs"));

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

export { REPORT_CSV_PATH };
