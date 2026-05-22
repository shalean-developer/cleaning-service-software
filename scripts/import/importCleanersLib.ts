/**
 * Cleaner CSV import helpers (data-only; no schema changes).
 *
 * Schema audit (public.cleaners + related):
 * - cleaners: profile_id (FK profiles.id = auth.users.id), phone, active, suspended_at,
 *   average_rating, deleted_at, onboarding_completed_at, suspension_ends_at, lifecycle_reason
 * - profiles: id, role, full_name (auth-linked; never create auth users in this import)
 * - cleaner_service_areas, cleaner_service_capabilities, cleaner_availability (child profile data)
 * - NOT touched: bookings, booking_cleaners, assignment_offers, earning_lines, payments, auth.users
 */

import { parseServiceAreasInput } from "@/features/cleaners/admin/cleanerProfileFormValidation";
import type { CleanerAvailabilityWindow } from "@/features/cleaners/admin/cleanerAvailability";
import { CLEANER_AVAILABILITY_TIMEZONE_DEFAULT } from "@/features/cleaners/admin/cleanerAvailability";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { buildShaleanCleanerAuthEmail } from "@/lib/auth/cleanerAuthIdentity";
import { normalizeZaMobilePhone, isValidZaMobilePhone } from "@/lib/validation/zaPhone";

export type CsvCleanerRow = Record<string, string>;

export type NormalizedCleanerImportRow = {
  rowNumber: number;
  legacyId: string | null;
  fullName: string;
  email: string;
  phoneE164: string;
  authUserId: string | null;
  averageRating: number | null;
  onboardingCompletedAt: string | null;
  serviceAreaSlugs: string[];
  capabilities: ServiceSlug[];
  availabilityWindows: CleanerAvailabilityWindow[];
  csvIsActive: boolean;
};

export type RowIssue = {
  rowNumber: number;
  code: string;
  message: string;
  legacyId?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type ImportPlanRow =
  | {
      kind: "insert";
      row: NormalizedCleanerImportRow;
      resolvedAuthUserId: string;
      matchedAuthEmail: string;
    }
  | {
      kind: "skip";
      row: NormalizedCleanerImportRow;
      reason: string;
      code: "duplicate_csv" | "duplicate_db" | "existing_cleaner";
    }
  | {
      kind: "invalid";
      rowNumber: number;
      issues: RowIssue[];
    };

export type ImportPlan = {
  totalRows: number;
  validRows: NormalizedCleanerImportRow[];
  plan: ImportPlanRow[];
  issues: RowIssue[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function parseBool(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "true" || v === "t" || v === "1" || v === "yes";
}

function parseRating(value: string | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 5) return null;
  return Math.round(n * 100) / 100;
}

function parseTimestamp(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function formatTimeForDb(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) return null;
  const hh = match[1]!.padStart(2, "0");
  const mm = match[2]!;
  return `${hh}:${mm}:00`;
}

function parseAvailabilityWeekdays(raw: string | undefined): number[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [];

  let tokens: string[] = [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      tokens = parsed.map((v) => String(v).trim().toLowerCase());
    }
  } catch {
    tokens = trimmed
      .replace(/[\[\]"]/g, "")
      .split(/[,]+/)
      .map((t) => t.trim().toLowerCase());
  }

  const days: number[] = [];
  const seen = new Set<number>();
  for (const token of tokens) {
    const day = DAY_MAP[token];
    if (day === undefined || seen.has(day)) continue;
    seen.add(day);
    days.push(day);
  }
  return days.sort((a, b) => a - b);
}

function buildCapabilities(row: CsvCleanerRow): ServiceSlug[] {
  const caps = new Set<ServiceSlug>(["regular-cleaning"]);
  if (parseBool(row.can_do_deep_cleaning)) caps.add("deep-cleaning");
  if (parseBool(row.can_do_move_cleaning)) caps.add("moving-cleaning");
  return [...caps];
}

function buildAvailabilityWindows(row: CsvCleanerRow): CleanerAvailabilityWindow[] {
  const days = parseAvailabilityWeekdays(row.availability_weekdays);
  if (days.length === 0) return [];

  const startTime = formatTimeForDb(row.availability_start) ?? "08:00:00";
  const endTime = formatTimeForDb(row.availability_end) ?? "17:00:00";

  return days.map((dayOfWeek) => ({
    dayOfWeek,
    startTime,
    endTime,
    timezone: CLEANER_AVAILABILITY_TIMEZONE_DEFAULT,
  }));
}

function pickPhone(row: CsvCleanerRow): string {
  return (row.phone ?? row.phone_number ?? "").trim();
}

/** Minimal RFC-style CSV parser (quoted fields, commas). */
export function parseCsv(text: string): CsvCleanerRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0] ?? "").map((h) => h.trim());
  const rows: CsvCleanerRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line?.trim()) continue;
    const cells = parseCsvLine(line);
    const record: CsvCleanerRow = {};
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c];
      if (!key) continue;
      record[key] = (cells[c] ?? "").trim();
    }
    rows.push(record);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

