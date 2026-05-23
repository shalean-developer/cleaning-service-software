import type { Json, PaymentStatus } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  readAdminAssistPaymentLinkMetadata,
  readAdminAssistSupersededPaymentLinks,
} from "./adminAssistPaymentLinkMetadata";
import { isAdminAssistedBookingMetadata } from "./adminAssistMetadata";

export type AdminAssistPaidVia = "offline" | "paystack_link";

const POST_PAYMENT_STATUSES: readonly BookingStatus[] = [
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
];

const OFFLINE_PROVIDERS = new Set(["eft", "cash", "card_machine"]);

export function resolveAdminAssistPaidVia(input: {
  metadata: Json | null | undefined;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus | null;
  paymentProvider: string | null;
}): AdminAssistPaidVia | null {
  if (!isAdminAssistedBookingMetadata(input.metadata)) return null;
  if (input.paymentStatus !== "paid") return null;
  if (!POST_PAYMENT_STATUSES.includes(input.bookingStatus)) return null;

  const provider = input.paymentProvider?.trim().toLowerCase() ?? "";
  if (OFFLINE_PROVIDERS.has(provider)) return "offline";

  if (provider === "paystack") {
    const hadLink =
      readAdminAssistPaymentLinkMetadata(input.metadata) != null ||
      readAdminAssistSupersededPaymentLinks(input.metadata).length > 0;
    if (hadLink) return "paystack_link";
  }

  return null;
}
