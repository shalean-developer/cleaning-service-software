import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadAdminPaymentMethodsList } from "@/features/zoho-invoice-payments/server/loadAdminPaymentMethodsList";
import { loadAdminZohoPaymentMethodsByEmail } from "@/features/zoho-invoice-payments/server/loadZohoInvoicePaymentMethodAdminSummary";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const url = new URL(request.url);
  const customerEmail = url.searchParams.get("customerEmail")?.trim();
  const statusParam = url.searchParams.get("status")?.trim();
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  const status =
    statusParam === "active" || statusParam === "revoked" || statusParam === "all"
      ? statusParam
      : customerEmail
        ? "all"
        : "active";

  if (customerEmail && !EMAIL_PATTERN.test(customerEmail)) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_EMAIL",
        message: "A valid customer email is required.",
      },
      { status: 400 },
    );
  }

  if (customerEmail) {
    const methods = await loadAdminZohoPaymentMethodsByEmail(customerEmail);
    return NextResponse.json({
      ok: true,
      customerEmail: customerEmail.toLowerCase(),
      methods,
    });
  }

  const result = await loadAdminPaymentMethodsList({
    status,
    limit: Number.isFinite(limit) ? limit : 50,
  });

  return NextResponse.json(result);
}
