import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type { Json } from "@/lib/database/types";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { getCustomerBillingAccount } from "@/features/monthly-billing/server/customerBillingAccountRepository";
import { recordCustomerBillingAccountAudit } from "@/features/monthly-billing/server/recordCustomerBillingAccountAudit";
import {
  assertMonthlyAccountServiceAuthorizationAllowed,
  ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION,
} from "@/features/monthly-billing/server/assertMonthlyAccountServiceAuthorizationAllowed";
import { loadMonthlyAccountExposureForCustomer } from "@/features/monthly-billing/server/loadMonthlyAccountExposure";
import { isZohoMonthlyCreditGovernanceEnabled } from "@/lib/app/zohoMonthlyCreditGovernanceFlag";
import { isZohoMonthlyServiceAuthorizationEnabled } from "@/lib/app/zohoMonthlyServiceAuthorizationFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { runPostServiceAuthorizationAssignmentDispatch } from "./postServiceAuthorizationDispatch";
import {
  bookingHasRecurringScheduleMetadata,
  isMonthlyAccountBillingMetadata,
  mergeServiceAuthorizationIntoBookingMetadata,
  parseMonthlyAccountBillingMetadata,
} from "./monthlyAccountBookingMetadata";
import {
  findMonthlyServiceAuthorizationByIdempotencyKey,
  findMonthlyServiceAuthorizationForBooking,
  insertMonthlyServiceAuthorization,
} from "./monthlyServiceAuthorizationRepository";
import type { AuthorizeMonthlyServiceBody } from "./parseAuthorizeMonthlyServiceBody";
import { recordAdminBookingAssistAudit } from "./recordAdminBookingAssistAudit";

export type AuthorizeMonthlyAccountServiceInput = {
  admin: CurrentUser;
  bookingId: string;
  body: AuthorizeMonthlyServiceBody;
};

export type AuthorizeMonthlyAccountServiceSuccess = {
  ok: true;
  booking: {
    bookingId: string;
    status: string;
    customerId: string;
  };
  authorization: {
    id: string;
    status: "authorized";
    amountCents: number;
    authorizedAt: string;
  };
  idempotent: boolean;
};

export type AuthorizeMonthlyAccountServiceResult =
  | AuthorizeMonthlyAccountServiceSuccess
  | {
      ok: false;
      code:
        | "FORBIDDEN"
        | "FEATURE_DISABLED"
        | "INVALID_PAYLOAD"
        | "BOOKING_NOT_FOUND"
        | "CUSTOMER_MISMATCH"
        | "ACCOUNT_MISMATCH"
        | "ACCOUNT_DISABLED"
        | "ALREADY_AUTHORIZED"
        | "PAYMENT_EXISTS"
        | "RECURRING_NOT_SUPPORTED"
        | "PERSISTENCE_ERROR"
        | "ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION"
        | "ELEVATED_EXPOSURE_CONFIRMATION_REQUIRED";
      message: string;
      status: number;
    };

function fail(
  code: Extract<AuthorizeMonthlyAccountServiceResult, { ok: false }>["code"],
  message: string,
  status: number,
): Extract<AuthorizeMonthlyAccountServiceResult, { ok: false }> {
  return { ok: false, code, message, status };
}

