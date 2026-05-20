import {
  isAirbnbOperationalBooking,
  mapAdminBookingHeroRowsForAirbnb,
} from "@/features/dashboards/airbnbOperationalDisplay";
import {
  isDeepOperationalBooking,
  mapAdminBookingHeroRowsForDeep,
} from "@/features/dashboards/deepOperationalDisplay";
import {
  isCarpetOperationalBooking,
  mapAdminBookingHeroRowsForCarpet,
} from "@/features/dashboards/carpetOperationalDisplay";
import {
  isMovingOperationalBooking,
  mapAdminBookingHeroRowsForMoving,
} from "@/features/dashboards/movingOperationalDisplay";
import {
  isOfficeOperationalBooking,
  mapAdminBookingHeroRowsForOffice,
} from "@/features/dashboards/officeOperationalDisplay";
import type { DeferredDispatchStatus } from "@/features/assignments/server/deferredDispatchStatus";
import type {
  AdminTeamEarningsReconciliation,
  AdminOperationalStatus,
} from "@/features/dashboards/server/types";
import type {
  TeamRequestFulfillment,
  TeamSupportOps,
} from "@/features/dashboards/server/adminTeamSupportObservation";
import type { AssignmentOfferStatus } from "@/lib/database/types";

export type AdminBookingHeroRow = {
  label: string;
  value: string;
  valueClassName?: string;
};

/** Above-the-fold scan rows for admin booking detail hero. */
export function buildAdminBookingHeroEssentialRows(input: {
  scheduleLabel: string;
  locationSummary: string;
  customerLabel: string;
  cleanerLabel: string | null;
  priceLabel: string;
}): AdminBookingHeroRow[] {
  return [
    { label: "When", value: input.scheduleLabel },
    { label: "Where", value: input.locationSummary },
    { label: "Customer", value: input.customerLabel },
    {
      label: "Cleaner",
      value: input.cleanerLabel ?? "Unassigned",
      valueClassName: input.cleanerLabel ? undefined : "text-zinc-500",
    },
    { label: "Total", value: input.priceLabel },
  ];
}

/** Secondary booking context — collapsed by default on detail page. */
export function buildAdminBookingHeroContextRows(input: {
  serviceSlug?: string | null;
  serviceLabel?: string | null;
  customerPhone: string | null;
  homeSizeSummary: string | null;
  cleaningIntensityLabel: string | null;
  equipmentSupplyLabel: string | null;
  teamSupportLabel: string | null;
  teamRequestFulfillmentLabel: string | null;
  coordinationStatusLabel: string | null;
}): AdminBookingHeroRow[] {
  const rows: AdminBookingHeroRow[] = [
    {
      label: "Customer phone",
      value: input.customerPhone ?? "Not provided",
      valueClassName: input.customerPhone ? undefined : "text-zinc-500",
    },
  ];
  if (input.homeSizeSummary) {
    rows.push({ label: "Home size", value: input.homeSizeSummary });
  }
  if (input.cleaningIntensityLabel) {
    rows.push({ label: "Cleaning intensity", value: input.cleaningIntensityLabel });
  }
  if (input.equipmentSupplyLabel) {
    rows.push({ label: "Cleaning supplies", value: input.equipmentSupplyLabel });
  }
  if (input.teamSupportLabel) {
    rows.push({ label: "Team support", value: input.teamSupportLabel });
  }
  if (input.teamRequestFulfillmentLabel) {
    rows.push({
      label: "Team support fulfillment",
      value: input.teamRequestFulfillmentLabel,
    });
  }
  if (input.coordinationStatusLabel) {
    rows.push({ label: "Team coordination", value: input.coordinationStatusLabel });
  }

  if (isAirbnbOperationalBooking(input)) {
    return mapAdminBookingHeroRowsForAirbnb(rows);
  }
  if (isMovingOperationalBooking(input)) {
    return mapAdminBookingHeroRowsForMoving(rows, {
      notesLabel: "Move instructions",
    });
  }
  if (isDeepOperationalBooking(input)) {
    return mapAdminBookingHeroRowsForDeep(rows, {
      notesLabel: "Attention areas",
    });
  }
  if (isOfficeOperationalBooking(input)) {
    return mapAdminBookingHeroRowsForOffice(rows, {
      notesLabel: "Workspace instructions",
    });
  }
  if (isCarpetOperationalBooking(input)) {
    return mapAdminBookingHeroRowsForCarpet(rows, {
      notesLabel: "Areas needing attention",
    });
  }
  return rows;
}

export function adminTeamSupportNeedsFollowUp(input: {
  isTwoCleanerRequest: boolean;
  teamRequestFulfillment: TeamRequestFulfillment | null;
  teamSupportOps: TeamSupportOps;
}): boolean {
  if (!input.isTwoCleanerRequest) return false;
  if (!input.teamRequestFulfillment) return true;
  const coordination = input.teamSupportOps.coordinationStatus?.status;
  return (
    coordination == null ||
    coordination === "awaiting_coordination" ||
    coordination === "partially_fulfilled"
  );
}

export function adminEarningsNeedsAttention(
  reconciliation: AdminTeamEarningsReconciliation,
): boolean {
  if (!reconciliation.enabled) return false;
  return reconciliation.status === "blocked" || reconciliation.blockingIssues.length > 0;
}

export function adminDeferredDispatchNeedsAttention(
  deferred: DeferredDispatchStatus | undefined,
): boolean {
  if (!deferred || deferred.phase === "not_applicable") return false;
  return deferred.phase === "dispatch_overdue" || deferred.operationalAttentionRequired;
}

export function adminOperationalNeedsImmediateAttention(input: {
  paymentFailed: boolean;
  operational: AdminOperationalStatus;
  earningsAttention: boolean;
  teamSupportFollowUp: boolean;
  deferredAttention: boolean;
}): boolean {
  return (
    input.paymentFailed ||
    input.deferredAttention ||
    input.teamSupportFollowUp ||
    input.earningsAttention ||
    input.operational.manualInterventionNeeded ||
    input.operational.opsAdminRequired ||
    input.operational.recoveryEligibility === "eligible"
  );
}

/** One-line ops scan for summary strip (presentation only). */
export function adminBookingOperationalScanLine(operational: AdminOperationalStatus): string {
  return `${operational.paymentState} · ${operational.assignmentState} · ${operational.openOfferSummary}`;
}

type OfferWithStatus = { status: AssignmentOfferStatus };

/** Splits assignment offers for progressive disclosure (presentation only). */
export function partitionAdminAssignmentOffers<T extends OfferWithStatus>(
  offers: readonly T[],
): { activeOffers: T[]; pastOffers: T[] } {
  const activeOffers = offers.filter((o) => o.status === "offered");
  const pastOffers = offers.filter((o) => o.status !== "offered");
  return { activeOffers, pastOffers };
}
