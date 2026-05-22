import { describe, expect, it } from "vitest";
import {
  buildSupportOperationsSnapshot,
  filterItemsByOperationsView,
} from "./supportOperationsReadModel";
import type { AdminSupportInboxItem } from "./adminSupportInboxReadModel";

function minimalItem(
  overrides: Partial<AdminSupportInboxItem> & Pick<AdminSupportInboxItem, "id" | "status">,
): AdminSupportInboxItem {
  return {
    id: overrides.id,
    source: "booking_support",
    requestType: "payment_help",
    requestTypeLabel: "Payment help",
    status: overrides.status,
    statusLabel: overrides.status,
    priority: "urgent",
    messagePreview: null,
    preferredNewTime: null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    resolvedAt: overrides.resolvedAt ?? null,
    customerId: "c1",
    customerName: "Test",
    customerEmail: null,
    customerPhone: null,
    bookingId: "b1",
    bookingReference: "REF",
    bookingStatus: null,
    paymentStatus: null,
    scheduledStart: null,
    serviceLabel: null,
    addressSummary: null,
    seriesId: null,
    groupId: null,
    frequencyLabel: null,
    targetWeekdayLabel: null,
    bookingHref: null,
    seriesHref: null,
    groupHref: null,
    suggestedNextAction: "Review",
    canAcknowledge: overrides.status === "open",
    canResolve: true,
    canReject: true,
    staleOpen24h: false,
    staleAcknowledged48h: false,
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    slaCategory: "urgent",
    slaStatus: overrides.slaStatus ?? "breached",
    ageBucket: "1_to_8h",
    ageMinutes: overrides.ageMinutes ?? 90,
    firstResponseDueAt: null,
    resolutionDueAt: null,
    timeToFirstResponseMinutes: null,
    timeToResolutionMinutes: null,
    urgencyReason: null,
    triageLabel: overrides.triageLabel ?? "needs_action_today",
    escalationReasons: overrides.escalationReasons ?? [],
    cleanerId: null,
    cleanerLabel: null,
    suburb: overrides.suburb ?? null,
    paymentRisk: true,
    upcomingVisitHours: null,
    customerResponse: null,
    respondedAt: null,
    adminNotes: null,
    resolvedBy: null,
    ...overrides,
  };
}

describe("supportOperationsReadModel", () => {
  it("counts breached SLA and escalations", () => {
    const items = [
      minimalItem({ id: "1", status: "open", escalationReasons: ["SLA breached"] }),
      minimalItem({ id: "2", status: "resolved", slaStatus: "healthy", priority: "low" }),
    ];
    const ops = buildSupportOperationsSnapshot(items);
    expect(ops.slaBreached).toBe(1);
    expect(ops.open).toBe(1);
  });

  it("filters needs_attention view", () => {
    const items = [
      minimalItem({ id: "1", status: "open", slaStatus: "warning" }),
      minimalItem({ id: "2", status: "resolved", slaStatus: "healthy", priority: "low" }),
    ];
    const filtered = filterItemsByOperationsView(items, "needs_attention");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("1");
  });
});
