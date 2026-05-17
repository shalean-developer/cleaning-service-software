import { isOfferOpenForOps } from "./buildOfferExpiry";

export const DISPATCH_NOT_STARTED_REASON =
  "Paid but dispatch not started; assignment recovery pending.";

export function isDispatchNotStartedAttentionReason(
  reason: string | null | undefined,
): boolean {
  return typeof reason === "string" && reason.includes("dispatch not started");
}

type RecoveryBooking = {
  status: string;
  cleaner_id: string | null;
};

type RecoveryPayment = {
  status: string;
  updated_at: string;
  created_at: string;
};

type RecoveryOffer = {
  status: string;
  expires_at: string | null;
};

/**
 * True when a paid booking is still `confirmed` with no assignment progress
 * (no cleaner, no open/accepted offers) and past the post-payment grace window.
 */
export function isAssignmentRecoveryCandidate(input: {
  booking: RecoveryBooking;
  payments: readonly RecoveryPayment[];
  offers: readonly RecoveryOffer[];
  now?: Date;
  graceMinutes: number;
}): boolean {
  const { booking, payments, offers, graceMinutes } = input;
  const now = input.now ?? new Date();

  if (booking.status !== "confirmed") return false;
  if (booking.cleaner_id) return false;

  const paidPayment = payments.find((p) => p.status === "paid");
  if (!paidPayment) return false;

  const paidAtMs = new Date(paidPayment.updated_at || paidPayment.created_at).getTime();
  if (Number.isNaN(paidAtMs)) return false;
  if (now.getTime() - paidAtMs < graceMinutes * 60_000) return false;

  if (offers.some((o) => o.status === "accepted")) return false;
  if (offers.some((o) => isOfferOpenForOps(o, now))) return false;

  return true;
}