export async function authorizeMonthlyAccountServiceFacade(
  input: AuthorizeMonthlyAccountServiceInput,
): Promise<AuthorizeMonthlyAccountServiceResult> {
  const { admin, bookingId, body } = input;

  if (admin.role !== "admin") {
    return fail("FORBIDDEN", "Admins only.", 403);
  }

  if (!isZohoMonthlyServiceAuthorizationEnabled()) {
    return fail(
      "FEATURE_DISABLED",
      "Monthly service authorization is disabled. Set ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED=true with monthly billing enabled.",
      403,
    );
  }

  const idempotencyKey = body.idempotencyKey.trim();
  const client = requireServiceRoleClient();
  const backend = createBookingCommandBackend("supabase");

  const priorByKey = await findMonthlyServiceAuthorizationByIdempotencyKey(client, idempotencyKey);
  if (priorByKey) {
    const booking = await backend.getBooking(priorByKey.booking_id);
    if (booking && booking.id === bookingId && booking.customer_id === body.customerId) {
      return {
        ok: true,
        booking: {
          bookingId: booking.id,
          status: booking.status,
          customerId: booking.customer_id,
        },
        authorization: {
          id: priorByKey.id,
          status: "authorized",
          amountCents: priorByKey.amount_cents,
          authorizedAt: priorByKey.created_at,
        },
        idempotent: true,
      };
    }
    return fail(
      "INVALID_PAYLOAD",
      "Idempotency key was used for a different booking or customer.",
      409,
    );
  }

  const booking = await backend.getBooking(bookingId);
  if (!booking) {
    return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
  }

  if (booking.customer_id !== body.customerId) {
    return fail("CUSTOMER_MISMATCH", "customerId does not match the booking.", 400);
  }

  if (booking.status !== "draft") {
    return fail(
      "INVALID_PAYLOAD",
      `Service authorization requires draft status (got "${booking.status}").`,
      400,
    );
  }

  if (!isMonthlyAccountBillingMetadata(booking.metadata)) {
    return fail(
      "INVALID_PAYLOAD",
      "Booking is not tagged for monthly_account billing.",
      400,
    );
  }

  const billingMeta = parseMonthlyAccountBillingMetadata(booking.metadata);
  if (!billingMeta?.monthlyAccountId || billingMeta.monthlyAccountId !== body.monthlyAccountId) {
    return fail("ACCOUNT_MISMATCH", "monthlyAccountId does not match booking billing metadata.", 400);
  }

  if (!Number.isFinite(booking.price_cents) || booking.price_cents <= 0) {
    return fail("INVALID_PAYLOAD", "Booking must have a positive quoted total.", 400);
  }

  if (bookingHasRecurringScheduleMetadata(booking.metadata)) {
    return fail(
      "RECURRING_NOT_SUPPORTED",
      "Recurring monthly_account service authorization is not supported in Phase 3B. Authorize once-off visits only.",
      422,
    );
  }

  const account = await getCustomerBillingAccount(body.customerId, client);
  if (!account) {
    return fail("ACCOUNT_DISABLED", "Customer does not have a billing account.", 404);
  }
  if (account.id !== body.monthlyAccountId) {
    return fail("ACCOUNT_MISMATCH", "monthlyAccountId does not match customer billing account.", 400);
  }
  if (!account.isMonthlyAccountEnabled || account.disabledAt) {
    return fail("ACCOUNT_DISABLED", "Monthly account billing is not enabled for this customer.", 422);
  }

  if (isZohoMonthlyCreditGovernanceEnabled()) {
    const exposureResult = await loadMonthlyAccountExposureForCustomer(
      body.customerId,
      account,
      client,
    );
    const { lastPaymentAt: _lastPaymentAt, ...exposureInput } = exposureResult;
    const gate = assertMonthlyAccountServiceAuthorizationAllowed({
      account,
      exposure: exposureInput,
      confirmElevatedExposure: body.confirmElevatedExposure,
    });
    if (!gate.ok) {
      if (gate.code === ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION) {
        return fail("ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION", gate.message, 422);
      }
      return fail("ELEVATED_EXPOSURE_CONFIRMATION_REQUIRED", gate.message, 400);
    }
  }

  const existingAuth = await findMonthlyServiceAuthorizationForBooking(client, bookingId);
  if (existingAuth?.status === "authorized") {
    return fail("ALREADY_AUTHORIZED", "Booking already has active service authorization.", 409);
  }

  const payments = await backend.listPaymentsForBooking(bookingId);
  if (payments.some((p) => p.status === "paid")) {
    return fail("PAYMENT_EXISTS", "Booking already has a paid payment.", 409);
  }
  if (payments.some((p) => p.status === "pending" || p.status === "initialized")) {
    return fail(
      "PAYMENT_EXISTS",
      "Booking has a pending payment path. Cancel or resolve before service authorization.",
      409,
    );
  }

  const authorizedAt = new Date().toISOString();
  const commandResult = await executeBookingCommand(
    backend,
    {
      type: "CONFIRM_SERVICE_AUTHORIZED",
      actor: { actorType: "admin", profileId: admin.profileId },
      bookingId,
      idempotencyKey,
      reason: body.reason.trim(),
      metadata: {
        monthlyAccountId: body.monthlyAccountId,
        source: "admin_monthly_billing",
      },
    },
    {},
  );

  if (!commandResult.ok) {
    return fail(
      commandResult.code === "FORBIDDEN" ? "FORBIDDEN" : "PERSISTENCE_ERROR",
      commandResult.message,
      commandResult.code === "FORBIDDEN" ? 403 : 500,
    );
  }

  let authorization;
  try {
    authorization = await insertMonthlyServiceAuthorization(client, {
      bookingId,
      customerId: body.customerId,
      adminProfileId: admin.profileId,
      monthlyAccountId: body.monthlyAccountId,
      amountCents: booking.price_cents,
      reason: body.reason.trim(),
      idempotencyKey,
      payload: {
        source: "monthly_account_service_authorization",
        bookingStatusAfter: commandResult.status,
      },
    });
  } catch (e) {
    return fail(
      "PERSISTENCE_ERROR",
      e instanceof Error ? e.message : "Could not persist service authorization.",
      500,
    );
  }

  const serviceAuthorizationMeta = {
    authorized: true as const,
    authorizedAt,
    authorizedByAdminProfileId: admin.profileId,
    reason: body.reason.trim(),
    source: "admin_monthly_billing" as const,
    authorizationId: authorization.id,
  };

  try {
    await backend.updateBookingMetadata(
      bookingId,
      mergeServiceAuthorizationIntoBookingMetadata(booking.metadata, serviceAuthorizationMeta),
    );
  } catch {
    // Metadata mirror is best-effort; authorization row is source of truth.
  }

  const bookingAfter = (await backend.getBooking(bookingId)) ?? booking;

  await runPostServiceAuthorizationAssignmentDispatch(
    client,
    backend,
    bookingAfter,
    authorization.id,
  );

  await recordAdminBookingAssistAudit(client, {
    adminProfileId: admin.profileId,
    customerId: body.customerId,
    bookingId,
    action: "admin_booking_service_authorized",
    idempotencyKey,
    payload: {
      authorizationId: authorization.id,
      monthlyAccountId: body.monthlyAccountId,
      amountCents: booking.price_cents,
      reason: body.reason.trim(),
      bookingStatus: commandResult.status,
    } as Json,
  }).catch(() => undefined);

  await recordCustomerBillingAccountAudit(client, {
    accountId: account.id,
    customerId: body.customerId,
    adminProfileId: admin.profileId,
    action: "monthly_service_authorized",
    idempotencyKey,
    reason: body.reason.trim(),
    extra: {
      bookingId,
      authorizationId: authorization.id,
      amountCents: booking.price_cents,
    },
  }).catch(() => undefined);

  return {
    ok: true,
    booking: {
      bookingId,
      status: commandResult.status,
      customerId: body.customerId,
    },
    authorization: {
      id: authorization.id,
      status: "authorized",
      amountCents: authorization.amount_cents,
      authorizedAt: authorization.created_at,
    },
    idempotent: commandResult.idempotent,
  };
}
