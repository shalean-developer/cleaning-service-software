import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAvailableCleaners } from "@/features/cleaners/server/getAvailableCleaners";
import { parseAvailableRequest } from "@/features/cleaners/server/parseRequests";
import { readRequestParams } from "@/features/cleaners/server/readRequestParams";

export async function GET(request: Request) {
  return handleAvailable(request);
}

export async function POST(request: Request) {
  return handleAvailable(request);
}

async function handleAvailable(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const params = await readRequestParams(request);
  const parsed = parseAvailableRequest(params);
  if ("error" in parsed) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: parsed.error },
      { status: 400 },
    );
  }

  const result = await getAvailableCleaners(user, parsed);
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
  });
}
