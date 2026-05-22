/**
 * Auth-linking analysis for cleaner CSV import (read-only; no auth/profile writes).
 */

import { buildShaleanCleanerAuthEmail } from "@/lib/auth/cleanerAuthIdentity";
import { normalizeZaMobilePhone } from "@/lib/validation/zaPhone";
import {
  normalizeCleanerRow,
  parseCsv,
  type CsvCleanerRow,
  type NormalizedCleanerImportRow,
} from "./importCleanersLib";

export type LinkageStatus =
  | "matched_ready"
  | "needs_auth_invite"
  | "duplicate_conflict"
  | "cannot_map"
  | "already_imported";

export type ProfileRole = "admin" | "cleaner" | "customer";

export type AuthUserRecord = {
  id: string;
  email: string | null;
};

export type ProfileRecord = {
  id: string;
  role: ProfileRole;
  full_name: string | null;
};

export type CleanerRecord = {
  id: string;
  profile_id: string;
  phone: string | null;
};

export type AuthIndex = {
  byId: Map<string, AuthUserRecord>;
  byEmail: Map<string, AuthUserRecord>;
};

export type DbSnapshot = {
  auth: AuthIndex;
  profiles: Map<string, ProfileRecord>;
  cleanersByPhone: Map<string, CleanerRecord>;
  cleanersByProfileId: Map<string, CleanerRecord>;
};

export type LinkingRowResult = {
  rowNumber: number;
  legacyId: string | null;
  fullName: string;
  csvEmail: string;
  phoneE164: string;
  legacyAuthUserId: string | null;
  currentShaleanAuthEmail: string | null;
  linkageStatus: LinkageStatus;
  currentProfileId: string | null;
  currentAuthEmail: string | null;
  currentProfileRole: string | null;
  existingCleanerId: string | null;
  matchMethod: string;
  matchNotes: string;
  recommendedAction: string;
  importBlocked: boolean;
};

export type LinkingSummary = {
  totalRows: number;
  matchedReady: number;
  needsAuthInvite: number;
  duplicateConflict: number;
  cannotMap: number;
  alreadyImported: number;
  importBlocked: boolean;
  blockedRowCount: number;
};

function collectCandidateEmails(row: NormalizedCleanerImportRow): string[] {
  const emails = new Set<string>();
  if (row.email) emails.add(row.email.trim().toLowerCase());
  const shalean = buildShaleanCleanerAuthEmail(row.phoneE164);
  if (shalean) emails.add(shalean.toLowerCase());
  return [...emails];
}

function lookupAuthByEmail(index: AuthIndex, email: string): AuthUserRecord | null {
  return index.byEmail.get(email.trim().toLowerCase()) ?? null;
}

function profileForAuth(
  snapshot: DbSnapshot,
  authId: string,
): ProfileRecord | null {
  return snapshot.profiles.get(authId) ?? null;
}

function cleanerForProfile(snapshot: DbSnapshot, profileId: string): CleanerRecord | null {
  return snapshot.cleanersByProfileId.get(profileId) ?? null;
}

function cleanerForPhone(snapshot: DbSnapshot, phone: string): CleanerRecord | null {
  return snapshot.cleanersByPhone.get(phone) ?? null;
}

function roleBlocksCleanerLink(role: ProfileRole | undefined): boolean {
  return role === "admin" || role === "customer";
}

function buildRecommendedAction(result: LinkingRowResult): string {
  switch (result.linkageStatus) {
    case "matched_ready":
      return result.existingCleanerId
        ? "Cleaner row exists; skip data import or update profile children only after review."
        : "Run import after linking manifest approves this profile_id.";
    case "needs_auth_invite":
      return "Create auth via Admin → Cleaners → New (or migrate auth from legacy project), then re-run linking.";
    case "duplicate_conflict":
      return "Resolve conflict manually before import; do not auto-link.";
    case "cannot_map":
      return "Fix CSV row or map manually in Supabase before import.";
    case "already_imported":
      return "No import needed; cleaner already registered in current project.";
    default:
      return "Review manually.";
  }
}

