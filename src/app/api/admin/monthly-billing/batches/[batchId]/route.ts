import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadMonthlyInvoiceBatchReadModel } from "@/features/monthly-billing/server/monthlyInvoiceBatchReadModel";
import {
  MonthlyBillingValidationError,
  assertBatchIdParam,
} from "@/features/monthly-billing/server/parseMonthlyBillingQueryParams";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  try {
    const { batchId } = await context.params;
    assertBatchIdParam(batchId);

    const batch = await loadMonthlyInvoiceBatchReadModel(batchId);
    if (!batch) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND", message: "Invoice batch not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      readOnly: true,
      phase: 1,
      batch,
    });
  } catch (error) {
    if (error instanceof MonthlyBillingValidationError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "Could not load invoice batch." },
      { status: 500 },
    );
  }
}
