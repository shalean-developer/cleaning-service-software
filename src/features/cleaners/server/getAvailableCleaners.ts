import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { AvailableCleanersResult, BookingCleanersResult } from "./types";
import { listBookingCleaners, listEligibleCleaners } from "./eligibility/listEligibleCleaners";
import {
  extractPricingInputFromBookingMetadata,
  extractQueryFromBookingMetadata,
  type ParsedAvailableRequest,
  type ParsedBookingCleanersRequest,
} from "./parseRequests";
import {
  getBookingForCustomer,
  loadCleanerCandidates,
  loadConflictingCleanerIds,
} from "./repository";

export type CleanerLookupFailure = {
  ok: false;
  code: string;
  message: string;
  status: number;
};

export type CleanerLookupSuccess<T> = {
  ok: true;
  data: T;
};

export type CleanerLookupResult<T> = CleanerLookupSuccess<T> | CleanerLookupFailure;

function forbidden(message: string): CleanerLookupFailure {
  return { ok: false, code: "FORBIDDEN", message, status: 403 };
}

function badRequest(code: string, message: string): CleanerLookupFailure {
  return { ok: false, code, message, status: 400 };
}

async function assertCustomerOrAdmin(user: CurrentUser): Promise<CleanerLookupFailure | null> {
  if (user.role !== "customer" && user.role !== "admin") {
    return forbidden("Only customers and admins can look up cleaner availability.");
  }
  return null;
}

export async function getAvailableCleaners(
  user: CurrentUser,
  parsed: ParsedAvailableRequest,
): Promise<CleanerLookupResult<AvailableCleanersResult>> {
  const authz = await assertCustomerOrAdmin(user);
  if (authz) return authz;

  const serviceClient = requireServiceRoleClient();
  const candidates = await loadCleanerCandidates(serviceClient);
  const conflictingCleanerIds = await loadConflictingCleanerIds(
    serviceClient,
    parsed.slot.scheduledStart,
    parsed.slot.scheduledEnd,
  );

  const result = listEligibleCleaners({
    candidates,
    query: {
      serviceSlug: parsed.serviceSlug,
      areaSlug: parsed.areaSlug,
      slot: parsed.slot,
      teamSize: parsed.teamSize,
    },
    conflictingCleanerIds,
    pricingInput: parsed.pricingInput,
  });

  if ("ok" in result && result.ok === false) {
    return badRequest(result.code, result.message);
  }

  return { ok: true, data: result as AvailableCleanersResult };
}

export async function getBookingCleaners(
  user: CurrentUser,
  parsed: ParsedBookingCleanersRequest,
): Promise<CleanerLookupResult<BookingCleanersResult>> {
  const authz = await assertCustomerOrAdmin(user);
  if (authz) return authz;

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

  let slot = parsed.slot;
  let query = {
    serviceSlug: parsed.serviceSlug,
    areaSlug: parsed.areaSlug,
    slot: parsed.slot,
    teamSize: parsed.teamSize,
  };
  let pricingInput = parsed.pricingInput;
  let excludeBookingId = parsed.excludeBookingId ?? null;
  let selectedCleanerId = parsed.selectedCleanerId ?? null;

  if (parsed.bookingId) {
    if (user.role === "customer" && !ctx.actingCustomerId) {
      return forbidden("Customer profile is not linked.");
    }

    const booking =
      user.role === "admin"
        ? (
            await serviceClient
              .from("bookings")
              .select("*")
              .eq("id", parsed.bookingId)
              .maybeSingle()
          ).data
        : await getBookingForCustomer(
            serviceClient,
            parsed.bookingId,
            ctx.actingCustomerId!,
          );

    if (!booking) {
      return {
        ok: false,
        code: "BOOKING_NOT_FOUND",
        message: "Booking not found or access denied.",
        status: 404,
      };
    }

    slot = {
      scheduledStart: booking.scheduled_start,
      scheduledEnd: booking.scheduled_end,
    };

    const metadata =
      booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
        ? (booking.metadata as Record<string, unknown>)
        : {};

    const metaQuery = extractQueryFromBookingMetadata(
      metadata,
      parsed.areaSlug,
      slot,
      parsed.teamSize,
    );
    if (metaQuery) {
      query = {
        serviceSlug: metaQuery.serviceSlug,
        areaSlug: metaQuery.areaSlug,
        slot,
        teamSize: metaQuery.teamSize ?? parsed.teamSize,
      };
    }

    pricingInput =
      extractPricingInputFromBookingMetadata(metadata) ?? pricingInput;

    const preferred = metadata.preferred_cleaner_id ?? metadata.preferredCleanerId;
    if (typeof preferred === "string" && !selectedCleanerId) {
      selectedCleanerId = preferred;
    }

    excludeBookingId = booking.id;
  }

  const candidates = await loadCleanerCandidates(serviceClient);
  const conflictingCleanerIds = await loadConflictingCleanerIds(
    serviceClient,
    slot.scheduledStart,
    slot.scheduledEnd,
    excludeBookingId,
  );

  const result = listBookingCleaners({
    candidates,
    query: { ...query, slot },
    conflictingCleanerIds,
    pricingInput,
    selectedCleanerId,
  });

  if ("ok" in result && result.ok === false) {
    return badRequest(result.code, result.message);
  }

  return { ok: true, data: result as BookingCleanersResult };
}
