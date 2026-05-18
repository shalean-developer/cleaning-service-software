import { describe, expect, it } from "vitest";
import type { Json } from "@/lib/database/types";
import {
  buildAdminOperationalLoadBadges,
  computeAdminTeamSupportAnalytics,
  mapTeamSupportObservationRow,
  matchesTeamSupportBookingFilter,
  mergeTeamRequestFulfillmentMetadata,
  mergeTeamSupportOpsMetadata,
  parseAdminOperationalLoadSignals,
  readTeamRequestFulfillment,
  readTeamSupportOps,
  supportingCleanerDisplayLabel,
  teamCoordinationStatusLabel,
} from "./adminTeamSupportObservation";

describe("adminTeamSupportObservation", () => {
  const teamMetadata = {
    quote: {
      input: {
        serviceSlug: "regular-cleaning",
        bedrooms: 4,
        bathrooms: 3,
        requestedTeamSize: 2,
        equipmentSupply: "shalean",
        cleaningIntensity: "heavy",
      },
    },
  };

  it("parses operational load signals for stacked regular-cleaning options", () => {
    const signals = parseAdminOperationalLoadSignals(teamMetadata, "regular-cleaning");
    expect(signals).toEqual({
      isTwoCleanerRequest: true,
      isShaleanEquipment: true,
      isHeavyIntensity: true,
      operationalLoadScore: 4,
    });
    expect(buildAdminOperationalLoadBadges(signals).map((b) => b.label)).toEqual([
      "2-cleaner request",
      "Bring equipment",
      "Heavy clean",
      "Operational load",
    ]);
  });

  it("ignores team signals for non-regular services", () => {
    const signals = parseAdminOperationalLoadSignals(
      { quote: { input: { serviceSlug: "deep-cleaning", requestedTeamSize: 2 } } },
      "deep-cleaning",
    );
    expect(signals.operationalLoadScore).toBe(0);
  });

  it("round-trips team request fulfillment in adminOps metadata", () => {
    const fulfillment = {
      fulfilledCleanerCount: 2 as const,
      recordedAt: "2026-05-18T10:00:00.000Z",
      recordedByProfileId: "admin-profile-id",
    };
    const merged = mergeTeamRequestFulfillmentMetadata({}, fulfillment);
    expect(readTeamRequestFulfillment(merged as Json)).toEqual(fulfillment);
  });

  it("round-trips NF-7B.2 team support ops metadata", () => {
    const merged = mergeTeamSupportOpsMetadata(
      mergeTeamRequestFulfillmentMetadata({}, {
        fulfilledCleanerCount: 2,
        recordedAt: "2026-05-18T10:00:00.000Z",
        recordedByProfileId: "admin-profile-id",
      }),
      {
        supportingCleaner: {
          name: "Sam Partner",
          profileId: "partner-profile-id",
          recordedAt: "2026-05-18T11:00:00.000Z",
          recordedByProfileId: "admin-profile-id",
        },
        teamSupportNotes: "Arrive 15 min apart; Sam brings vacuum.",
        coordinationStatus: {
          status: "partially_fulfilled",
          recordedAt: "2026-05-18T11:30:00.000Z",
          recordedByProfileId: "admin-profile-id",
        },
      },
    );

    const ops = readTeamSupportOps(merged as Json);
    expect(ops.supportingCleaner?.name).toBe("Sam Partner");
    expect(ops.teamSupportNotes).toContain("Arrive 15 min apart");
    expect(ops.coordinationStatus?.status).toBe("partially_fulfilled");
    expect(supportingCleanerDisplayLabel(ops.supportingCleaner)).toBe(
      "Sam Partner (partner-)",
    );
    expect(teamCoordinationStatusLabel(ops.coordinationStatus, true)).toBe(
      "Partially coordinated",
    );
  });

  it("matches NF-7B.2 team support booking filters", () => {
    const row = mapTeamSupportObservationRow({
      bookingId: "team-1",
      priceCents: 100_000,
      metadata: teamMetadata,
    });

    expect(matchesTeamSupportBookingFilter(row, "team_high_risk_combo")).toBe(true);
    expect(matchesTeamSupportBookingFilter(row, "high_operational_load")).toBe(true);
    expect(matchesTeamSupportBookingFilter(row, "team_awaiting_coordination")).toBe(true);
    expect(matchesTeamSupportBookingFilter(row, "team_fully_coordinated")).toBe(false);

    const coordinated = mergeTeamSupportOpsMetadata(teamMetadata, {
      coordinationStatus: {
        status: "fully_coordinated",
        recordedAt: "2026-05-18T12:00:00.000Z",
        recordedByProfileId: "admin-profile-id",
      },
    });
    const coordinatedRow = mapTeamSupportObservationRow({
      bookingId: "team-2",
      priceCents: 100_000,
      metadata: coordinated,
    });
    expect(matchesTeamSupportBookingFilter(coordinatedRow, "team_fully_coordinated")).toBe(
      true,
    );
    expect(matchesTeamSupportBookingFilter(coordinatedRow, "team_awaiting_coordination")).toBe(
      false,
    );
  });

  it("aggregates team support analytics from observation rows", () => {
    const rows = [
      mapTeamSupportObservationRow({
        bookingId: "a",
        priceCents: 100_000,
        metadata: teamMetadata,
      }),
      mapTeamSupportObservationRow({
        bookingId: "b",
        priceCents: 80_000,
        metadata: {
          quote: {
            input: {
              serviceSlug: "regular-cleaning",
              bedrooms: 2,
              bathrooms: 1,
              requestedTeamSize: 1,
            },
          },
        },
      }),
    ];

    const analytics = computeAdminTeamSupportAnalytics(rows, 500);
    expect(analytics.regularCleaningTotal).toBe(2);
    expect(analytics.teamRequestTotal).toBe(1);
    expect(analytics.teamRequestPercent).toBe(50);
    expect(analytics.fulfillmentUnrecorded).toBe(1);
    expect(analytics.avgHomeSizeUnitsTeamRequests).toBe(7);
    expect(analytics.avgPriceCentsTeamRequests).toBe(100_000);
  });
});
