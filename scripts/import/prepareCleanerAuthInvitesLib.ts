/**
 * Build cleaner invite/onboarding CSV from auth-linking report (read-only).
 */

import { buildShaleanCleanerAuthEmail } from "@/lib/auth/cleanerAuthIdentity";
import { normalizeZaMobilePhone, isValidZaMobilePhone } from "@/lib/validation/zaPhone";
import { parseCsv, type CsvCleanerRow } from "./importCleanersLib";

const PLACEHOLDER_EMAIL_SUFFIXES = ["@cleaner.shalean.com", "@cleaner.shalean.co.za"] as const;
const REAL_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type InviteEmailKind = "real_email" | "placeholder_email" | "phone_derived_login" | "missing";

export type InviteRowStatus = "pending_invite" | "missing_contact" | "review_required";

export type CleanerAuthInviteRow = {
  fullName: string;
  email: string;
  phone: string;
  temporaryEmailIfNeeded: string;
  sourceCsvRow: number;
  status: InviteRowStatus;
  notes: string;
  emailKind: InviteEmailKind;
  csvEmail: string;
  adminLoginEmail: string;
};

export type InvitePrepareSummary = {
  totalNeedsInvite: number;
  realEmailsAvailable: number;
  placeholderEmails: number;
  /** Rows where Admin login comes from phone (@shalean.co.za), incl. legacy placeholders. */
  phoneDerivedLoginsNeeded: number;
  missingPhoneOrEmail: number;
  pendingInvite: number;
};

export type InvitePrepareResult = {
  rows: CleanerAuthInviteRow[];
  summary: InvitePrepareSummary;
};

function isPlaceholderCleanerEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return PLACEHOLDER_EMAIL_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function isShaleanLoginEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return lower.endsWith("@shalean.co.za");
}

function isRealPersonalEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !REAL_EMAIL_RE.test(trimmed)) return false;
  if (isPlaceholderCleanerEmail(trimmed)) return false;
  if (isShaleanLoginEmail(trimmed)) return false;
  return true;
}

/** E.164 without leading +, e.g. +27680284159 → 27680284159 */
export function phoneToLoginEmailLocalPart(phoneE164: string): string | null {
  const normalized = normalizeZaMobilePhone(phoneE164);
  if (!normalized || !normalized.startsWith("+")) return null;
  return normalized.slice(1);
}

/** Spec format: {normalized_phone_without_plus}@shalean.co.za */
export function buildPhoneDerivedLoginEmailSpec(phoneE164: string): string | null {
  const localPart = phoneToLoginEmailLocalPart(phoneE164);
  if (!localPart) return null;
  return `${localPart}@shalean.co.za`;
}

/** What Admin → Cleaners → New generates from phone (0XXXXXXXXX@shalean.co.za). */
export function buildAdminProvisionerLoginEmail(phoneE164: string): string | null {
  return buildShaleanCleanerAuthEmail(phoneE164);
}

export function classifyInviteEmail(
  csvEmail: string,
  phoneE164: string,
): {
  emailKind: InviteEmailKind;
  adminLoginEmail: string;
  temporaryEmailIfNeeded: string;
  notes: string[];
} {
  const notes: string[] = [];
  const csvTrimmed = csvEmail.trim().toLowerCase();
  const adminFromPhone = buildAdminProvisionerLoginEmail(phoneE164);
  const specPhoneEmail = buildPhoneDerivedLoginEmailSpec(phoneE164);

  if (isRealPersonalEmail(csvTrimmed)) {
    notes.push("Use real email for login if cleaner has mailbox access.");
    return {
      emailKind: "real_email",
      adminLoginEmail: csvTrimmed,
      temporaryEmailIfNeeded: adminFromPhone ?? specPhoneEmail ?? "",
      notes,
    };
  }

  if (isPlaceholderCleanerEmail(csvTrimmed)) {
    notes.push("CSV email is legacy placeholder (@cleaner.shalean.com); do not use for login.");
    const login =
      adminFromPhone ?? specPhoneEmail ?? "";
    if (adminFromPhone && specPhoneEmail && adminFromPhone !== specPhoneEmail) {
      notes.push(
        `Admin form will create ${adminFromPhone}; spec format would be ${specPhoneEmail}.`,
      );
    } else if (adminFromPhone) {
      notes.push(`Admin → Cleaners → New will assign login: ${adminFromPhone}`);
    }
    return {
      emailKind: "placeholder_email",
      adminLoginEmail: login,
      temporaryEmailIfNeeded: csvTrimmed,
      notes,
    };
  }

  if (csvTrimmed && isShaleanLoginEmail(csvTrimmed)) {
    notes.push("CSV already uses @shalean.co.za login format.");
    return {
      emailKind: "phone_derived_login",
      adminLoginEmail: csvTrimmed,
      temporaryEmailIfNeeded: "",
      notes,
    };
  }

  if (!csvTrimmed && adminFromPhone) {
    notes.push("No CSV email; use phone-derived @shalean.co.za login.");
    return {
      emailKind: "phone_derived_login",
      adminLoginEmail: adminFromPhone,
      temporaryEmailIfNeeded: "",
      notes,
    };
  }

  if (adminFromPhone) {
    notes.push("Fallback to phone-derived login email.");
    return {
      emailKind: "phone_derived_login",
      adminLoginEmail: adminFromPhone,
      temporaryEmailIfNeeded: csvTrimmed || "",
      notes,
    };
  }

  notes.push("Missing valid phone and usable email.");
  return {
    emailKind: "missing",
    adminLoginEmail: "",
    temporaryEmailIfNeeded: csvTrimmed,
    notes,
  };
}

