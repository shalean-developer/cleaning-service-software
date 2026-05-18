import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupportOfferTeamRole, offerTeamRole } from "@/features/assignments/server/offerTeamRole";
import { isTeamOffersEnabled } from "@/features/assignments/server/teamOffersConfig";
import { isTeamEarningsEnabled } from "@/features/earnings/server/teamEarningsConfig";
import { resolveCleanerEarningsDisplay } from "./resolveCleanerEarningsDisplay";
import type {
  AssignmentOfferRow,
  BookingCleanerRole,
  BookingCleanerRow,
  Database,
} from "@/lib/database/types";
import {
  listTeamRosterFoundationForBooking,
  type TeamRosterFoundationRow,
} from "./bookingCleanersReadModel";

export const LABEL_LEAD_CLEANER = "Lead cleaner";
export const LABEL_SUPPORT_CLEANER = "Support cleaner";

export const SUPPORT_CLEANER_EARNINGS_LABEL =
  "Team earnings are handled by operations for this phase.";

export type CleanerViewerJobRole = "lead" | "support" | null;

export type SupportParticipationContext = {
  rosterStatus: BookingCleanerRow["status"] | null;
  supportCompletedAt: string | null;
  supportNote: string | null;
  canMarkParticipation: boolean;
  hasMarkedParticipation: boolean;
};

export type CleanerJobTeamContext = {
  isTeamJob: boolean;
  viewerRole: CleanerViewerJobRole;
  viewerRoleLabel: string | null;
  leadCleanerName: string | null;
  supportCleanerNames: string[];
  fasterCompletionRequested: boolean;
  canStartJob: boolean;
  canCompleteJob: boolean;
  /** NF-7F: support cleaner participation (roster-only; no booking lifecycle). */
  supportParticipation: SupportParticipationContext;
};

export function labelForCleanerViewerRole(role: CleanerViewerJobRole): string | null {
  if (role === "lead") return LABEL_LEAD_CLEANER;
  if (role === "support") return LABEL_SUPPORT_CLEANER;
  return null;
}

export function rosterRoleToViewerRole(
  rosterRole: BookingCleanerRole,
): CleanerViewerJobRole {
  return rosterRole === "support" ? "support" : "lead";
}

export function resolveCleanerViewerRole(
  bookingCleanerId: string | null,
  actingCleanerId: string,
  rosterRow: Pick<BookingCleanerRow, "cleaner_id" | "role" | "status"> | null,
  teamOffersEnabled: boolean,
): CleanerViewerJobRole {
  if (bookingCleanerId === actingCleanerId) return "lead";
  if (
    teamOffersEnabled &&
    rosterRow &&
    rosterRow.cleaner_id === actingCleanerId &&
    rosterRow.status === "accepted"
  ) {
    return rosterRoleToViewerRole(rosterRow.role);
  }
  return null;
}

export function cleanerCanViewJobDetail(
  bookingCleanerId: string | null,
  actingCleanerId: string,
  rosterRow: Pick<BookingCleanerRow, "cleaner_id" | "role" | "status"> | null,
  teamOffersEnabled: boolean,
): boolean {
  return resolveCleanerViewerRole(bookingCleanerId, actingCleanerId, rosterRow, teamOffersEnabled) != null;
}

export function resolveSupportOfferEarningsDisplay(): {
  earningsCents: null;
  earningsLabel: string;
} {
  return {
    earningsCents: null,
    earningsLabel: SUPPORT_CLEANER_EARNINGS_LABEL,
  };
}

/**
 * NF-7G: Support cleaner earnings after participation confirmation (and when lines exist).
 */
export function resolveSupportCleanerEarningsDisplay(input: {
  currency: string;
  metadata: import("@/lib/database/types").Json | null | undefined;
  price_cents: number;
  cleaner_id: string | null;
  earningLines: { payout_amount_cents: number; cleaner_id?: string }[];
  hasMarkedParticipation: boolean;
}): { earningsCents: number | null; earningsLabel: string } {
  if (!isTeamEarningsEnabled() || !input.hasMarkedParticipation) {
    return resolveSupportOfferEarningsDisplay();
  }

  if (input.earningLines.length > 0) {
    return resolveCleanerEarningsDisplay({
      currency: input.currency,
      metadata: input.metadata,
      price_cents: input.price_cents,
      cleaner_id: input.cleaner_id,
      earningLines: input.earningLines,
    });
  }

  return {
    earningsCents: null,
    earningsLabel: "Earnings pending lead completion",
  };
}

