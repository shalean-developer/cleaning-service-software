import type { Json } from "@/lib/database/types";
import { isAdminAssistedBookingMetadata } from "./adminAssistMetadata";

export type AdminAssistedBookingRow = {
  id: string;
  customer_id: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  price_cents: number;
  metadata: Json | null;
};

export type AdminAssistedBookingValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function asRecord(metadata: Json | null | undefined): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  return metadata as Record<string, unknown>;
}

export function hasAdminAssistQuoteSnapshot(metadata: Json | null | undefined): boolean {
  const root = asRecord(metadata);
  if (!root) return false;
  const quote = root.quote;
  if (!quote || typeof quote !== "object" || Array.isArray(quote)) return false;
  const breakdown = (quote as Record<string, unknown>).breakdown;
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return false;
  return typeof (breakdown as Record<string, unknown>).totalCents === "number";
}

export function hasAdminAssistAddressSnapshot(metadata: Json | null | undefined): boolean {
  const root = asRecord(metadata);
  if (!root) return false;

  const address = root.address;
  if (address && typeof address === "object" && !Array.isArray(address)) {
    const row = address as Record<string, unknown>;
    return (
      typeof row.line1 === "string" &&
      row.line1.trim().length > 0 &&
      typeof row.suburb === "string" &&
      row.suburb.trim().length > 0 &&
      typeof row.city === "string" &&
      row.city.trim().length > 0
    );
  }

  const suburb = typeof root.suburb === "string" ? root.suburb.trim() : "";
  const city = typeof root.city === "string" ? root.city.trim() : "";
  return suburb.length > 0 && city.length > 0;
}

export function validateAdminAssistedDraftForPendingPayment(
  booking: AdminAssistedBookingRow,
): AdminAssistedBookingValidationResult {
  if (!isAdminAssistedBookingMetadata(booking.metadata)) {
    return {
      ok: false,
      code: "NOT_ADMIN_ASSISTED",
      message: "Booking was not created via admin-assisted booking.",
    };
  }

  if (booking.status !== "draft") {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: `Booking must be draft to move to pending payment (current: ${booking.status}).`,
    };
  }

  if (!booking.scheduled_start?.trim() || !booking.scheduled_end?.trim()) {
    return {
      ok: false,
      code: "INCOMPLETE_SCHEDULE",
      message: "Booking schedule is incomplete.",
    };
  }

  if (!hasAdminAssistQuoteSnapshot(booking.metadata)) {
    return {
      ok: false,
      code: "MISSING_QUOTE",
      message: "Booking is missing a server quote snapshot.",
    };
  }

  if (!hasAdminAssistAddressSnapshot(booking.metadata)) {
    return {
      ok: false,
      code: "INCOMPLETE_ADDRESS",
      message: "Booking address metadata is incomplete.",
    };
  }

  if (!Number.isFinite(booking.price_cents) || booking.price_cents <= 0) {
    return {
      ok: false,
      code: "INVALID_PRICE",
      message: "Booking price must be set before pending payment.",
    };
  }

  return { ok: true };
}

export function validateAdminAssistedPendingPaymentForPaymentLink(
  booking: AdminAssistedBookingRow,
): AdminAssistedBookingValidationResult {
  if (!isAdminAssistedBookingMetadata(booking.metadata)) {
    return {
      ok: false,
      code: "NOT_ADMIN_ASSISTED",
      message: "Booking was not created via admin-assisted booking.",
    };
  }

  if (booking.status !== "pending_payment") {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: `Booking must be pending_payment to generate a payment link (current: ${booking.status}).`,
    };
  }

  if (!hasAdminAssistQuoteSnapshot(booking.metadata)) {
    return {
      ok: false,
      code: "MISSING_QUOTE",
      message: "Booking is missing a server quote snapshot.",
    };
  }

  if (!Number.isFinite(booking.price_cents) || booking.price_cents <= 0) {
    return {
      ok: false,
      code: "INVALID_PRICE",
      message: "Booking price must be set before generating a payment link.",
    };
  }

  return { ok: true };
}

export function validateAdminAssistedPendingPaymentForOfflineRecord(
  booking: AdminAssistedBookingRow,
): AdminAssistedBookingValidationResult {
  return validateAdminAssistedPendingPaymentForPaymentLink(booking);
}