export function normalizeCleanerRow(
  row: CsvCleanerRow,
  rowNumber: number,
): { ok: true; value: NormalizedCleanerImportRow } | { ok: false; issues: RowIssue[] } {
  const issues: RowIssue[] = [];
  const fullName = (row.full_name ?? "").trim();
  const email = (row.email ?? "").trim().toLowerCase();
  const phoneRaw = pickPhone(row);
  const authUserIdRaw = (row.auth_user_id ?? "").trim();

  if (!fullName || fullName.length < 2) {
    issues.push({
      rowNumber,
      code: "INVALID_FULL_NAME",
      message: "full_name is required (min 2 characters).",
      legacyId: row.id ?? null,
    });
  }

  if (!email || !EMAIL_RE.test(email)) {
    issues.push({
      rowNumber,
      code: "INVALID_EMAIL",
      message: "email is missing or invalid.",
      legacyId: row.id ?? null,
      email: email || null,
    });
  }

  const phoneE164 = normalizeZaMobilePhone(phoneRaw);
  if (!phoneE164 || !isValidZaMobilePhone(phoneRaw)) {
    issues.push({
      rowNumber,
      code: "INVALID_PHONE",
      message: "phone / phone_number must be a valid South African mobile.",
      legacyId: row.id ?? null,
      phone: phoneRaw || null,
    });
  }

  let authUserId: string | null = null;
  if (authUserIdRaw) {
    if (!UUID_RE.test(authUserIdRaw)) {
      issues.push({
        rowNumber,
        code: "INVALID_AUTH_USER_ID",
        message: "auth_user_id must be a UUID when provided.",
        legacyId: row.id ?? null,
      });
    } else {
      authUserId = authUserIdRaw;
    }
  }

  const shaleanEmail = phoneE164 ? buildShaleanCleanerAuthEmail(phoneE164) : null;
  if (phoneE164 && shaleanEmail && email && email !== shaleanEmail) {
    const legacyCleanerDomain =
      email.endsWith("@cleaner.shalean.com") || email.endsWith("@cleaner.shalean.co.za");
    if (!legacyCleanerDomain) {
      issues.push({
        rowNumber,
        code: "EMAIL_PHONE_MISMATCH",
        message: `email does not match phone-derived auth email (${shaleanEmail}).`,
        email,
        phone: phoneE164,
      });
    }
  }

  const locationRaw = (row.location ?? "").trim();
  const serviceAreaSlugs = locationRaw ? parseServiceAreasInput(locationRaw) : [];

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      rowNumber,
      legacyId: row.id?.trim() || null,
      fullName,
      email,
      phoneE164: phoneE164!,
      authUserId,
      averageRating: parseRating(row.rating),
      onboardingCompletedAt:
        parseTimestamp(row.joined_at) ?? parseTimestamp(row.created_at),
      serviceAreaSlugs,
      capabilities: buildCapabilities(row),
      availabilityWindows: buildAvailabilityWindows(row),
      csvIsActive: parseBool(row.is_active),
    },
  };
}

