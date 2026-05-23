import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadCustomerMonthlyInvoicesForUser } from "@/features/monthly-billing/server/customerMonthlyInvoicesReadModel";

export async function GET() {
  const user = await requireApiUser(["customer"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  try {
    const result = await loadCustomerMonthlyInvoicesForUser(user);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "LOAD_FAILED",
        message: "Could not load monthly invoices.",
      },
      { status: 500 },
    );
  }
}