export function buildInviteRowsFromLinkingReport(
  linkingRows: CsvCleanerRow[],
): InvitePrepareResult {
  const rows: CleanerAuthInviteRow[] = [];

  for (const raw of linkingRows) {
    const linkageStatus = (raw.linkage_status ?? "").trim().toLowerCase();
    if (linkageStatus !== "needs_auth_invite") continue;

    const rowNumber = Number(raw.row_number);
    const fullName = (raw.full_name ?? "").trim();
    const csvEmail = (raw.csv_email ?? "").trim().toLowerCase();
    const phoneE164 = normalizeZaMobilePhone(raw.phone_e164 ?? "") ?? "";

    const classified = classifyInviteEmail(csvEmail, phoneE164);

    let status: InviteRowStatus = "pending_invite";
    if (classified.emailKind === "missing" || !phoneE164 || !isValidZaMobilePhone(phoneE164)) {
      status = "missing_contact";
    } else if (!classified.adminLoginEmail) {
      status = "review_required";
    }

    const noteParts = [
      ...classified.notes,
      raw.match_notes ? `Linking: ${raw.match_notes}` : "",
    ].filter(Boolean);

    rows.push({
      fullName,
      email: classified.adminLoginEmail,
      phone: phoneE164,
      temporaryEmailIfNeeded: classified.temporaryEmailIfNeeded,
      sourceCsvRow: Number.isInteger(rowNumber) ? rowNumber : 0,
      status,
      notes: noteParts.join(" "),
      emailKind: classified.emailKind,
      csvEmail,
      adminLoginEmail: classified.adminLoginEmail,
    });
  }

  rows.sort((a, b) => a.sourceCsvRow - b.sourceCsvRow);

  const summary: InvitePrepareSummary = {
    totalNeedsInvite: rows.length,
    realEmailsAvailable: rows.filter((r) => r.emailKind === "real_email").length,
    placeholderEmails: rows.filter((r) => r.emailKind === "placeholder_email").length,
    phoneDerivedLoginsNeeded: rows.filter(
      (r) => r.emailKind === "phone_derived_login" || r.emailKind === "placeholder_email",
    ).length,
    missingPhoneOrEmail: rows.filter(
      (r) => r.emailKind === "missing" || r.status === "missing_contact",
    ).length,
    pendingInvite: rows.filter((r) => r.status === "pending_invite").length,
  };

  return { rows, summary };
}

export function inviteRowsToCsv(rows: CleanerAuthInviteRow[]): string {
  const headers = [
    "full_name",
    "email",
    "phone",
    "temporary_email_if_needed",
    "source_csv_row",
    "status",
    "notes",
  ];

  const escape = (value: string | number): string => {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.fullName,
        r.email,
        r.phone,
        r.temporaryEmailIfNeeded,
        r.sourceCsvRow,
        r.status,
        r.notes,
      ]
        .map(escape)
        .join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}

export function parseLinkingReportCsv(text: string): CsvCleanerRow[] {
  return parseCsv(text);
}
