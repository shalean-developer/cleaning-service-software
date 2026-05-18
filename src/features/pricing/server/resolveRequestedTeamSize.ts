import type { PricingInput, ServiceSlug } from "./types";

/** NF-7B: only regular cleaning may request 2 cleaners; all other services force 1. */
export function resolveRequestedTeamSize(
  serviceSlug: ServiceSlug,
  requested: number | undefined,
): 1 | 2 {
  if (serviceSlug !== "regular-cleaning") return 1;
  if (requested === 2) return 2;
  return 1;
}

export function requestedTeamSizeForPricingInput(input: PricingInput): 1 | 2 {
  return resolveRequestedTeamSize(input.serviceSlug, input.requestedTeamSize);
}
