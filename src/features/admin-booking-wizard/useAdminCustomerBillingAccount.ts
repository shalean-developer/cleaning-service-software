"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_ADMIN_WIZARD_BILLING_MODE,
  isCustomerEligibleForMonthlyAccountWizard,
} from "./adminBillingMode";
import { fetchAdminCustomerBillingAccount } from "./adminCustomerBillingApi";
import type { AdminBookingWizardFormState } from "./draftFormState";

export function useAdminCustomerBillingAccount(
  customerId: string,
  billingMode: AdminBookingWizardFormState["billingMode"],
  monthlyBillingEnabled: boolean,
  onFormChange: (patch: Partial<AdminBookingWizardFormState>) => void,
): {
  loading: boolean;
  error: string | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const billingModeRef = useRef(billingMode);
  billingModeRef.current = billingMode;

  useEffect(() => {
    const trimmed = customerId.trim();
    if (!trimmed) {
      onFormChange({
        customerBillingAccount: null,
        billingModeResetMessage: null,
      });
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdminCustomerBillingAccount(trimmed);
        if (cancelled) return;

        if (!result.ok) {
          setError(result.message);
          onFormChange({
            customerBillingAccount: null,
            billingModeResetMessage: null,
          });
          return;
        }

        const snapshot = result.snapshot;
        const patch: Partial<AdminBookingWizardFormState> = {
          customerBillingAccount: snapshot,
        };

        if (
          billingModeRef.current === "monthly_account" &&
          !isCustomerEligibleForMonthlyAccountWizard(snapshot, monthlyBillingEnabled)
        ) {
          patch.billingMode = DEFAULT_ADMIN_WIZARD_BILLING_MODE;
          patch.billingModeResetMessage =
            "Monthly account is not available for this customer. Billing mode reset to Paystack payment link.";
        }

        onFormChange(patch);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [customerId, monthlyBillingEnabled, onFormChange]);

  return { loading, error };
}
