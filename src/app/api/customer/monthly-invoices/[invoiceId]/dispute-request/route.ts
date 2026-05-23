import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { submitCustomerMonthlyInvoiceDisputeForUser } from "@/features/monthly-billing/server/submitCustomerMonthlyInvoiceDisputeRequest";
import { isUuid } from "@/lib/validation/uuid";

type RouteContext = { params: Promise<{ invoiceId: string }> };

const bodySchema = z.object({
  message: z.string().trim().min(10).max(2000),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["customer"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { invoiceId } = await context.params;
  if (!isUuid(invoiceId)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "invoiceId must be a valid UUID." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const result = await submitCustomerMonthlyInvoiceDisputeForUser(user, {
    invoiceId,
    message: parsed.data.message,
    idempotencyKey: parsed.data.idempotencyKey,
  });

  if (!result.ok) {
    const status =
      result.code === "INVOICE_NOT_FOUND"
        ? 404
        : result.code === "FORBIDDEN"
          ? 403
          : result.code === "INVALID_STATUS"
            ? 422
            : 500;
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status },
    );
  }

  return NextResponse.json({ ok: true, batchId: result.batchId });
}
