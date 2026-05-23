import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadZohoReplacementAudit } from "@/features/zoho-replacement-audit/server/zohoReplacementAuditReadModel";

export async function GET() {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  try {
    const { audit } = await loadZohoReplacementAudit();
    return NextResponse.json({ ok: true, audit });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Could not load Zoho replacement audit.",
      },
      { status: 500 },
    );
  }
}
