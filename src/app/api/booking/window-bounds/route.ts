import { NextResponse } from "next/server";
import {
  resolveBookingWindowBounds,
  resolveBookingWindowEnvStatus,
} from "@/features/booking-wizard/bookingWindowConfig";

/** Public read model so the booking wizard uses the same window as server lock validation. */
export async function GET() {
  const bounds = resolveBookingWindowBounds();
  const envStatus = resolveBookingWindowEnvStatus();

  return NextResponse.json({
    ok: true,
    minDate: bounds.minDate,
    maxDate: bounds.maxDate,
    maxAdvanceDays: bounds.maxAdvanceDays,
    extendedWindowEnabled: bounds.extendedWindowEnabled,
    envMismatchWarning: envStatus.mismatchWarning,
  });
}
