import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  buildZohoReplacementAuditExportFilename,
  zohoReplacementAuditToExport,
  type ZohoReplacementAuditExportFormat,
} from "@/features/zoho-replacement-audit/server/zohoReplacementAuditExport";
import { logZohoReplacementAuditEvent } from "@/features/zoho-replacement-audit/server/zohoReplacementAuditLogger";
import { loadZohoReplacementAuditForExport } from "@/features/zoho-replacement-audit/server/zohoReplacementAuditReadModel";

const ALLOWED_FORMATS = new Set<ZohoReplacementAuditExportFormat>([
  "csv",
  "json",
  "markdown",
  "md",
]);

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const url = new URL(request.url);
  const formatParam = url.searchParams.get("format")?.trim().toLowerCase() ?? "csv";
  const format = ALLOWED_FORMATS.has(formatParam as ZohoReplacementAuditExportFormat)
    ? (formatParam as ZohoReplacementAuditExportFormat)
    : "csv";

  try {
    const { audit } = await loadZohoReplacementAuditForExport();
    const { body, contentType } = zohoReplacementAuditToExport(audit, format);
    const filename = buildZohoReplacementAuditExportFilename(format);

    logZohoReplacementAuditEvent("zoho_replacement_audit_exported", {
      exportFormat: format,
      readinessScore: audit.summary.overallReadinessScore,
    });

    if (format === "json") {
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": contentType },
      });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    logZohoReplacementAuditEvent("zoho_replacement_audit_failed", { stage: "export" });
    return NextResponse.json(
      {
        ok: false,
        error: "EXPORT_FAILED",
        message: "Could not export Zoho replacement audit.",
      },
      { status: 500 },
    );
  }
}
