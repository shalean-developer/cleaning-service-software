import "server-only";

export type CorporateStatementLineType =
  | "invoice"
  | "payment"
  | "saved_card_payment"
  | "refund_credit";

export type CorporateStatementLineStatus =
  | "paid"
  | "outstanding"
  | "pending"
  | "credited"
  | "failed";

export type CorporateStatementStatusMapping = {
  type: CorporateStatementLineType;
  status: CorporateStatementLineStatus;
  debitCents: number;
  creditCents: number;
  description: string;
};

type ZohoInvoicePaymentStatus =
  | "initialized"
  | "pending_paystack"
  | "paid"
  | "failed"
  | "zoho_reconcile_pending"
  | "zoho_reconcile_failed"
  | "cancelled";

type AuthChargeStatus =
  | "initialized"
  | "submitted"
  | "pending_webhook"
  | "paid"
  | "failed"
  | "zoho_reconcile_pending"
  | "zoho_reconcile_failed";

type RefundSyncStatus = "pending" | "synced" | "failed";

type BookingPaymentStatus = "initialized" | "pending" | "paid" | "failed" | "refunded";

export function mapZohoInvoicePaymentToStatement(input: {
  invoiceNumber: string;
  amountCents: number;
  status: ZohoInvoicePaymentStatus;
  customerName: string | null;
}): CorporateStatementStatusMapping {
  const label = input.customerName?.trim() || "Invoice";
  const inv = input.invoiceNumber;

  if (input.status === "failed" || input.status === "cancelled") {
    return {
      type: "invoice",
      status: "failed",
      debitCents: 0,
      creditCents: 0,
      description: `${label} — ${inv} (failed)`,
    };
  }

  if (input.status === "pending_paystack" || input.status === "initialized") {
    return {
      type: "invoice",
      status: "outstanding",
      debitCents: input.amountCents,
      creditCents: 0,
      description: `Invoice ${inv} issued`,
    };
  }

  if (input.status === "zoho_reconcile_pending") {
    return {
      type: "payment",
      status: "pending",
      debitCents: 0,
      creditCents: input.amountCents,
      description: `Payment received for ${inv} (Zoho sync pending)`,
    };
  }

  if (input.status === "zoho_reconcile_failed") {
    return {
      type: "payment",
      status: "failed",
      debitCents: 0,
      creditCents: input.amountCents,
      description: `Payment received for ${inv} (Zoho sync failed)`,
    };
  }

  return {
    type: "payment",
    status: "paid",
    debitCents: 0,
    creditCents: input.amountCents,
    description: `Payment received for ${inv}`,
  };
}

export function mapSavedCardChargeToStatement(input: {
  invoiceNumber: string;
  amountCents: number;
  status: AuthChargeStatus;
}): CorporateStatementStatusMapping {
  const inv = input.invoiceNumber;

  if (input.status === "failed") {
    return {
      type: "invoice",
      status: "failed",
      debitCents: 0,
      creditCents: 0,
      description: `Saved-card charge for ${inv} (failed)`,
    };
  }

  if (
    input.status === "initialized" ||
    input.status === "submitted" ||
    input.status === "pending_webhook"
  ) {
    return {
      type: "invoice",
      status: "pending",
      debitCents: input.amountCents,
      creditCents: 0,
      description: `Saved-card charge pending for ${inv}`,
    };
  }

  if (input.status === "zoho_reconcile_pending") {
    return {
      type: "saved_card_payment",
      status: "pending",
      debitCents: 0,
      creditCents: input.amountCents,
      description: `Saved-card payment for ${inv} (Zoho sync pending)`,
    };
  }

  if (input.status === "zoho_reconcile_failed") {
    return {
      type: "saved_card_payment",
      status: "failed",
      debitCents: 0,
      creditCents: input.amountCents,
      description: `Saved-card payment for ${inv} (Zoho sync failed)`,
    };
  }

  return {
    type: "saved_card_payment",
    status: "paid",
    debitCents: 0,
    creditCents: input.amountCents,
    description: `Saved-card payment for ${inv}`,
  };
}

export function mapBookingPaymentToStatement(input: {
  bookingId: string;
  amountCents: number;
  status: BookingPaymentStatus;
  invoiceNumber: string | null;
}): CorporateStatementStatusMapping {
  const ref = input.invoiceNumber ? `invoice ${input.invoiceNumber}` : `booking ${input.bookingId.slice(0, 8)}`;

  if (input.status === "failed") {
    return {
      type: "payment",
      status: "failed",
      debitCents: 0,
      creditCents: 0,
      description: `Booking payment failed (${ref})`,
    };
  }

  if (input.status === "pending" || input.status === "initialized") {
    return {
      type: "invoice",
      status: "pending",
      debitCents: input.amountCents,
      creditCents: 0,
      description: `Booking charge pending (${ref})`,
    };
  }

  if (input.status === "refunded") {
    return {
      type: "refund_credit",
      status: "credited",
      debitCents: 0,
      creditCents: input.amountCents,
      description: `Booking refund (${ref})`,
    };
  }

  return {
    type: "payment",
    status: "paid",
    debitCents: 0,
    creditCents: input.amountCents,
    description: `Booking payment received (${ref})`,
  };
}

export function mapRefundCreditToStatement(input: {
  invoiceNumber: string | null;
  bookingId: string | null;
  amountCents: number;
  syncStatus: RefundSyncStatus;
}): CorporateStatementStatusMapping {
  const ref = input.invoiceNumber
    ? `invoice ${input.invoiceNumber}`
    : input.bookingId
      ? `booking ${input.bookingId.slice(0, 8)}`
      : "credit note";

  if (input.syncStatus === "failed") {
    return {
      type: "refund_credit",
      status: "failed",
      debitCents: 0,
      creditCents: 0,
      description: `Refund/credit failed (${ref})`,
    };
  }

  if (input.syncStatus === "pending") {
    return {
      type: "refund_credit",
      status: "pending",
      debitCents: 0,
      creditCents: input.amountCents,
      description: `Refund/credit pending (${ref})`,
    };
  }

  return {
    type: "refund_credit",
    status: "credited",
    debitCents: 0,
    creditCents: input.amountCents,
    description: `Refund/credit note (${ref})`,
  };
}
