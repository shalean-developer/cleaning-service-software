import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadCorporateStatement } from "@/features/corporate-statements/server/corporateStatementReadModel";
import {
  CorporateStatementValidationError,
  parseCorporateStatementQueryParams,
} from "@/features/corporate-statements/server/parseCorporateStatementQueryParams";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  try {
    const filters = parseCorporateStatementQueryParams(new URL(request.url).searchParams);
    const result = await loadCorporateStatement(filters);
    return NextResponse.json({
      ok: true,
      summary: result.summary,
      items: result.items,
      openingBalanceNote: result.openingBalanceNote,
    });
  } catch (error) {
    if (error instanceof CorporateStatementValidationError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Could not load corporate statement.",
      },
      { status: 500 },
    );
  }
}
