import { buildCleanerJobTeamContext } from "@/features/dashboards/server/cleanerTeamJobVisibility";
import type {
  CleanerJobDetail,
  CleanerJobListItem,
  CleanerOfferListItem,
} from "@/features/dashboards/server/types";

export function testCleanerOfferListItem(
  partial: Partial<CleanerOfferListItem> & Pick<CleanerOfferListItem, "offerId">,
): CleanerOfferListItem {
  return {
    bookingId: "booking-1",
    status: "offered",
    expiresAt: "2030-06-01T14:00:00.000Z",
    offeredAt: "2030-05-30T10:00:00.000Z",
    scheduleLabel: "Sat 14:00",
    locationSummary: "Sea Point, Cape Town",
    serviceLabel: "Regular cleaning",
    earningsCents: 35_000,
    earningsLabel: "R 350.00",
    isExpired: false,
    teamRoleLabel: null,
    ...partial,
  };
}

export function testCleanerJobListItem(
  partial: Partial<CleanerJobListItem> & Pick<CleanerJobListItem, "bookingId">,
): CleanerJobListItem {
  return {
    status: "assigned",
    scheduledStart: "2030-06-01T08:00:00.000Z",
    scheduledEnd: "2030-06-01T11:00:00.000Z",
    scheduleLabel: "Sun 10:00",
    locationSummary: "Sea Point, Cape Town",
    serviceLabel: "Regular cleaning",
    earningsCents: null,
    earningsLabel: "Earnings pending",
    updatedAt: "2030-05-30T10:00:00.000Z",
    teamRoleLabel: null,
    isTeamJob: false,
    ...partial,
  };
}

export function testCleanerJobDetail(
  partial: Partial<CleanerJobDetail> & Pick<CleanerJobDetail, "bookingId">,
): CleanerJobDetail {
  const list = testCleanerJobListItem(partial);
  return {
    ...list,
    timeline: [],
    homeSizeSummary: "2 bedrooms · 1 bathroom",
    cleaningIntensityLabel: "Standard",
    equipmentSupplyOperationalLabel: "Customer supplies equipment",
    teamSupportCleanerNote: null,
    specialInstructions: null,
    earnings: [],
    team: buildCleanerJobTeamContext(null, [], false),
    ...partial,
  };
}
