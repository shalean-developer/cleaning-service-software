import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadCustomerPaymentMethods } from "@/features/zoho-invoice-payments/server/loadCustomerPaymentMethods";
import { requireZohoSavedMethodsEnabled } from "@/features/zoho-invoice-payments/server/zohoPaymentLaunchGuard";

export async function GET() {
  const user = await requireApiUser(["customer"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const savedMethodsGate = requireZohoSavedMethodsEnabled();
  if (!savedMethodsGate.ok) {
    return NextResponse.json(
      { ok: false, error: savedMethodsGate.code, message: savedMethodsGate.message },
      { status: savedMethodsGate.status },
    );
  }

  const customerEmail = user.authUser.email?.trim();
  if (!customerEmail) {
    return NextResponse.json(
      {
        ok: false,
        error: "MISSING_EMAIL",
        message: "Your account does not have an email address.",
      },
      { status: 400 },
    );
  }

  const result = await loadCustomerPaymentMethods(customerEmail);
  return NextResponse.json({ ok: true, ...result });
}
