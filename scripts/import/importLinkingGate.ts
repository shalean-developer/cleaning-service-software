/**
 * Gates cleaner import on auth-linking report approval (read-only CSV parse).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsv } from "./importCleanersLib";

export const LINKING_REPORT_CSV_PATH = resolve(
  process.cwd(),
  "cleaner-auth-linking-report.csv",
);

export type LinkingReportRow = {
  rowNumber: number;
  linkageStatus: string;
  currentProfileId: string | null;
  fullName: string;
  importBlocked: boolean;
};

export type LinkingGateResult =
  | { ok: true; byRowNumber: Map<number, LinkingReportRow> }
  | { ok: false; message: string };

function parseBoolCsv(value: string): boolean {
  return value.trim().toLowerCase() === "yes" || value === "true";
}

export function loadLinkingReport(csvPath = LINKING_REPORT_CSV_PATH): LinkingGateResult {
  if (!existsSync(csvPath)) {
    return {
      ok: false,
      message: `Missing ${csvPath}. Run: npm run import:cleaners:link-auth`,
    };
  }

  const text = readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  const byRowNumber = new Map<number, LinkingReportRow>();

  for (const row of rows) {
    const rowNumber = Number(row.row_number);
    if (!Number.isInteger(rowNumber)) continue;
    byRowNumber.set(rowNumber, {
      rowNumber,
      linkageStatus: row.linkage_status ?? "",
      currentProfileId: row.current_profile_id?.trim() || null,
      fullName: row.full_name ?? "",
      importBlocked: parseBoolCsv(row.import_blocked ?? "yes"),
    });
  }

  if (byRowNumber.size === 0) {
    return { ok: false, message: "Linking report CSV has no data rows." };
  }

  return { ok: true, byRowNumber };
}

export function assertImportAllowed(
  linking: Map<number, LinkingReportRow>,
  importRowNumbers: number[],
): { ok: true } | { ok: false; message: string; blocked: LinkingReportRow[] } {
  const blocked: LinkingReportRow[] = [];

  for (const rowNumber of importRowNumbers) {
    const link = linking.get(rowNumber);
    if (!link) {
      return {
        ok: false,
        message: `Row ${rowNumber} missing from linking report. Re-run import:cleaners:link-auth.`,
        blocked: [],
      };
    }

    if (link.linkageStatus === "already_imported") continue;

    if (link.linkageStatus !== "matched_ready" || !link.currentProfileId) {
      blocked.push(link);
    }
  }

  for (const link of linking.values()) {
    if (
      link.linkageStatus !== "matched_ready" &&
      link.linkageStatus !== "already_imported"
    ) {
      if (!blocked.some((b) => b.rowNumber === link.rowNumber)) {
        blocked.push(link);
      }
    }
  }

  if (blocked.length > 0) {
    const names = blocked
      .slice(0, 5)
      .map((b) => `${b.fullName} (row ${b.rowNumber}: ${b.linkageStatus})`)
      .join("; ");
    return {
      ok: false,
      message: `Import blocked: ${blocked.length} row(s) lack a safe profile_id. Examples: ${names}`,
      blocked,
    };
  }

  return { ok: true };
}
