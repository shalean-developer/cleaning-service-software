/**
 * Safe cleaner onboarding lead import (full_name + phone only).
 *
 * Read-only against DB: no auth users, no cleaners inserts, no bookings/payouts/offers.
 * No staging table in schema — outputs CSV + JSON report only.
 */

import { buildShaleanCleanerAuthEmail } from "@/lib/auth/cleanerAuthIdentity";
import { normalizeZaMobilePhone, isValidZaMobilePhone } from "@/lib/validation/zaPhone";
import { parseCsv, type CsvCleanerRow } from "./importCleanersLib";

export type OnboardingLeadStatus =
  | "needs_auth_invite"
  | "existing_cleaner"
  | "duplicate_csv"
  | "invalid";

export type ExistingCleanerByPhone = {
  cleanerId: string;
  profileId: string;
  active: boolean | null;
};

export type OnboardingLeadRow = {
  rowNumber: number;
  fullName: string;
  phoneRaw: string;
  phoneE164: string | null;
  status: OnboardingLeadStatus;
  /** Always false — leads are never provisioned as active cleaners by this import. */
  active: false;
  existingCleanerId: string | null;
  adminLoginEmail: string | null;
  notes: string;
  /** Whether row appears in cleaner-onboarding-leads.csv */
  includedInLeadsCsv: boolean;
};

export type OnboardingLeadsPlan = {
  rows: OnboardingLeadRow[];
  issues: Array<{ rowNumber: number; code: string; message: string }>;
};

export type OnboardingLeadsSummary = {
  totalRows: number;
  needsAuthInvite: number;
  existingCleaner: number;
  duplicateCsv: number;
  invalid: number;
  includedInLeadsCsv: number;
};

export function normalizeOnboardingLeadRow(
  row: CsvCleanerRow,
  rowNumber: number,
): Pick<OnboardingLeadRow, "fullName" | "phoneRaw" | "phoneE164" | "status" | "notes"> | null {
  const fullName = (row.full_name ?? "").trim();
  const phoneRaw = (row.phone ?? row.phone_number ?? "").trim();

  if (!fullName || fullName.length < 2) {
    return {
      fullName,
      phoneRaw,
      phoneE164: null,
      status: "invalid",
      notes: "full_name is required (min 2 characters).",
    };
  }

  const phoneE164 = normalizeZaMobilePhone(phoneRaw);
  if (!phoneE164 || !isValidZaMobilePhone(phoneRaw)) {
    return {
      fullName,
      phoneRaw,
      phoneE164: null,
      status: "invalid",
      notes: "phone must be a valid South African mobile (+27 format).",
    };
  }

  return {
    fullName,
    phoneRaw,
    phoneE164,
    status: "needs_auth_invite",
    notes: "",
  };
}

export function buildOnboardingLeadsPlan(
  csvRows: CsvCleanerRow[],
  existingByPhone: Map<string, ExistingCleanerByPhone>,
): OnboardingLeadsPlan {
  const rows: OnboardingLeadRow[] = [];
  const issues: OnboardingLeadsPlan["issues"] = [];
  const seenPhones = new Set<string>();

  for (let i = 0; i < csvRows.length; i += 1) {
    const rowNumber = i + 2;
    const normalized = normalizeOnboardingLeadRow(csvRows[i]!, rowNumber);

    if (!normalized) {
      continue;
    }

    if (normalized.status === "invalid") {
      issues.push({
        rowNumber,
        code: "INVALID_ROW",
        message: normalized.notes,
      });
      rows.push({
        rowNumber,
        fullName: normalized.fullName,
        phoneRaw: normalized.phoneRaw,
        phoneE164: normalized.phoneE164,
        status: "invalid",
        active: false,
        existingCleanerId: null,
        adminLoginEmail: null,
        notes: normalized.notes,
        includedInLeadsCsv: false,
      });
      continue;
    }

    const phoneE164 = normalized.phoneE164!;

    if (seenPhones.has(phoneE164)) {
      const note = `Duplicate phone in CSV: ${phoneE164}`;
      issues.push({ rowNumber, code: "DUPLICATE_CSV_PHONE", message: note });
      rows.push({
        rowNumber,
        fullName: normalized.fullName,
        phoneRaw: normalized.phoneRaw,
        phoneE164,
        status: "duplicate_csv",
        active: false,
        existingCleanerId: null,
        adminLoginEmail: buildShaleanCleanerAuthEmail(phoneE164),
        notes: note,
        includedInLeadsCsv: false,
      });
      continue;
    }

    seenPhones.add(phoneE164);

    const existing = existingByPhone.get(phoneE164);
    if (existing) {
      const note = `Cleaner already exists (cleaner_id=${existing.cleanerId}). Skip — do not create active cleaner without auth linkage.`;
      rows.push({
        rowNumber,
        fullName: normalized.fullName,
        phoneRaw: normalized.phoneRaw,
        phoneE164,
        status: "existing_cleaner",
        active: false,
        existingCleanerId: existing.cleanerId,
        adminLoginEmail: buildShaleanCleanerAuthEmail(phoneE164),
        notes: note,
        includedInLeadsCsv: false,
      });
      continue;
    }

    const adminLoginEmail = buildShaleanCleanerAuthEmail(phoneE164);
    rows.push({
      rowNumber,
      fullName: normalized.fullName,
      phoneRaw: normalized.phoneRaw,
      phoneE164,
      status: "needs_auth_invite",
      active: false,
      existingCleanerId: null,
      adminLoginEmail,
      notes:
        "Onboarding lead only. Create via Admin → Cleaners → New (inactive until onboarding). Not in assignment pool.",
      includedInLeadsCsv: true,
    });
  }

  return { rows, issues };
}

export function summarizeOnboardingLeadsPlan(plan: OnboardingLeadsPlan): OnboardingLeadsSummary {
  const needsAuthInvite = plan.rows.filter((r) => r.status === "needs_auth_invite").length;
  const existingCleaner = plan.rows.filter((r) => r.status === "existing_cleaner").length;
  const duplicateCsv = plan.rows.filter((r) => r.status === "duplicate_csv").length;
  const invalid = plan.rows.filter((r) => r.status === "invalid").length;
  const includedInLeadsCsv = plan.rows.filter((r) => r.includedInLeadsCsv).length;

  return {
    totalRows: plan.rows.length,
    needsAuthInvite,
    existingCleaner,
    duplicateCsv,
    invalid,
    includedInLeadsCsv,
  };
}

export function leadsForCsvExport(plan: OnboardingLeadsPlan): OnboardingLeadRow[] {
  return plan.rows.filter((r) => r.includedInLeadsCsv);
}

export function onboardingLeadsToCsv(rows: OnboardingLeadRow[]): string {
  const headers = [
    "full_name",
    "phone",
    "status",
    "active",
    "admin_login_email",
    "source_csv_row",
    "notes",
  ];

  const escape = (value: string | number | boolean): string => {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.fullName,
        r.phoneE164 ?? "",
        r.status,
        r.active,
        r.adminLoginEmail ?? "",
        r.rowNumber,
        r.notes,
      ]
        .map(escape)
        .join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}

export function findRowByName(
  plan: OnboardingLeadsPlan,
  fullName: string,
): OnboardingLeadRow | undefined {
  const target = fullName.trim().toLowerCase();
  return plan.rows.find((r) => r.fullName.trim().toLowerCase() === target);
}
