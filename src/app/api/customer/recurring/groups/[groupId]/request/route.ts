import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  customerRequestRecurringGroupChange,
  type CustomerGroupRecurringRequestType,
} from "@/features/recurring/server/recurringGroupRequestService";

const VALID_TYPES = new Set<CustomerGroupRecurringRequestType>([
  "pause_group",
  "cancel_group",
  "reschedule_group",
  "pause_weekday",
  "cancel_weekday",
  "reschedule_weekday",
]);

type RouteContext = { params: Promise<{ groupId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["customer"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { groupId } = await context.params;

  let body: {
    requestType?: string;
    note?: string;
    targetWeekday?: number;
    targetSeriesId?: string;
    requestedDateTimeIso?: string;
    confirm?: boolean;
  };
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

  const requestType = body.requestType as CustomerGroupRecurringRequestType;
  if (!VALID_TYPES.has(requestType)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Invalid requestType." },
      { status: 400 },
    );
  }

  const result = await customerRequestRecurringGroupChange(user, groupId.trim(), {
    requestType,
    note: typeof body.note === "string" ? body.note : undefined,
    targetWeekday:
      typeof body.targetWeekday === "number" ? body.targetWeekday : undefined,
    targetSeriesId:
      typeof body.targetSeriesId === "string" ? body.targetSeriesId : undefined,
    requestedDateTimeIso:
      typeof body.requestedDateTimeIso === "string"
        ? body.requestedDateTimeIso
        : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }
  return NextResponse.json({ ok: true, message: result.message });
}
