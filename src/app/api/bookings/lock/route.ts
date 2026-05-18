import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createBookingPaymentLock } from "@/features/bookings/server/lock/createBookingPaymentLock";
import type { BookingLockInput } from "@/features/bookings/server/lock/types";
import { isServiceSlug } from "@/features/pricing/server/catalog";
import {
  isAddonSlug,
  isCleaningIntensity,
  isEquipmentSupply,
  isPricingFrequency,
} from "@/features/pricing/server/catalog";
import { normalizeAreaSlug } from "@/features/cleaners/server/eligibility/normalize";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Body must be a JSON object." },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  const parsed = parseLockBody(payload);
  if ("error" in parsed) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: parsed.error },
      { status: 400 },
    );
  }

  const result = await createBookingPaymentLock(user, parsed);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    lockId: result.lockId,
    bookingId: result.bookingId,
    lockedPriceCents: result.lockedPriceCents,
    currency: result.currency,
    expiresAt: result.expiresAt,
    paymentIdempotencyKey: result.paymentIdempotencyKey,
    idempotent: result.idempotent,
  });
}

function parseLockBody(
  payload: Record<string, unknown>,
): BookingLockInput | { error: string } {
  const checkoutIdempotencyKey =
    typeof payload.checkoutIdempotencyKey === "string"
      ? payload.checkoutIdempotencyKey.trim()
      : typeof payload.checkout_idempotency_key === "string"
        ? payload.checkout_idempotency_key.trim()
        : "";

  if (!checkoutIdempotencyKey) {
    return { error: "checkoutIdempotencyKey is required." };
  }

  const clientQuoteTotalCents =
    typeof payload.clientQuoteTotalCents === "number"
      ? payload.clientQuoteTotalCents
      : typeof payload.client_quote_total_cents === "number"
        ? payload.client_quote_total_cents
        : NaN;

  const serviceSlugRaw =
    typeof payload.serviceSlug === "string" ? payload.serviceSlug : null;
  if (!serviceSlugRaw || !isServiceSlug(serviceSlugRaw)) {
    return { error: "serviceSlug is required." };
  }

  const bedrooms = payload.bedrooms;
  const bathrooms = payload.bathrooms;
  if (typeof bedrooms !== "number" || typeof bathrooms !== "number") {
    return { error: "bedrooms and bathrooms are required." };
  }

  const extraRooms =
    typeof payload.extraRooms === "number"
      ? payload.extraRooms
      : typeof payload.extra_rooms === "number"
        ? payload.extra_rooms
        : 0;

  const cleaningIntensityRaw =
    typeof payload.cleaningIntensity === "string"
      ? payload.cleaningIntensity
      : typeof payload.cleaning_intensity === "string"
        ? payload.cleaning_intensity
        : "standard";

  const equipmentSupplyRaw =
    typeof payload.equipmentSupply === "string"
      ? payload.equipmentSupply
      : typeof payload.equipment_supply === "string"
        ? payload.equipment_supply
        : "customer";

  const scheduledStart =
    typeof payload.scheduledStart === "string" ? payload.scheduledStart : null;
  const scheduledEnd =
    typeof payload.scheduledEnd === "string" ? payload.scheduledEnd : null;
  if (!scheduledStart || !scheduledEnd) {
    return { error: "scheduledStart and scheduledEnd are required." };
  }

  const suburb =
    typeof payload.suburb === "string"
      ? payload.suburb
      : typeof payload.areaSlug === "string"
        ? payload.areaSlug
        : "";
  const areaSlug = normalizeAreaSlug(suburb);
  if (!areaSlug) {
    return { error: "suburb or areaSlug is required." };
  }

  const modeRaw =
    typeof payload.cleanerPreferenceMode === "string"
      ? payload.cleanerPreferenceMode
      : "best_available";
  const selectedCleanerId =
    typeof payload.selectedCleanerId === "string"
      ? payload.selectedCleanerId
      : typeof payload.preferred_cleaner_id === "string"
        ? payload.preferred_cleaner_id
        : null;

  const frequencyRaw = typeof payload.frequency === "string" ? payload.frequency : "once";
  const frequency = isPricingFrequency(frequencyRaw) ? frequencyRaw : undefined;
  if (!frequency) {
    return { error: "Invalid frequency." };
  }

  const cleaningIntensity = isCleaningIntensity(cleaningIntensityRaw)
    ? cleaningIntensityRaw
    : "standard";
  if (
    serviceSlugRaw !== "regular-cleaning" &&
    cleaningIntensity !== "standard"
  ) {
    return { error: "Cleaning intensity is only available for regular cleaning." };
  }

  const equipmentSupply = isEquipmentSupply(equipmentSupplyRaw)
    ? equipmentSupplyRaw
    : "customer";
  if (serviceSlugRaw !== "regular-cleaning" && equipmentSupply !== "customer") {
    return { error: "Equipment supply option is only available for regular cleaning." };
  }

  const requestedTeamSizeRaw =
    typeof payload.requestedTeamSize === "number"
      ? payload.requestedTeamSize
      : typeof payload.requested_team_size === "number"
        ? payload.requested_team_size
        : 1;
  const requestedTeamSize =
    serviceSlugRaw === "regular-cleaning" && requestedTeamSizeRaw === 2 ? 2 : 1;
  if (
    requestedTeamSizeRaw !== 1 &&
    requestedTeamSizeRaw !== 2
  ) {
    return { error: "requestedTeamSize must be 1 or 2." };
  }

  const addons: BookingLockInput["pricingInput"]["addons"] = [];
  if (Array.isArray(payload.addons)) {
    for (const a of payload.addons) {
      if (typeof a === "string" && isAddonSlug(a)) addons.push(a);
    }
  }

  const bookingMetadata =
    payload.bookingMetadata != null &&
    typeof payload.bookingMetadata === "object" &&
    !Array.isArray(payload.bookingMetadata)
      ? (payload.bookingMetadata as Record<string, unknown>)
      : payload.metadata != null &&
          typeof payload.metadata === "object" &&
          !Array.isArray(payload.metadata)
        ? (payload.metadata as Record<string, unknown>)
        : {};

  return {
    checkoutIdempotencyKey,
    clientQuoteTotalCents,
    pricingInput: {
      serviceSlug: serviceSlugRaw,
      bedrooms,
      bathrooms,
      extraRooms,
      cleaningIntensity:
        serviceSlugRaw === "regular-cleaning" ? cleaningIntensity : "standard",
      equipmentSupply:
        serviceSlugRaw === "regular-cleaning" ? equipmentSupply : "customer",
      propertySizeSqm:
        typeof payload.propertySizeSqm === "number" ? payload.propertySizeSqm : undefined,
      frequency,
      addons: addons.length > 0 ? addons : undefined,
      teamSize: 1,
      requestedTeamSize,
    },
    scheduledStart,
    scheduledEnd,
    areaSlug,
    cleanerPreference: {
      mode: modeRaw === "selected" ? "selected" : "best_available",
      selectedCleanerId: modeRaw === "selected" ? selectedCleanerId : null,
    },
    bookingMetadata,
  };
}
