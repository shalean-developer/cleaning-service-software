import type { CleanerPublicCard } from "@/features/cleaners/server/types";
import type { PricingBreakdown } from "@/features/pricing/server/types";
import { normalizeAreaSlug } from "@/features/cleaners/server/eligibility/normalize";
import type { BookingWizardState } from "./types";
import { buildWizardSlot } from "./slot";
import { wizardStateToPricingInput } from "./buildMetadata";
import type { InitializeCheckoutPayload } from "./checkout";
import type { LockRequestBody } from "./lockPayload";

export type ApiError = {
  ok: false;
  error: string;
  message?: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T | ApiError> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const record = data as Record<string, unknown>;
    return {
      ok: false,
      error: String(record.error ?? "REQUEST_FAILED"),
      message: typeof record.message === "string" ? record.message : undefined,
    };
  }

  return data as T;
}

export async function fetchPricingQuote(
  state: BookingWizardState,
): Promise<{ ok: true; quote: PricingBreakdown } | ApiError> {
  const input = wizardStateToPricingInput(state);
  if (!input) {
    return { ok: false, error: "INVALID_STATE", message: "Service not selected." };
  }

  const result = await postJson<{ ok: true; quote: PricingBreakdown }>(
    "/api/pricing/quote",
    input,
  );

  if ("ok" in result && result.ok === false) return result;
  if (!("quote" in result) || !result.ok) {
    return { ok: false, error: "INVALID_RESPONSE", message: "Quote response invalid." };
  }

  return { ok: true, quote: result.quote };
}

export async function fetchAvailableCleaners(
  state: BookingWizardState,
): Promise<
  | {
      ok: true;
      cleaners: CleanerPublicCard[];
      bestAvailable: { cleanerId: string; displayName: string } | null;
    }
  | ApiError
> {
  const slot = buildWizardSlot(state.date, state.time);
  if (!slot || !state.serviceSlug) {
    return {
      ok: false,
      error: "INVALID_STATE",
      message: "Complete service and date/time first.",
    };
  }

  const input = wizardStateToPricingInput(state);
  const areaSlug = normalizeAreaSlug(state.suburb);

  const result = await postJson<{
    ok: true;
    cleaners: CleanerPublicCard[];
    bestAvailable: { cleanerId: string; displayName: string } | null;
  }>("/api/cleaners/available", {
    serviceSlug: state.serviceSlug,
    suburb: state.suburb,
    areaSlug,
    date: state.date,
    time: state.time,
    scheduledStart: slot.scheduledStart,
    scheduledEnd: slot.scheduledEnd,
    bedrooms: input?.bedrooms,
    bathrooms: input?.bathrooms,
    propertySizeSqm: input?.propertySizeSqm,
    frequency: input?.frequency,
    teamSize: 1,
  });

  if ("ok" in result && result.ok === false) return result;
  if (!result.ok || !Array.isArray(result.cleaners)) {
    return { ok: false, error: "INVALID_RESPONSE", message: "Cleaner list invalid." };
  }

  return {
    ok: true,
    cleaners: result.cleaners,
    bestAvailable: result.bestAvailable,
  };
}

export type PaymentLockResponse = {
  ok: true;
  lockId: string;
  bookingId: string;
  lockedPriceCents: number;
  currency: string;
  expiresAt: string;
  paymentIdempotencyKey: string;
  idempotent: boolean;
};

export async function createPaymentLock(
  body: LockRequestBody,
): Promise<PaymentLockResponse | ApiError> {
  const result = await postJson<PaymentLockResponse>("/api/bookings/lock", body);

  if ("ok" in result && result.ok === false) return result;
  if (!result.ok || typeof result.lockId !== "string") {
    return { ok: false, error: "INVALID_RESPONSE", message: "Lock response invalid." };
  }

  return result;
}

export async function initializePaystackCheckout(
  payload: InitializeCheckoutPayload,
): Promise<
  | {
      ok: true;
      authorization_url: string;
      bookingId: string;
      status: "pending_payment";
    }
  | ApiError
> {
  const result = await postJson<{
    ok: true;
    authorization_url: string;
    bookingId: string;
    status: "pending_payment";
  }>("/api/paystack/initialize", payload);

  if ("ok" in result && result.ok === false) return result;
  if (
    !result.ok ||
    typeof result.authorization_url !== "string" ||
    result.status !== "pending_payment"
  ) {
    return { ok: false, error: "INVALID_RESPONSE", message: "Checkout response invalid." };
  }

  return {
    ok: true,
    authorization_url: result.authorization_url,
    bookingId: result.bookingId,
    status: "pending_payment",
  };
}