export function analyzeCleanerAuthLink(
  row: NormalizedCleanerImportRow,
  snapshot: DbSnapshot,
): LinkingRowResult {
  const currentShaleanAuthEmail = buildShaleanCleanerAuthEmail(row.phoneE164);
  const candidateEmails = collectCandidateEmails(row);

  const existingByPhone = cleanerForPhone(snapshot, row.phoneE164);
  if (existingByPhone) {
    const profile = profileForAuth(snapshot, existingByPhone.profile_id);
    return finalize({
      rowNumber: row.rowNumber,
      legacyId: row.legacyId,
      fullName: row.fullName,
      csvEmail: row.email,
      phoneE164: row.phoneE164,
      legacyAuthUserId: row.authUserId,
      currentShaleanAuthEmail,
      linkageStatus: "already_imported",
      currentProfileId: existingByPhone.profile_id,
      currentAuthEmail: snapshot.auth.byId.get(existingByPhone.profile_id)?.email ?? null,
      currentProfileRole: profile?.role ?? null,
      existingCleanerId: existingByPhone.id,
      matchMethod: "cleaner_phone",
      matchNotes: `Cleaner already exists (cleaner_id=${existingByPhone.id}).`,
    });
  }

  const authByLegacy =
    row.authUserId != null ? snapshot.auth.byId.get(row.authUserId) ?? null : null;
  const authByEmails = candidateEmails
    .map((email) => lookupAuthByEmail(snapshot.auth, email))
    .filter((a): a is AuthUserRecord => a != null);

  const authCandidates = new Map<string, AuthUserRecord>();
  if (authByLegacy) authCandidates.set(authByLegacy.id, authByLegacy);
  for (const auth of authByEmails) authCandidates.set(auth.id, auth);

  if (authCandidates.size === 0) {
    return finalize({
      rowNumber: row.rowNumber,
      legacyId: row.legacyId,
      fullName: row.fullName,
      csvEmail: row.email,
      phoneE164: row.phoneE164,
      legacyAuthUserId: row.authUserId,
      currentShaleanAuthEmail,
      linkageStatus: "needs_auth_invite",
      currentProfileId: null,
      currentAuthEmail: null,
      currentProfileRole: null,
      existingCleanerId: null,
      matchMethod: "none",
      matchNotes: row.authUserId
        ? `Legacy auth_user_id ${row.authUserId} not found in current project.`
        : "No auth_user_id and no auth user matched by email or phone.",
    });
  }

  if (authCandidates.size > 1) {
    const ids = [...authCandidates.keys()].join(", ");
    return finalize({
      rowNumber: row.rowNumber,
      legacyId: row.legacyId,
      fullName: row.fullName,
      csvEmail: row.email,
      phoneE164: row.phoneE164,
      legacyAuthUserId: row.authUserId,
      currentShaleanAuthEmail,
      linkageStatus: "duplicate_conflict",
      currentProfileId: null,
      currentAuthEmail: null,
      currentProfileRole: null,
      existingCleanerId: null,
      matchMethod: "multiple_auth",
      matchNotes: `Multiple auth users matched (${ids}).`,
    });
  }

  const auth = [...authCandidates.values()][0]!;
  const profile = profileForAuth(snapshot, auth.id);
  const matchMethod = authByLegacy
    ? "legacy_auth_id"
    : auth.email && candidateEmails.includes(auth.email.toLowerCase())
      ? auth.email.toLowerCase() === row.email.toLowerCase()
        ? "csv_email"
        : "phone_derived_email"
      : "auth_email";

  if (profile && roleBlocksCleanerLink(profile.role)) {
    return finalize({
      rowNumber: row.rowNumber,
      legacyId: row.legacyId,
      fullName: row.fullName,
      csvEmail: row.email,
      phoneE164: row.phoneE164,
      legacyAuthUserId: row.authUserId,
      currentShaleanAuthEmail,
      linkageStatus: "duplicate_conflict",
      currentProfileId: profile.id,
      currentAuthEmail: auth.email,
      currentProfileRole: profile.role,
      existingCleanerId: null,
      matchMethod,
      matchNotes: `Auth profile has role=${profile.role}; cannot auto-link as cleaner.`,
    });
  }

  const existingCleaner = cleanerForProfile(snapshot, auth.id);
  if (existingCleaner) {
    return finalize({
      rowNumber: row.rowNumber,
      legacyId: row.legacyId,
      fullName: row.fullName,
      csvEmail: row.email,
      phoneE164: row.phoneE164,
      legacyAuthUserId: row.authUserId,
      currentShaleanAuthEmail,
      linkageStatus: "already_imported",
      currentProfileId: auth.id,
      currentAuthEmail: auth.email,
      currentProfileRole: profile?.role ?? "cleaner",
      existingCleanerId: existingCleaner.id,
      matchMethod,
      matchNotes: `Cleaner row exists for profile (cleaner_id=${existingCleaner.id}).`,
    });
  }

  return finalize({
    rowNumber: row.rowNumber,
    legacyId: row.legacyId,
    fullName: row.fullName,
    csvEmail: row.email,
    phoneE164: row.phoneE164,
    legacyAuthUserId: row.authUserId,
    currentShaleanAuthEmail,
    linkageStatus: "matched_ready",
    currentProfileId: auth.id,
    currentAuthEmail: auth.email,
    currentProfileRole: profile?.role ?? null,
    existingCleanerId: null,
    matchMethod,
    matchNotes: profile
      ? "Auth and profile exist; safe to import cleaner row + child profile data."
      : "Auth exists without profile row; import will upsert profile (role=cleaner) then cleaners.",
  });
}