export type ExistingCleanerIndex = {
  byPhone: Map<string, { cleanerId: string; profileId: string }>;
  byProfileId: Map<string, { cleanerId: string; phone: string | null }>;
};

export function buildImportPlan(
  csvRows: CsvCleanerRow[],
  existing: ExistingCleanerIndex,
): ImportPlan {
  const issues: RowIssue[] = [];
  const validRows: NormalizedCleanerImportRow[] = [];
  const plan: ImportPlanRow[] = [];

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  for (let i = 0; i < csvRows.length; i += 1) {
    const rowNumber = i + 2;
    const normalized = normalizeCleanerRow(csvRows[i]!, rowNumber);
    if (!normalized.ok) {
      issues.push(...normalized.issues);
      plan.push({ kind: "invalid", rowNumber, issues: normalized.issues });
      continue;
    }

    const row = normalized.value;
    validRows.push(row);

    if (seenEmails.has(row.email)) {
      const issue: RowIssue = {
        rowNumber,
        code: "DUPLICATE_CSV_EMAIL",
        message: `Duplicate email in CSV: ${row.email}`,
        email: row.email,
      };
      issues.push(issue);
      plan.push({
        kind: "skip",
        row,
        reason: issue.message,
        code: "duplicate_csv",
      });
      continue;
    }

    if (seenPhones.has(row.phoneE164)) {
      const issue: RowIssue = {
        rowNumber,
        code: "DUPLICATE_CSV_PHONE",
        message: `Duplicate phone in CSV: ${row.phoneE164}`,
        phone: row.phoneE164,
      };
      issues.push(issue);
      plan.push({
        kind: "skip",
        row,
        reason: issue.message,
        code: "duplicate_csv",
      });
      continue;
    }

    seenEmails.add(row.email);
    seenPhones.add(row.phoneE164);

    const byPhone = existing.byPhone.get(row.phoneE164);
    if (byPhone) {
      plan.push({
        kind: "skip",
        row,
        reason: `Cleaner already exists for phone (cleaner_id=${byPhone.cleanerId}).`,
        code: "existing_cleaner",
      });
      continue;
    }

    if (row.authUserId) {
      const byProfile = existing.byProfileId.get(row.authUserId);
      if (byProfile) {
        plan.push({
          kind: "skip",
          row,
          reason: `Cleaner already exists for auth user (cleaner_id=${byProfile.cleanerId}).`,
          code: "existing_cleaner",
        });
        continue;
      }
    }

    if (!row.authUserId) {
      issues.push({
        rowNumber,
        code: "MISSING_AUTH_USER_ID",
        message:
          "auth_user_id is required — cleaners must link to an existing auth user (no auth creation).",
        email: row.email,
        phone: row.phoneE164,
      });
      plan.push({
        kind: "invalid",
        rowNumber,
        issues: [
          {
            rowNumber,
            code: "MISSING_AUTH_USER_ID",
            message: "auth_user_id is required.",
          },
        ],
      });
      continue;
    }

    plan.push({
      kind: "insert",
      row,
      resolvedAuthUserId: row.authUserId,
      matchedAuthEmail: row.email,
    });
  }

  return {
    totalRows: csvRows.length,
    validRows,
    plan,
    issues,
  };
}

export function summarizePlan(plan: ImportPlan) {
  const inserted = plan.plan.filter((p) => p.kind === "insert").length;
  const skipped = plan.plan.filter((p) => p.kind === "skip").length;
  const invalid = plan.plan.filter((p) => p.kind === "invalid").length;
  const duplicateCsv = plan.plan.filter(
    (p) => p.kind === "skip" && p.code === "duplicate_csv",
  ).length;
  const existingCleaner = plan.plan.filter(
    (p) => p.kind === "skip" && p.code === "existing_cleaner",
  ).length;

  return {
    totalRows: plan.totalRows,
    inserted,
    skipped,
    invalid,
    duplicates: duplicateCsv + existingCleaner,
    duplicateCsv,
    existingCleaner,
  };
}
