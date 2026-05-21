import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  customerRequestRecurringSeriesChange,
  type CustomerRecurringRequestType,
} from "@/features/recurring/server/recurringSeriesCommandService";

const VALID_TYPES = new Set<CustomerRecurringRequestType>(["pause", "cancel", "reschedule"]);

export async function POST(request: Request) {
  const user = await requireApiUser(["customer"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  let body: { seriesId?: string; requestType?: string; note?: string; confirm?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      {
        ok: false,
        error: "CONFIRMATION_REQUIRED",
        message: "Set confirm: true to submit this request.",
      },
      { status: 400 },
    );
  }

  if (typeof body.seriesId !== "string" || !body.seriesId.trim()) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "seriesId is required." },
      { status: 400 },
    );
  }

  const requestType = body.requestType as CustomerRecurringRequestType;
  if (!VALID_TYPES.has(requestType)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Invalid requestType." },
      { status: 400 },
    );
  }

  const result = await customerRequestRecurringSeriesChange(
    user,
    body.seriesId.trim(),
    requestType,
    typeof body.note === "string" ? body.note : undefined,
  );
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }
  return NextResponse.json({ ok: true, message: result.message });
}
