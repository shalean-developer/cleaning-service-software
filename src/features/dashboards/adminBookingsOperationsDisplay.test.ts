import { describe, expect, it } from "vitest";
import {
  buildAdminBookingOpsCardModel,
  formatAdminBookingOpsReference,
  labelForAdminBookingOpsStatus,
} from "./adminBookingsOperationsDisplay";
import type { AdminBookingListItem } from "./server/types";

const BASE: AdminBookingListItem = {
  id: "550e8400-e29b-41d4-a716-446655440099",
  status: "pending_assignment",
  paymentStatus: "paid",
  paymentFailureReason: null,
  customerLabel: "Naledi Khumalo",
  cleanerLabel: null,
  serviceLabel: "Deep Cleaning",
  scheduleLabel: "Today",
  scheduledStart: "2026-05-21T06:30:00.000Z",
  scheduledEnd: "2026-05-21T11:30:00.000Z",
  suburb: "Sea Point",
  city: "Cape Town",
  addressLine: "12 Beach Rd",
  homeSizeSummary: "4 bed",
  isRecurring: false,
  priceLabel: "R 1 180,00",
  priceCents: 118000,
  observation: {
    isTwoCleanerRequest: false,
    operationalLoad: { score: 0, signals: [] },
    teamRequestFulfillment: null,
    teamRequestFulfillmentLabel: null,
    teamSupportOps: { coordinationStatus: null },
    supportingCleanerLabel: null,
    coordinationStatusLabel: null,
    hasTeamSupportNotes: false,
  },
  assignmentAttention: "needs_assignment",
  assignmentVisibilityKey: "finding_cleaner",
  updatedAt: new Date().toISOString(),
};

describe("adminBookingsOperationsDisplay", () => {
  it("formats SHL-style booking reference", () => {
    expect(formatAdminBookingOpsReference(BASE.id)).toMatch(/^SHL-[A-F0-9]{4}$/);
  });

  it("maps unassigned pending assignment to matching cleaner", () => {
    expect(labelForAdminBookingOpsStatus(BASE)).toBe("Matching cleaner");
    const model = buildAdminBookingOpsCardModel(BASE);
    expect(model.initials).toBe("NK");
    expect(model.alertLabels).toContain("No cleaner matched");
    expect(model.serviceTitle).toContain("4 bed");
  });
});
