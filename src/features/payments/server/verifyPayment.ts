import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { paystackVerifyTransaction } from "./paystackClient";
import { isPaystackEnabled } from "./paystackEnv";
import { mapPaystackVerifyData } from "./mapPaystackCharge";
import { processPaystackChargeSuccess } from "./upsertBookingFromPaystack";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { findPaymentByProviderRef } from "./paymentRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";

export type VerifyPaymentResult =
  | {
      ok: true;
      reference: string;
      bookingId: string;
      status: string;
      paid: boolean;
      idempotent: boolean;
      recoveredFromAlreadyFinalized?: boolean;
    }
  | {
      ok: false;
      code: string;
      message: string;
      status: number;
    };

export async function verifyPayment(
  user: CurrentUser | null,
  reference: string,
): Promise<VerifyPaymentResult> {
  if (!isPaystackEnabled()) {
    return {
      ok: false,
      code: "PAYSTACK_DISABLED",
      message: "Paystack is not enabled.",
      status: 503,
    };
  }

  const trimmed = reference.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "reference is required.",
      status: 400,
    };
  }

  if (user?.role === "customer") {
    const userClient = await createSupabaseServerClient();
    if (!userClient) {
      return {
        ok: false,
        code: "AUTH_NOT_CONFIGURED",
        message: "Supabase is not configured.",
        status: 503,
      };
    }

    const ctx = await resolveActorScope(userClient, user.profileId, user.role);
    const serviceClient = requireServiceRoleClient();
    const payment = await findPaymentByProviderRef(serviceClient, trimmed);
    if (!payment) {
      return {
        ok: false,
        code: "PAYMENT_NOT_FOUND",
        message: "Payment reference not found.",
        status: 404,
      };
    }

    const booking = await serviceClient
      .from("bookings")
      .select("customer_id")
      .eq("id", payment.booking_id)
      .maybeSingle();

    if (booking.error) {
      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: booking.error.message,
        status: 500,
      };
    }

    if (booking.data?.customer_id !== ctx.actingCustomerId) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Cannot verify another customer's payment.",
        status: 403,
      };
    }
  }

  const verified = await paystackVerifyTransaction(trimmed);
  const charge = mapPaystackVerifyData(verified.data);

  if (!charge) {
    return {
      ok: true,
      reference: trimmed,
      bookingId: "",
      status: verified.data.status,
      paid: false,
      idempotent: false,
    };
  }

  const finalized = await processPaystackChargeSuccess(charge, "verify");
  if (!finalized.ok) {
    return {
      ok: false,
      code: finalized.code,
      message: finalized.message,
      status: finalized.code === "AMOUNT_MISMATCH" ? 409 : 400,
    };
  }

  return {
    ok: true,
    reference: trimmed,
    bookingId: finalized.bookingId,
    status: finalized.status,
    paid: true,
    idempotent: finalized.idempotent,
    ...(finalized.recoveredFromAlreadyFinalized
      ? { recoveredFromAlreadyFinalized: true as const }
      : {}),
  };
}
