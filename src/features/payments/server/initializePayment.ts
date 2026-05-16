import "server-only";

import {
  assertActiveBookingLock,
  assertBookingMatchesLock,
} from "@/features/bookings/server/lock/assertActiveLock";
import { isBookingLockRequired } from "@/features/bookings/server/lock/constants";
import { markLockConsumed } from "@/features/bookings/server/lock/lockRepository";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import type { BookingCommandRunContext } from "@/features/bookings/server/commands/executeBookingCommand";
import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerPaystackPaymentSuccessCallbackUrl } from "@/lib/app/appBaseUrl";
import { paystackInitializeTransaction } from "./paystackClient";
import { isPaystackEnabled } from "./paystackEnv";
import {
  findPaymentByIdempotencyKey,
  getPaymentById,
  updatePaymentProviderRef,
} from "./paymentRepository";

export type InitializePaymentInput = {
  bookingId: string;
  /** Required when BOOKING_LOCK_REQUIRED is true (default). */
  lockId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  /** Ignored for authority when lock is used; rejected if mismatched. */
  priceCents?: number;
  currency?: string;
  serviceId?: string | null;
  paymentIdempotencyKey?: string;
  email: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

export type InitializePaymentSuccess = {
  ok: true;
  bookingId: string;
  paymentId: string;
  status: "pending_payment";
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type InitializePaymentFailure = {
  ok: false;
  code: string;
  message: string;
  status: number;
};

export type InitializePaymentResult = InitializePaymentSuccess | InitializePaymentFailure;

function buildPaystackReference(bookingId: string, paymentId: string): string {
  const suffix = paymentId.replace(/-/g, "").slice(0, 12);
  return `bk_${bookingId.replace(/-/g, "").slice(0, 8)}_${suffix}`;
}

export async function initializePayment(
  user: CurrentUser,
  input: InitializePaymentInput,
): Promise<InitializePaymentResult> {
  if (!isPaystackEnabled()) {
    return {
      ok: false,
      code: "PAYSTACK_DISABLED",
      message: "Paystack is not enabled.",
      status: 503,
    };
  }

  if (user.role !== "customer") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Only customers can initialize Paystack checkout.",
      status: 403,
    };
  }

  const bookingId = input.bookingId?.trim();
  if (!bookingId) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "bookingId is required.",
      status: 400,
    };
  }

  const userClient = await createSupabaseServerClient();
  if (!userClient) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase is not configured.",
      status: 503,
    };
  }

  const ctx: BookingCommandRunContext = await resolveActorScope(
    userClient,
    user.profileId,
    user.role,
  );

  if (!ctx.actingCustomerId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Customer profile is not linked to a customers row.",
      status: 403,
    };
  }

  const backend = createBookingCommandBackend();
  const actor = { actorType: "customer" as const, profileId: user.profileId };

  const booking = await backend.getBooking(bookingId);
  if (!booking) {
    return {
      ok: false,
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found.",
      status: 404,
    };
  }

  if (booking.customer_id !== ctx.actingCustomerId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Cannot initialize payment for another customer's booking.",
      status: 403,
    };
  }

  if (booking.status === "confirmed" || booking.status === "pending_assignment") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: "Booking is already paid.",
      status: 409,
    };
  }

  const paymentIdempotencyKey =
    input.paymentIdempotencyKey?.trim() || `paystack:booking:${bookingId}`;

  const serviceClient = requireServiceRoleClient();
  const existingPendingPayment = await findPaymentByIdempotencyKey(
    serviceClient,
    paymentIdempotencyKey,
  );

  if (
    existingPendingPayment &&
    existingPendingPayment.booking_id === bookingId &&
    booking.status === "pending_payment"
  ) {
    if (existingPendingPayment.amount_cents !== booking.price_cents) {
      return {
        ok: false,
        code: "QUOTE_MISMATCH",
        message: "Payment amount does not match locked booking price.",
        status: 409,
      };
    }

    return completePaystackInitialize({
      booking,
      bookingId,
      payment: existingPendingPayment,
      email: input.email,
      callbackUrl: input.callbackUrl,
      lockId: input.lockId ?? null,
      serviceClient,
    });
  }

  let lockExpiresAt: string | null = null;

  if (isBookingLockRequired()) {
    const lockId = input.lockId?.trim();
    if (!lockId) {
      return {
        ok: false,
        code: "LOCK_REQUIRED",
        message: "A valid payment lock is required before checkout.",
        status: 400,
      };
    }

    const lockAssert = await assertActiveBookingLock({
      lockId,
      bookingId,
      customerId: ctx.actingCustomerId,
    });

    if (!lockAssert.ok) {
      return {
        ok: false,
        code: lockAssert.code,
        message: lockAssert.message,
        status: lockAssert.status,
      };
    }

    const mismatch = assertBookingMatchesLock(booking, lockAssert.lock);
    if (mismatch) {
      return {
        ok: false,
        code: mismatch.code,
        message: mismatch.message,
        status: mismatch.status,
      };
    }

    if (
      input.priceCents != null &&
      input.priceCents !== lockAssert.lock.locked_price_cents
    ) {
      return {
        ok: false,
        code: "QUOTE_MISMATCH",
        message: "Client price does not match locked server quote.",
        status: 409,
      };
    }

    lockExpiresAt = lockAssert.lock.expires_at;
  } else if (input.priceCents != null && input.priceCents !== booking.price_cents) {
    return {
      ok: false,
      code: "QUOTE_MISMATCH",
      message: "Client price does not match booking price.",
      status: 409,
    };
  }

  const pending = await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor,
      bookingId,
      paymentIdempotencyKey,
      provider: "paystack",
    },
    ctx,
  );

  if (!pending.ok) {
    return {
      ok: false,
      code: pending.code,
      message: pending.message,
      status: pending.code === "FORBIDDEN" ? 403 : 400,
    };
  }

  if (isBookingLockRequired() && input.lockId) {
    await markLockConsumed(serviceClient, input.lockId.trim());

    if (lockExpiresAt) {
      const payment =
        (await findPaymentByIdempotencyKey(serviceClient, paymentIdempotencyKey)) ??
        (await backend.listPaymentsForBooking(bookingId))[0];
      if (payment) {
        await serviceClient
          .from("payments")
          .update({
            payment_link_expires_at: lockExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);
      }
    }
  }

  const payment =
    (await findPaymentByIdempotencyKey(serviceClient, paymentIdempotencyKey)) ??
    (await (async () => {
      const payments = await backend.listPaymentsForBooking(bookingId);
      return payments[0] ?? null;
    })());

  if (!payment) {
    return {
      ok: false,
      code: "PAYMENT_NOT_FOUND",
      message: "Payment row missing after MARK_PAYMENT_PENDING.",
      status: 500,
    };
  }

  return completePaystackInitialize({
    booking,
    bookingId,
    payment,
    email: input.email,
    callbackUrl: input.callbackUrl,
    lockId: input.lockId ?? null,
    serviceClient,
  });
}

