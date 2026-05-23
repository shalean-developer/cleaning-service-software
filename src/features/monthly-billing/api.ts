import type { CustomerBillingAccount } from "./server/monthlyBillingTypes";

type MutationError = { ok: false; error: string; message: string };

function toMutationError(json: unknown): MutationError {
  if (json != null && typeof json === "object") {
    const row = json as Record<string, unknown>;
    return {
      ok: false,
      error: typeof row.error === "string" ? row.error : "REQUEST_FAILED",
      message: typeof row.message === "string" ? row.message : "Request failed.",
    };
  }
  return { ok: false, error: "REQUEST_FAILED", message: "Request failed." };
}

async function postMonthlyBillingMutation(
  customerId: string,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; account: CustomerBillingAccount; idempotent: boolean } | MutationError> {
  const response = await fetch(
    `/api/admin/monthly-billing/accounts/${encodeURIComponent(customerId)}/${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const json = (await response.json()) as
    | { ok: true; account: CustomerBillingAccount; idempotent: boolean }
    | MutationError;
  if (!response.ok || !json.ok) {
    return toMutationError(json);
  }
  return json;
}

export function enableCustomerMonthlyBilling(
  customerId: string,
  body: {
    billingEmail: string;
    billingTerms: string;
    approvalReason: string;
    idempotencyKey: string;
    zohoCustomerId?: string;
    createZohoCustomer?: boolean;
    monthEndBillingConfirmed: true;
  },
) {
  return postMonthlyBillingMutation(customerId, "enable", body);
}

export function disableCustomerMonthlyBilling(
  customerId: string,
  body: { reason: string; idempotencyKey: string },
) {
  return postMonthlyBillingMutation(customerId, "disable", body);
}

export function updateCustomerMonthlyBillingTerms(
  customerId: string,
  body: {
    billingEmail: string;
    billingTerms: string;
    reason: string;
    idempotencyKey: string;
  },
) {
  return postMonthlyBillingMutation(customerId, "terms", body);
}

export function linkCustomerMonthlyBillingZohoCustomer(
  customerId: string,
  body: { zohoCustomerId: string; reason: string; idempotencyKey: string },
) {
  return postMonthlyBillingMutation(customerId, "zoho-customer", body);
}

export async function generateZohoMonthlyInvoiceForBatch(
  batchId: string,
  body: {
    idempotencyKey: string;
    reason?: string;
    confirmReviewed: true;
  },
): Promise<
  | {
      ok: true;
      invoice: {
        batchId: string;
        zohoInvoiceId: string;
        zohoInvoiceNumber: string | null;
        status: string;
        totalCents: number;
        itemCount: number;
      };
      idempotent: boolean;
    }
  | MutationError
> {
  const response = await fetch(
    `/api/admin/monthly-billing/batches/${encodeURIComponent(batchId)}/generate-zoho-invoice`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const json = (await response.json()) as
    | {
        ok: true;
        invoice: {
          batchId: string;
          zohoInvoiceId: string;
          zohoInvoiceNumber: string | null;
          status: string;
          totalCents: number;
          itemCount: number;
        };
        idempotent: boolean;
      }
    | MutationError;
  if (!response.ok || !json.ok) {
    return toMutationError(json);
  }
  return json;
}

export async function syncMonthlyInvoicePaymentStatusForBatch(
  batchId: string,
  body: {
    idempotencyKey: string;
    reason?: string;
    confirmSync: true;
  },
): Promise<
  | {
      ok: true;
      sync: {
        batchId: string;
        previousStatus: string;
        currentStatus: string;
        source: string;
        paidAt: string | null;
        itemCount: number;
      };
    }
  | MutationError
> {
  const response = await fetch(
    `/api/admin/monthly-billing/batches/${encodeURIComponent(batchId)}/sync-payment-status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const json = (await response.json()) as
    | {
        ok: true;
        sync: {
          batchId: string;
          previousStatus: string;
          currentStatus: string;
          source: string;
          paidAt: string | null;
          itemCount: number;
        };
      }
    | MutationError;
  if (!response.ok || !json.ok) {
    return toMutationError(json);
  }
  return json;
}

async function postMonthlyBillingBatchMutation(
  batchId: string,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } & Record<string, unknown> | MutationError> {
  const response = await fetch(
    `/api/admin/monthly-billing/batches/${encodeURIComponent(batchId)}/${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const json = (await response.json()) as ({ ok: true } & Record<string, unknown>) | MutationError;
  if (!response.ok || !json.ok) {
    return toMutationError(json);
  }
  return json;
}

export async function sendMonthlyInvoiceForBatch(
  batchId: string,
  body: {
    idempotencyKey: string;
    reason?: string;
    confirmSend: true;
  },
) {
  return postMonthlyBillingBatchMutation(batchId, "send-invoice", body) as Promise<
    | {
        ok: true;
        send: {
          batchId: string;
          previousStatus: string;
          currentStatus: string;
          sentAt: string;
          paymentLink: string;
          notificationOutboxId: string;
        };
        idempotent: boolean;
      }
    | MutationError
  >;
}

export async function sendMonthlyInvoiceReminderForBatch(
  batchId: string,
  body: {
    idempotencyKey: string;
    reason?: string;
    confirmReminder: true;
  },
) {
  return postMonthlyBillingBatchMutation(batchId, "send-reminder", body) as Promise<
    | {
        ok: true;
        reminder: {
          batchId: string;
          status: string;
          reminderCount: number;
          lastReminderAt: string;
          paymentLink: string;
          notificationOutboxId: string;
        };
      }
    | MutationError
  >;
}

export async function markMonthlyInvoiceOverdueForBatch(
  batchId: string,
  body: {
    idempotencyKey: string;
    reason?: string;
    confirmOverdue: true;
    force?: boolean;
  },
) {
  return postMonthlyBillingBatchMutation(batchId, "mark-overdue", body) as Promise<
    | {
        ok: true;
        overdue: {
          batchId: string;
          previousStatus: string;
          currentStatus: string;
          dueDate: string | null;
        };
        idempotent: boolean;
      }
    | MutationError
  >;
}

export async function authorizeMonthlyAccountService(
  bookingId: string,
  body: {
    customerId: string;
    monthlyAccountId: string;
    reason: string;
    idempotencyKey: string;
    confirmMonthlyAccount: true;
    confirmElevatedExposure?: true;
  },
): Promise<
  | {
      ok: true;
      booking: { bookingId: string; status: string; customerId: string };
      authorization: { id: string; status: string; amountCents: number; authorizedAt: string };
      idempotent: boolean;
    }
  | MutationError
> {
  const response = await fetch(
    `/api/admin/monthly-billing/bookings/${encodeURIComponent(bookingId)}/authorize-service`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const json = (await response.json()) as
    | {
        ok: true;
        booking: { bookingId: string; status: string; customerId: string };
        authorization: { id: string; status: string; amountCents: number; authorizedAt: string };
        idempotent: boolean;
      }
    | MutationError;
  if (!response.ok || !json.ok) {
    return toMutationError(json);
  }
  return json;
}

export async function fetchMonthlyAccountAuthorizationContext(customerId: string) {
  const response = await fetch(
    `/api/admin/monthly-billing/accounts/${encodeURIComponent(customerId)}/authorization-context`,
  );
  const json = (await response.json()) as { ok: true; context: unknown } | MutationError;
  if (!response.ok || !json.ok) {
    return toMutationError(json);
  }
  return json;
}

export function updateMonthlyAccountGovernanceState(
  customerId: string,
  body: {
    governanceState: string;
    reason: string;
    idempotencyKey: string;
    confirmAction: true;
  },
) {
  return postMonthlyBillingMutation(customerId, "governance-state", body);
}

export function updateMonthlyAccountCreditLimit(
  customerId: string,
  body: {
    creditLimitCents: number | null;
    reason: string;
    idempotencyKey: string;
    confirmAction: true;
  },
) {
  return postMonthlyBillingMutation(customerId, "credit-limit", body);
}

export function grantMonthlyAccountTemporaryOverride(
  customerId: string,
  body: {
    manualOverrideUntil: string;
    reason: string;
    idempotencyKey: string;
    confirmAction: true;
  },
) {
  return postMonthlyBillingMutation(customerId, "temporary-override", body);
}

export function updateMonthlyAccountFinanceReview(
  customerId: string,
  body: {
    reason: string;
    idempotencyKey: string;
    confirmAction: true;
    reviewOwnerAdminId?: string | null;
    followUpDate?: string | null;
    reviewStatus?: "open" | "resolved" | "dismissed";
    resolution?: string | null;
  },
) {
  return postMonthlyBillingMutation(customerId, "finance-review", body);
}

export async function executeMonthlyGovernanceBulkAction(body: {
  action: "mark_finance_review" | "add_note" | "assign_review_owner";
  customerIds: string[];
  reason: string;
  idempotencyKey: string;
  confirmAction: true;
  reviewOwnerAdminId?: string | null;
  followUpDate?: string | null;
  noteContent?: string;
}): Promise<
  | { ok: true; result: { processed: number; failed: { customerId: string; message: string }[] } }
  | MutationError
> {
  const response = await fetch("/api/admin/monthly-billing/governance/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as
    | { ok: true; result: { processed: number; failed: { customerId: string; message: string }[] } }
    | MutationError;
  if (!response.ok || !json.ok) {
    return toMutationError(json);
  }
  return json;
}
