import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsv, type CsvCleanerRow } from "../../../../../scripts/import/importCleanersLib";

const LEADS_CSV_PATH = resolve(process.cwd(), "cleaner-onboarding-leads.csv");
const REPORT_JSON_PATH = resolve(process.cwd(), "cleaner-onboarding-leads-report.json");

export type CleanerOnboardingLeadItem = {
  fullName: string;
  phone: string;
  adminLoginEmail: string;
  status: string;
  notes: string;
  sourceCsvRow: number;
};

export type CleanerOnboardingLeadsLoadResult =
  | {
      ok: true;
      source: "json" | "csv";
      leads: CleanerOnboardingLeadItem[];
      generatedAt: string | null;
      reportSummary: {
        totalRows: number;
        needsAuthInvite: number;
        existingCleaner: number;
      } | null;
    }
  | {
      ok: false;
      code: "files_missing";
      message: string;
    };

function mapCsvRows(rows: CsvCleanerRow[]): CleanerOnboardingLeadItem[] {
  const leads: CleanerOnboardingLeadItem[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const status = (row.status ?? "").trim();
    if (status !== "needs_auth_invite") continue;

    const fullName = (row.full_name ?? "").trim();
    const phone = (row.phone ?? "").trim();
    if (!fullName || !phone) continue;

    leads.push({
      fullName,
      phone,
      adminLoginEmail: (row.admin_login_email ?? "").trim(),
      status,
      notes: (row.notes ?? "").trim(),
      sourceCsvRow: Number(row.source_csv_row) || i + 2,
    });
  }

  return leads;
}

function loadFromCsv(): CleanerOnboardingLeadItem[] | null {
  if (!existsSync(LEADS_CSV_PATH)) return null;
  const text = readFileSync(LEADS_CSV_PATH, "utf8");
  return mapCsvRows(parseCsv(text));
}

type ReportJsonRow = {
  fullName?: string;
  phoneE164?: string | null;
  status?: string;
  adminLoginEmail?: string | null;
  notes?: string;
  rowNumber?: number;
  includedInLeadsCsv?: boolean;
};

type ReportJson = {
  generatedAt?: string;
  summary?: {
    totalRows?: number;
    needsAuthInvite?: number;
    existingCleaner?: number;
  };
  rows?: ReportJsonRow[];
};

function loadFromReportJson(): {
  leads: CleanerOnboardingLeadItem[];
  generatedAt: string | null;
  reportSummary: {
    totalRows: number;
    needsAuthInvite: number;
    existingCleaner: number;
  };
} | null {
  if (!existsSync(REPORT_JSON_PATH)) return null;

  const parsed = JSON.parse(readFileSync(REPORT_JSON_PATH, "utf8")) as ReportJson;
  const leads: CleanerOnboardingLeadItem[] = [];

  for (const row of parsed.rows ?? []) {
    const status = (row.status ?? "").trim();
    if (status !== "needs_auth_invite") continue;
    if (row.includedInLeadsCsv === false) continue;

    const fullName = (row.fullName ?? "").trim();
    const phone = (row.phoneE164 ?? "").trim();
    if (!fullName || !phone) continue;

    leads.push({
      fullName,
      phone,
      adminLoginEmail: (row.adminLoginEmail ?? "").trim(),
      status,
      notes: (row.notes ?? "").trim(),
      sourceCsvRow: row.rowNumber ?? 0,
    });
  }

  leads.sort((a, b) => a.sourceCsvRow - b.sourceCsvRow);

  return {
    leads,
    generatedAt: parsed.generatedAt ?? null,
    reportSummary: {
      totalRows: parsed.summary?.totalRows ?? parsed.rows?.length ?? 0,
      needsAuthInvite: parsed.summary?.needsAuthInvite ?? leads.length,
      existingCleaner: parsed.summary?.existingCleaner ?? 0,
    },
  };
}

/**
 * Loads onboarding invite candidates from local import artifacts (read-only).
 * Prefers report JSON when present; falls back to leads CSV.
 */
export function loadCleanerOnboardingLeads(): CleanerOnboardingLeadsLoadResult {
  const fromJson = loadFromReportJson();
  if (fromJson) {
    return {
      ok: true,
      source: "json",
      leads: fromJson.leads,
      generatedAt: fromJson.generatedAt,
      reportSummary: fromJson.reportSummary,
    };
  }

  const fromCsv = loadFromCsv();
  if (fromCsv) {
    return {
      ok: true,
      source: "csv",
      leads: fromCsv,
      generatedAt: null,
      reportSummary: null,
    };
  }

  return {
    ok: false,
    code: "files_missing",
    message:
      "No cleaner-onboarding-leads-report.json or cleaner-onboarding-leads.csv found. Run npm run import:cleaners:onboarding-leads locally, then deploy or copy the generated files.",
  };
}

export function buildAdminCreateCleanerHref(lead: {
  fullName: string;
  phone: string;
}): string {
  const params = new URLSearchParams();
  params.set("fullName", lead.fullName);
  params.set("phone", lead.phone);
  return `/admin/cleaners/new?${params.toString()}`;
}
