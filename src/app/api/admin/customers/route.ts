import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createCustomer } from "@/features/customers/server/admin/createCustomer";
import { listAdminCustomers } from "@/features/customers/server/admin/adminCustomersReadModel";
import { mapCreateCustomerHttpStatus } from "@/features/customers/server/admin/mapCreateCustomerHttpStatus";
import { parseCreateCustomerBody } from "@/features/customers/server/admin/parseCreateCustomerBody";
import { parseAdminCustomersQueryParams } from "@/features/customers/server/admin/parseAdminCustomersQuery";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  let query;
  try {
    query = parseAdminCustomersQueryParams(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_QUERY",
          message: error.issues.map((issue) => issue.message).join("; "),
        },
        { status: 400 },
      );
    }
    throw error;
  }

  const result = await listAdminCustomers(user, query);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    customers: result.items,
    page: result.page,
    limit: result.limit,
    matchTotal: result.matchTotal,
    returnedCount: result.returnedCount,
    capped: result.capped,
  });
}

export async function POST(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
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

  const parsed = parseCreateCustomerBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.code, message: parsed.message },
      { status: mapCreateCustomerHttpStatus({ ok: false, code: parsed.code, message: parsed.message }) },
    );
  }

  const result = await createCustomer({
    adminProfileId: user.profileId,
    email: parsed.values.email,
    fullName: parsed.values.full_name,
    companyName: parsed.values.company_name,
    phone: parsed.values.phone,
    notes: parsed.values.notes,
    sendInvite: parsed.values.send_invite,
  });

  const status = mapCreateCustomerHttpStatus(result);
  if (result.ok) {
    return NextResponse.json({ ok: true, customer: result.customer }, { status });
  }

  return NextResponse.json(
    { ok: false, error: result.code, message: result.message },
    { status },
  );
}
