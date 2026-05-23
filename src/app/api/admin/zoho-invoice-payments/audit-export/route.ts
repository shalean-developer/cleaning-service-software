import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  exportZohoInvoicePaymentAudit,
  zohoPaymentAuditRowsToCsv,
} from "@/features/zoho-invoice-payments/server/loadZohoPaymentGovernance";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const format = new URL(request.url).searchParams.get("format")?.trim().toLowerCase() ?? "csv";
  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  try {
    const { rows } = await exportZohoInvoicePaymentAudit(
      Number.isFinite(limit) ? limit : undefined,
    );

    if (format === "json") {
      return NextResponse.json({ ok: true, rows });
    }

    const csv = zohoPaymentAuditRowsToCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="zoho-payment-audit.csv"`,
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "EXPORT_FAILED",
        message: "Could not export payment audit data.",
      },
      { status: 500 },
    );
  }
}
