import type { PricingBreakdown } from "@/features/pricing/server/types";
import type { AdminBookingWizardFormState } from "./draftFormState";
import { buildAdminDraftPricingInput } from "./draftFormState";

type QuoteResponse =
  | { ok: true; quote: PricingBreakdown }
  | { ok: false; error: string; message?: string };

export async function fetchAdminDraftPricingQuote(
  form: AdminBookingWizardFormState,
): Promise<{ ok: true; quote: PricingBreakdown } | { ok: false; message: string }> {
  const input = buildAdminDraftPricingInput(form);
  if (!input) {
    return { ok: false, message: "Select a service before requesting a quote." };
  }

  const response = await fetch("/api/pricing/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const json = (await response.json()) as QuoteResponse;
  if (!response.ok || !json.ok || !("quote" in json)) {
    return {
      ok: false,
      message: "message" in json && json.message ? json.message : "Could not load pricing quote.",
    };
  }

  return { ok: true, quote: json.quote };
}

export function formatAdminQuoteZar(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
