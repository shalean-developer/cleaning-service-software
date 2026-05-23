import "server-only";

import type { PaystackChargeSuccess } from "./paystackTypes";
import type { AdminOfflinePaymentRail } from "@/features/bookings/server/admin/adminOfflinePaymentTypes";

export type BuildOfflinePaymentChargeInput = {
  rail: AdminOfflinePaymentRail;
  amountCents: number;
  currency: string;
  paidAt: string;
  idempotencyKey: string;
  eventId: string;
  adminProfileId: string;
  evidenceReference: string;
  providerReference: string;
  bankReference?: string | null;
  terminalReference?: string | null;
  receiptNumber?: string | null;
  notes?: string | null;
};

function offlineTransactionId(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

export function buildOfflinePaymentReference(
  rail: AdminOfflinePaymentRail,
  idempotencyKey: string,
): string {
  return `admin:offline:${rail}:${idempotencyKey.trim()}`;
}

export function buildOfflinePaymentChargeForFinalize(
  input: BuildOfflinePaymentChargeInput,
): PaystackChargeSuccess {
  const reference = buildOfflinePaymentReference(input.rail, input.idempotencyKey);
  const providerEventId = `admin:offline:${input.rail}:${input.eventId}`;

  return {
    reference,
    amountCents: input.amountCents,
    providerEventId,
    transactionId: offlineTransactionId(providerEventId),
    metadata: {
      source: "admin_offline_payment",
      adminProfileId: input.adminProfileId,
      evidenceReference: input.evidenceReference,
      rail: input.rail,
      providerReference: input.providerReference,
      paidAt: input.paidAt,
      currency: input.currency,
      bankReference: input.bankReference ?? null,
      terminalReference: input.terminalReference ?? null,
      receiptNumber: input.receiptNumber ?? null,
      notes: input.notes ?? null,
    },
  };
}