function finalize(
  partial: Omit<LinkingRowResult, "recommendedAction" | "importBlocked">,
): LinkingRowResult {
  const importBlocked =
    partial.linkageStatus !== "matched_ready" && partial.linkageStatus !== "already_imported";
  const withFlags: LinkingRowResult = {
    ...partial,
    recommendedAction: "",
    importBlocked,
  };
  return {
    ...withFlags,
    recommendedAction: buildRecommendedAction(withFlags),
  };
}

export function analyzeAllCleanerAuthLinks(
  csvRows: CsvCleanerRow[],
  snapshot: DbSnapshot,
): { results: LinkingRowResult[]; invalidRows: Array<{ rowNumber: number; message: string }> } {
  const results: LinkingRowResult[] = [];
  const invalidRows: Array<{ rowNumber: number; message: string }> = [];

  for (let i = 0; i < csvRows.length; i += 1) {
    const rowNumber = i + 2;
    const normalized = normalizeCleanerRow(csvRows[i]!, rowNumber);
    if (!normalized.ok) {
      const message = normalized.issues.map((x) => x.message).join("; ");
      invalidRows.push({ rowNumber, message });
      results.push(
        finalize({
          rowNumber,
          legacyId: csvRows[i]?.id ?? null,
          fullName: csvRows[i]?.full_name ?? "",
          csvEmail: csvRows[i]?.email ?? "",
          phoneE164: normalizeZaMobilePhone(csvRows[i]?.phone ?? csvRows[i]?.phone_number ?? "") ?? "",
          legacyAuthUserId: csvRows[i]?.auth_user_id ?? null,
          currentShaleanAuthEmail: null,
          linkageStatus: "cannot_map",
          currentProfileId: null,
          currentAuthEmail: null,
          currentProfileRole: null,
          existingCleanerId: null,
          matchMethod: "invalid_csv",
          matchNotes: message,
        }),
      );
      continue;
    }

    results.push(analyzeCleanerAuthLink(normalized.value, snapshot));
  }

  return { results, invalidRows };
}

export function summarizeAuthLinking(results: LinkingRowResult[]): LinkingSummary {
  const matchedReady = results.filter((r) => r.linkageStatus === "matched_ready").length;
  const needsAuthInvite = results.filter((r) => r.linkageStatus === "needs_auth_invite").length;
  const duplicateConflict = results.filter((r) => r.linkageStatus === "duplicate_conflict").length;
  const cannotMap = results.filter((r) => r.linkageStatus === "cannot_map").length;
  const alreadyImported = results.filter((r) => r.linkageStatus === "already_imported").length;
  const blockedRowCount = results.filter((r) => r.importBlocked).length;

  const importBlocked = results.some(
    (r) => r.linkageStatus === "matched_ready" && !r.currentProfileId,
  ) || needsAuthInvite > 0 || duplicateConflict > 0 || cannotMap > 0;

  return {
    totalRows: results.length,
    matchedReady,
    needsAuthInvite,
    duplicateConflict,
    cannotMap,
    alreadyImported,
    importBlocked,
    blockedRowCount,
  };
}

export function linkingResultsToCsv(results: LinkingRowResult[]): string {
  const headers = [
    "row_number",
    "legacy_id",
    "full_name",
    "csv_email",
    "phone_e164",
    "legacy_auth_user_id",
    "current_shalean_auth_email",
    "linkage_status",
    "current_profile_id",
    "current_auth_email",
    "current_profile_role",
    "existing_cleaner_id",
    "match_method",
    "match_notes",
    "recommended_action",
    "import_blocked",
  ];

  const escape = (value: string | number | null | undefined): string => {
    const text = value == null ? "" : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const lines = [
    headers.join(","),
    ...results.map((r) =>
      [
        r.rowNumber,
        r.legacyId,
        r.fullName,
        r.csvEmail,
        r.phoneE164,
        r.legacyAuthUserId,
        r.currentShaleanAuthEmail,
        r.linkageStatus,
        r.currentProfileId,
        r.currentAuthEmail,
        r.currentProfileRole,
        r.existingCleanerId,
        r.matchMethod,
        r.matchNotes,
        r.recommendedAction,
        r.importBlocked ? "yes" : "no",
      ]
        .map(escape)
        .join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}

export function parseCsvForLinking(csvText: string): CsvCleanerRow[] {
  return parseCsv(csvText);
}

export function buildApprovedManifestRows(
  results: LinkingRowResult[],
): Array<{ rowNumber: number; profileId: string }> {
  return results
    .filter((r) => r.linkageStatus === "matched_ready" && r.currentProfileId)
    .map((r) => ({ rowNumber: r.rowNumber, profileId: r.currentProfileId! }));
}
