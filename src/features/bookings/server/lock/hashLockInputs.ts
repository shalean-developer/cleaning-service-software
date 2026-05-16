import { createHash } from "node:crypto";
import type { BookingLockInput } from "./types";

/** Stable hash of lock inputs for idempotent reuse vs mismatch detection. */
export function hashLockInputs(input: BookingLockInput): string {
  const canonical = {
    pricingInput: input.pricingInput,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    areaSlug: input.areaSlug,
    cleanerPreference: input.cleanerPreference,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