async function completePaystackInitialize(params: {
  booking: NonNullable<Awaited<ReturnType<ReturnType<typeof createBookingCommandBackend>["getBooking"]>>>;
  bookingId: string;
  payment: NonNullable<Awaited<ReturnType<typeof findPaymentByIdempotencyKey>>>;
  email: string;
  callbackUrl?: string;
  lockId: string | null;
  serviceClient: ReturnType<typeof requireServiceRoleClient>;
}): Promise<InitializePaymentResult> {
  const { booking, bookingId, payment, email, callbackUrl, lockId, serviceClient } =
    params;

  const paystackAmount = booking.price_cents;
  if (payment.amount_cents !== paystackAmount) {
    return {
      ok: false,
      code: "QUOTE_MISMATCH",
      message: "Payment amount does not match locked booking price.",
      status: 500,
    };
  }

  const reference =
    payment.provider_ref?.trim() || buildPaystackReference(bookingId, payment.id);

  const resolvedCallbackUrl =
    callbackUrl?.trim() || getServerPaystackPaymentSuccessCallbackUrl();
  if (!resolvedCallbackUrl) {
    return {
      ok: false,
      code: "CALLBACK_URL_MISSING",
      message:
        "Paystack callback URL is not configured. Set APP_BASE_URL or NEXT_PUBLIC_APP_URL (e.g. http://localhost:3000).",
      status: 503,
    };
  }

  const paystack = await paystackInitializeTransaction({
    email,
    amount: paystackAmount,
    reference,
    currency: booking.currency,
    callback_url: resolvedCallbackUrl,
    metadata: {
      booking_id: bookingId,
      payment_id: payment.id,
      customer_id: booking.customer_id,
      lock_id: lockId,
    },
  });

  if (payment.provider_ref !== paystack.data.reference) {
    await updatePaymentProviderRef(serviceClient, payment.id, paystack.data.reference);
  }

  const refreshed = await getPaymentById(serviceClient, payment.id);

  return {
    ok: true,
    bookingId,
    paymentId: refreshed?.id ?? payment.id,
    status: "pending_payment",
    authorizationUrl: paystack.data.authorization_url,
    accessCode: paystack.data.access_code,
    reference: paystack.data.reference,
  };
}
