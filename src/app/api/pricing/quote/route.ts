import { NextResponse } from "next/server";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { parsePricingInputFromJson } from "@/features/pricing/server/parseQuoteRequest";

/**
 * Stateless pricing quote for the booking wizard.
 * Does not create bookings, payments, or lifecycle mutations.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_JSON", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Body must be a JSON object." },
      { status: 400 },
    );
  }

  const parsed = parsePricingInputFromJson(body as Record<string, unknown>);
  if ("error" in parsed) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: parsed.error },
      { status: 400 },
    );
  }

  const result = calculateQuote(parsed);
  if (!result.ok) {
    const status =
      result.code === "UNKNOWN_SERVICE" ||
      result.code === "UNKNOWN_ADDON" ||
      result.code === "INVALID_FREQUENCY"
        ? 400
        : 422;
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    quote: result.breakdown,
  });
}
