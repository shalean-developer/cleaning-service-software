import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { adminChargeZohoInvoiceSavedMethod } from "@/features/zoho-invoice-payments/server/adminChargeZohoInvoiceSavedMethod";

type ChargeSavedCardBody = {
  invoiceNumber?: string;
  paymentMethodId?: string;
  reason?: string;
  confirmPhrase?: string;
};

export async function POST(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  let body: ChargeSavedCardBody;
  try {
    body = (await request.json()) as ChargeSavedCardBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const result = await adminChargeZohoInvoiceSavedMethod({
    adminProfileId: user.profileId,
    invoiceNumber: body.invoiceNumber ?? "",
    paymentMethodId: body.paymentMethodId ?? "",
    reason: body.reason ?? "",
    confirmPhrase: body.confirmPhrase ?? "",
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result);
}
