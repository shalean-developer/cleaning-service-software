import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getBookingCleaners } from "@/features/cleaners/server/getAvailableCleaners";
import { parseBookingCleanersRequest } from "@/features/cleaners/server/parseRequests";
import { readRequestParams } from "@/features/cleaners/server/readRequestParams";

export async function GET(request: Request) {
  return handleBookingCleaners(request);
}

export async function POST(request: Request) {
  return handleBookingCleaners(request);
}

async function handleBookingCleaners(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const params = await readRequestParams(request);
  const parsed = parseBookingCleanersRequest(params);
  if ("error" in parsed) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: parsed.error },
      { status: 400 },
    );
  }

  const result = await getBookingCleaners(user, parsed);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    cleaners: result.data.cleaners,
    bestAvailable: result.data.bestAvailable,
    selectedCleaner: result.data.selectedCleaner,
  });
}