export async function loadAcceptedSupportBookingIds(
  client: SupabaseClient<Database>,
  actingCleanerId: string,
): Promise<string[]> {
  const { data: rows, error } = await client
    .from("booking_cleaners")
    .select("booking_id")
    .eq("cleaner_id", actingCleanerId)
    .eq("role", "support")
    .eq("status", "accepted");

  if (error || !rows?.length) return [];
  return rows.map((r) => r.booking_id);
}

export async function loadRosterRowForCleaner(
  client: SupabaseClient<Database>,
  bookingId: string,
  actingCleanerId: string,
): Promise<BookingCleanerRow | null> {
  const { data, error } = await client
    .from("booking_cleaners")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("cleaner_id", actingCleanerId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

const SUPPORT_PARTICIPATION_BOOKING_STATUSES = new Set(["in_progress", "completed"]);

export function buildSupportParticipationContext(
  viewerRole: CleanerViewerJobRole,
  rosterRow: Pick<
    BookingCleanerRow,
    "status" | "support_completed_at" | "support_note"
  > | null,
  bookingStatus: string,
): SupportParticipationContext {
  const rosterStatus = rosterRow?.status ?? null;
  const hasMarkedParticipation = rosterStatus === "completed";
  const canMarkParticipation =
    viewerRole === "support" &&
    rosterStatus === "accepted" &&
    SUPPORT_PARTICIPATION_BOOKING_STATUSES.has(bookingStatus);

  return {
    rosterStatus,
    supportCompletedAt: rosterRow?.support_completed_at ?? null,
    supportNote: rosterRow?.support_note ?? null,
    canMarkParticipation,
    hasMarkedParticipation,
  };
}

export function buildCleanerJobTeamContext(
  viewerRole: CleanerViewerJobRole,
  rosterRows: TeamRosterFoundationRow[],
  fasterCompletionRequested: boolean,
  rosterRow: Pick<
    BookingCleanerRow,
    "role" | "status" | "support_completed_at" | "support_note"
  > | null = null,
  bookingStatus = "",
): CleanerJobTeamContext {
  const isTeamJob =
    rosterRows.length > 1 ||
    rosterRows.some((r) => r.role === "support") ||
    viewerRole === "support";

  const primary = rosterRows.find((r) => r.role === "primary");
  const supportRows = rosterRows.filter((r) => r.role === "support" && r.status === "accepted");

  return {
    isTeamJob,
    viewerRole,
    viewerRoleLabel: labelForCleanerViewerRole(viewerRole),
    leadCleanerName: primary?.cleanerLabel ?? null,
    supportCleanerNames: supportRows
      .map((r) => r.cleanerLabel)
      .filter((n): n is string => Boolean(n)),
    fasterCompletionRequested,
    canStartJob: viewerRole === "lead",
    canCompleteJob: viewerRole === "lead",
    supportParticipation: buildSupportParticipationContext(
      viewerRole,
      rosterRow,
      bookingStatus,
    ),
  };
}

export async function resolveCleanerJobTeamContext(
  client: SupabaseClient<Database> | null,
  bookingId: string,
  bookingCleanerId: string | null,
  actingCleanerId: string,
  fasterCompletionRequested: boolean,
  bookingStatus = "",
): Promise<CleanerJobTeamContext> {
  const teamOffersEnabled = isTeamOffersEnabled();
  const rosterRow =
    teamOffersEnabled && client
      ? await loadRosterRowForCleaner(client, bookingId, actingCleanerId)
      : null;

  const viewerRole = resolveCleanerViewerRole(
    bookingCleanerId,
    actingCleanerId,
    rosterRow,
    teamOffersEnabled,
  );

  const rosterRows =
    teamOffersEnabled && client && viewerRole != null
      ? await listTeamRosterFoundationForBooking(client, bookingId)
      : [];

  return buildCleanerJobTeamContext(
    viewerRole,
    rosterRows,
    fasterCompletionRequested,
    rosterRow,
    bookingStatus,
  );
}

export function labelForOfferTeamRole(
  offer: Pick<AssignmentOfferRow, "team_role">,
): string | null {
  if (!isTeamOffersEnabled()) return null;
  if (isSupportOfferTeamRole(offerTeamRole(offer))) return LABEL_SUPPORT_CLEANER;
  return null;
}
