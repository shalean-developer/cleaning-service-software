"use client";

import { useEffect, useState } from "react";
import { fetchAdminCustomerById } from "./adminCustomerPrefill";
import type { AdminBookingWizardFormState } from "./draftFormState";

export function useAdminCustomerPrefill(
  initialCustomerId: string | null | undefined,
  onFormChange: (patch: Partial<AdminBookingWizardFormState>) => void,
) {
  const [loading, setLoading] = useState(Boolean(initialCustomerId?.trim()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const customerId = initialCustomerId?.trim();
    if (!customerId) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchAdminCustomerById(customerId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }
      onFormChange({
        customerId: result.customer.customerId,
        selectedCustomer: result.customer,
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [initialCustomerId, onFormChange]);

  return { loading, error };
}
