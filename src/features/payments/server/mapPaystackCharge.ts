import type {
  PaystackChargeFailure,
  PaystackChargeSuccess,
  PaystackVerifyData,
  PaystackWebhookEvent,
} from "./paystackTypes";

function isSuccessfulPaystackStatus(status: string): boolean {
  return status === "success";
}

export function mapPaystackVerifyData(data: PaystackVerifyData): PaystackChargeSuccess | null {
  if (!isSuccessfulPaystackStatus(data.status)) return null;

  return {
    reference: data.reference,
    amountCents: data.amount,
    providerEventId: `paystack:txn:${data.id}`,
    transactionId: data.id,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
  };
}

export function mapPaystackWebhookChargeSuccess(
  event: PaystackWebhookEvent,
): PaystackChargeSuccess | null {
  if (event.event !== "charge.success") return null;
  return mapPaystackVerifyData(event.data);
}

export function paystackFinalizeIdempotencyKey(charge: PaystackChargeSuccess): string {
  return charge.providerEventId;
}

function isFailedPaystackStatus(status: string): boolean {
  return status === "failed";
}

export function mapPaystackWebhookChargeFailed(
  event: PaystackWebhookEvent,
): PaystackChargeFailure | null {
  if (event.event !== "charge.failed") return null;
  return mapPaystackFailedWebhookData(event.data);
}

export function mapPaystackFailedWebhookData(
  data: PaystackVerifyData & { gateway_response?: string },
): PaystackChargeFailure | null {
  if (isSuccessfulPaystackStatus(data.status)) return null;
  if (!isFailedPaystackStatus(data.status)) {
    return null;
  }
  const reference = data.reference?.trim();
  if (!reference || typeof data.id !== "number" || !Number.isFinite(data.id)) {
    return null;
  }

  return {
    reference,
    amountCents: data.amount,
    providerEventId: `paystack:txn:${data.id}`,
    transactionId: data.id,
    paystackStatus: data.status,
    gatewayResponse: data.gateway_response,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
  };
}

export function paystackFailureCommandIdempotencyKey(charge: PaystackChargeFailure): string {
  return `paystack:failed:${charge.transactionId}`;
}
