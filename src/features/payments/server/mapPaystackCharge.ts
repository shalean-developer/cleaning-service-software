import type { PaystackChargeSuccess, PaystackVerifyData, PaystackWebhookEvent } from "./paystackTypes";

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
