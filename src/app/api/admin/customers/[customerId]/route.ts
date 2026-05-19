import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminCustomerDetail } from "@/features/customers/server/admin/adminCustomersReadModel";
import { mapUpdateCustomerHttpStatus } from "@/features/customers/server/admin/mapUpdateCustomerHttpStatus";
import { parseUpdateCustomerBody } from "@/features/customers/server/admin/parseUpdateCustomerBody";
import { updateCustomer } from "@/features/customers/server/admin/updateCustomer";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

const customerIdSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { customerId: rawCustomerId } = await context.params;
  const parsed = customerIdSchema.safeParse(rawCustomerId);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_CUSTOMER_ID", message: "customerId must be a valid UUID." },
      { status: 400 },
    );
  }

  const result = await getAdminCustomerDetail(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    customer: result.detail,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { customerId: rawCustomerId } = await context.params;
  const parsedId = customerIdSchema.safeParse(rawCustomerId);
  if (!parsedId.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_CUSTOMER_ID", message: "customerId must be a valid UUID." },
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

  const parsed = parseUpdateCustomerBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.code, message: parsed.message },
      {
        status: mapUpdateCustomerHttpStatus({
          ok: false,
          code: parsed.code,
          message: parsed.message,
        }),
      },
    );
  }

  const result = await updateCustomer({
    customerId: parsedId.data,
    adminProfileId: user.profileId,
    patch: parsed.patch,
  });

  const status = mapUpdateCustomerHttpStatus(result);
  if (result.ok) {
    return NextResponse.json({ ok: true, customer: result.customer }, { status });
  }

  return NextResponse.json(
    { ok: false, error: result.code, message: result.message },
    { status },
  );
}
