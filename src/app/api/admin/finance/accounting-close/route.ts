import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadAccountingClose } from "@/features/accounting-close/server/accountingCloseReadModel";
import { parseAccountingCloseQueryParams } from "@/features/accounting-close/server/parseAccountingCloseQueryParams";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const filters = parseAccountingCloseQueryParams(new URL(request.url).searchParams);

  try {
    const result = await loadAccountingClose(filters);
    return NextResponse.json({ ok: true, summary: result.summary, items: result.items });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Could not load accounting close data.",
      },
      { status: 500 },
    );
  }
}
