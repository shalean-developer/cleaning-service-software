"use client";

import { useEffect, useState } from "react";
import type { PricingBreakdown } from "@/features/pricing/server/types";
import type { AdminBookingWizardFormState } from "./draftFormState";
import { buildAdminDraftPricingInput } from "./adminPricingInput";
import { fetchAdminDraftPricingQuote } from "./pricingApi";

export function useAdminBookingQuote(form: AdminBookingWizardFormState) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<PricingBreakdown | null>(null);

  const pricingInput = buildAdminDraftPricingInput(form);
  const pricingKey = pricingInput ? JSON.stringify(pricingInput) : "";

  useEffect(() => {
    if (!pricingKey) {
      setQuote(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchAdminDraftPricingQuote(form).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setQuote(null);
        setError(result.message);
        return;
      }
      setQuote(result.quote);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [form, pricingKey]);

  return { quote, loading, error };
}
